// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultLocale, DefaultSettings, ResultUtils, Task, TaskUtils, Traverse } from "../../..";
import { Ast, Constant } from "../../../powerquery-parser/language";
import { NodeIdMap, ParseSettings, TXorNode, XorNodeUtils } from "../../../powerquery-parser/parser";
import { AssertTestUtils } from "../../testUtils";
import { LexSettings } from "../../../powerquery-parser/lexer";
import { NoOpTraceManagerInstance } from "../../../powerquery-parser/common/trace";

export type AbridgedNode = [Ast.NodeKind, number | undefined];

type CollectAbridgeNodeState = Traverse.ITraversalState<AbridgedNode[]>;

interface NthNodeOfKindState extends Traverse.ITraversalState<Ast.TNode | undefined> {
    readonly nodeKind: Ast.NodeKind;
    readonly nthRequired: number;
    nthCounter: number;
}

export async function runAbridgedNodeTest(
    text: string,
    expected: ReadonlyArray<AbridgedNode>,
    options?: {
        readonly astOnly?: boolean;
        readonly settings: LexSettings & ParseSettings;
    },
): Promise<Task.ParseTaskOk | Task.ParseTaskParseError> {
    const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
        options?.settings ?? DefaultSettings,
        text,
    );

    let root: TXorNode;
    let nodeIdMapCollection: NodeIdMap.Collection;

    if (TaskUtils.isParseStageOk(triedLexParse)) {
        root = XorNodeUtils.boxAst(triedLexParse.ast);
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
    } else if (TaskUtils.isParseStageParseError(triedLexParse)) {
        root = XorNodeUtils.boxContext(Assert.asDefined(triedLexParse.parseState.contextState.root));
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
    } else {
        throw new Error(`expected isParseStageOk/isParseStageParseError`);
    }

    validateNodeIdMapCollection(nodeIdMapCollection, root);

    const actual: ReadonlyArray<AbridgedNode> = await collectAbridgeNodeFromXor(
        nodeIdMapCollection,
        root,
        options?.astOnly ?? false,
    );

    expect(actual).to.deep.equal(expected);

    return triedLexParse;
}

export async function runAbridgedNodeAndOperatorTest(
    text: string,
    constant: Constant.TConstant,
    expected: ReadonlyArray<AbridgedNode>,
): Promise<void> {
    await runAbridgedNodeTest(text, expected);

    const operatorNode: Ast.TConstant = await assertGetNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);

    expect(operatorNode.constantKind).to.equal(constant);
}

export async function assertGetNthNodeOfKind<N extends Ast.TNode>(
    text: string,
    nodeKind: Ast.NodeKind,
    nthRequired: number,
): Promise<N> {
    const parseTaskOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text);

    const state: NthNodeOfKindState = {
        locale: DefaultLocale,
        result: undefined,
        nodeKind,
        nthCounter: 0,
        nthRequired,
        cancellationToken: undefined,
        initialCorrelationId: undefined,
        traceManager: NoOpTraceManagerInstance,
    };

    const triedTraverse: Traverse.TriedTraverse<Ast.TNode | undefined> = await Traverse.tryTraverseAst<
        NthNodeOfKindState,
        Ast.TNode | undefined
    >(
        state,
        parseTaskOk.nodeIdMapCollection,
        parseTaskOk.ast,
        Traverse.VisitNodeStrategy.BreadthFirst,
        nthNodeVisit,
        Traverse.assertGetAllAstChildren,
        nthNodeEarlyExit,
    );

    ResultUtils.assertIsOk(triedTraverse);

    return Assert.asDefined(triedTraverse.value) as N;
}

async function collectAbridgeNodeFromXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    root: TXorNode,
    astOnly: boolean,
): Promise<ReadonlyArray<AbridgedNode>> {
    const state: CollectAbridgeNodeState = {
        locale: DefaultLocale,
        result: [],
        cancellationToken: undefined,
        initialCorrelationId: undefined,
        traceManager: NoOpTraceManagerInstance,
    };

    const triedTraverse: Traverse.TriedTraverse<AbridgedNode[]> = await Traverse.tryTraverseXor<
        CollectAbridgeNodeState,
        AbridgedNode[]
    >(
        state,
        nodeIdMapCollection,
        root,
        Traverse.VisitNodeStrategy.BreadthFirst,
        (state: CollectAbridgeNodeState, xorNode: TXorNode) => collectAbridgeXorNodeVisit(state, xorNode, astOnly),
        Traverse.assertGetAllXorChildren,
        undefined,
    );

    ResultUtils.assertIsOk(triedTraverse);

    return triedTraverse.value;
}

// eslint-disable-next-line require-await
async function collectAbridgeXorNodeVisit(
    state: CollectAbridgeNodeState,
    xorNode: TXorNode,
    astOnly: boolean,
): Promise<void> {
    if (astOnly && !XorNodeUtils.isAst(xorNode)) {
        return;
    }

    state.result.push([xorNode.node.kind, xorNode.node.attributeIndex]);
}

// eslint-disable-next-line require-await
async function nthNodeVisit(state: NthNodeOfKindState, node: Ast.TNode): Promise<void> {
    if (node.kind === state.nodeKind) {
        state.nthCounter += 1;

        if (state.nthCounter === state.nthRequired) {
            state.result = node;
        }
    }
}

// eslint-disable-next-line require-await
async function nthNodeEarlyExit(state: NthNodeOfKindState, _: Ast.TNode): Promise<boolean> {
    return state.nthCounter === state.nthRequired;
}

function validateNodeIdMapCollection(nodeIdMapCollection: NodeIdMap.Collection, root: TXorNode): void {
    const astNodeIds: Set<number> = new Set(nodeIdMapCollection.astNodeById.keys());
    const contextNodeIds: Set<number> = new Set(nodeIdMapCollection.contextNodeById.keys());
    const allNodeIds: Set<number> = new Set([...astNodeIds].concat([...contextNodeIds]));

    expect(nodeIdMapCollection.parentIdById).to.not.have.key(root.node.id.toString());

    expect(nodeIdMapCollection.parentIdById.size).to.equal(
        allNodeIds.size - 1,
        "parentIdById should have one less entry than allNodeIds",
    );

    expect(astNodeIds.size + contextNodeIds.size).to.equal(
        allNodeIds.size,
        "allNodeIds should be a union of astNodeIds and contextNodeIds",
    );

    for (const [childId, parentId] of nodeIdMapCollection.parentIdById.entries()) {
        expect(allNodeIds).to.include(childId, "keys for parentIdById should be in allNodeIds");
        expect(allNodeIds).to.include(parentId, "values for parentIdById should be in allNodeIds");
    }

    for (const [parentId, childrenIds] of nodeIdMapCollection.childIdsById.entries()) {
        expect(allNodeIds).to.include(parentId, "keys for childIdsById should be in allNodeIds");

        for (const childId of childrenIds) {
            expect(allNodeIds).to.include(childId, "childIds should be in allNodeIds");

            if (astNodeIds.has(parentId)) {
                expect(astNodeIds).to.include(childId, "if a parent is an astNode then so should be its children");
            }
        }
    }
}
