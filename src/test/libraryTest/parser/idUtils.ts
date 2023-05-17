// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, Language, ResultUtils, TaskUtils, Traverse } from "../../../powerquery-parser";
import { ChildIdsById, IdsByNodeKind, ParentIdById } from "../../../powerquery-parser/parser/nodeIdMap/nodeIdMap";
import { DefaultSettings, Task } from "../../..";
import { NodeIdMap, TXorNode, XorNodeUtils } from "../../../powerquery-parser/parser";
import { NoOpTraceManagerInstance } from "../../../powerquery-parser/common/trace";

type TraverseState = Traverse.ITraversalState<undefined> &
    Pick<NodeIdMap.Collection, "leafIds" | "idsByNodeKind"> & { astIds: number[]; contextIds: number[] };

interface AbridgedNodeIdMapCollection {
    readonly astIds: ReadonlyArray<number>;
    readonly contextIds: ReadonlyArray<number>;

    readonly idsByNodeKind: ReadonlyArray<[Language.Ast.NodeKind, ReadonlyArray<number>]>;
    readonly leafIds: ReadonlyArray<number>;
    readonly childIdsById: ReadonlyArray<[number, ReadonlyArray<number>]>;
    readonly parentIdById: ReadonlyArray<[number, number]>;
}

function createSimplifiedMapKeys<K, V>(collection: Map<K, V>): ReadonlyArray<K> {
    return [...collection.keys()].sort();
}

function createSimplifiedChildIdsById(childIdsById: ChildIdsById): ReadonlyArray<[number, ReadonlyArray<number>]> {
    return [...childIdsById.entries()].sort();
}

function createSimplifiedIdsByNodeKind(
    idsByNodeKind: IdsByNodeKind,
): ReadonlyArray<[Language.Ast.NodeKind, ReadonlyArray<number>]> {
    const result: [Language.Ast.NodeKind, ReadonlyArray<number>][] = [...idsByNodeKind.entries()].map(
        ([nodeKind, nodeIds]: [Language.Ast.NodeKind, Set<number>]) => [nodeKind, [...nodeIds.values()]],
    );

    return result.sort();
}

function createSimplifiedLeafIds(leafIds: Set<number>): ReadonlyArray<number> {
    return [...leafIds.values()].sort();
}

function createSimplifiedParentIdById(parentIdById: ParentIdById): ReadonlyArray<[number, number]> {
    return [...parentIdById.entries()].sort();
}

async function expectLinksMatch(
    triedLexParse: Task.TriedLexParseTask,
    expected: AbridgedNodeIdMapCollection,
): Promise<void> {
    let nodeIdMapCollection: NodeIdMap.Collection;
    let xorNode: TXorNode;

    if (TaskUtils.isParseStageOk(triedLexParse)) {
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
        xorNode = XorNodeUtils.boxAst(triedLexParse.ast);
    } else if (TaskUtils.isParseStageParseError(triedLexParse)) {
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
        xorNode = XorNodeUtils.boxContext(Assert.asDefined(triedLexParse.error.state.contextState.root));
    } else {
        throw new Error(`expected TriedLexParse to be Ok`);
    }

    expected = {
        astIds: [...expected.astIds.values()].sort(),
        childIdsById: [...expected.childIdsById.values()].sort(),
        contextIds: [...expected.contextIds.values()].sort(),
        idsByNodeKind: [...expected.idsByNodeKind.values()].sort(),
        leafIds: [...expected.leafIds.values()].sort(),
        parentIdById: [...expected.parentIdById.values()].sort(),
    };

    const traverseState: TraverseState = {
        locale: DefaultSettings.locale,
        result: undefined,
        astIds: [],
        contextIds: [],
        leafIds: new Set<number>(),
        idsByNodeKind: new Map(),
        cancellationToken: undefined,
        initialCorrelationId: undefined,
        traceManager: NoOpTraceManagerInstance,
    };

    const triedTraverse: Traverse.TriedTraverse<undefined> = await Traverse.tryTraverseXor(
        traverseState,
        triedLexParse.nodeIdMapCollection,
        xorNode,
        Traverse.VisitNodeStrategy.BreadthFirst,
        traverseVisitNode,
        Traverse.assertGetAllXorChildren,
        undefined,
    );

    ResultUtils.assertIsOk(triedTraverse);
    assertTraverseMatchesState(traverseState, nodeIdMapCollection);

    const astIds: ReadonlyArray<number> = [...nodeIdMapCollection.astNodeById.keys()];
    const contextIds: ReadonlyArray<number> = [...nodeIdMapCollection.contextNodeById.keys()];
    const nodeIds: ReadonlyArray<number> = [...astIds, ...contextIds].sort();

    const parentIds: ReadonlyArray<number> = [...nodeIdMapCollection.parentIdById.keys()].sort();

    const childIds: ReadonlyArray<number> = [...nodeIdMapCollection.childIdsById.values()]
        .reduce(
            (partial: number[], currentValue: ReadonlyArray<number>) => partial.concat([...currentValue.values()]),
            [],
        )
        .sort();

    const idsFromKindMap: ReadonlyArray<number> = [...nodeIdMapCollection.idsByNodeKind.values()]
        .reduce((partial: number[], currentValue: Set<number>) => partial.concat([...currentValue.values()]), [])
        .sort();

    expect(idsFromKindMap).to.deep.equal(
        nodeIds,
        "expected idsFromKindMap to equal nodeIds, since they're supposed to be different shapes for the same data",
    );

    expect(parentIds.length).to.equal(
        childIds.length,
        "expected parentIds.length to be equal childIds.length, since every child must have a parent",
    );

    expect(childIds.length).to.equal(
        nodeIds.length - 1,
        "expected childIds.length to equal n - 1 (where n is number of nodes), since every node must be a child except for the root",
    );

    // Now compare the expected values to TriedLexParseTask
    const actualAstIds: ReadonlyArray<number> = [...nodeIdMapCollection.astNodeById.keys()].sort();
    expect(actualAstIds).to.deep.equal(expected.astIds, "mismatch between expected and actual for astIds");

    const actualContextIds: ReadonlyArray<number> = [...nodeIdMapCollection.contextNodeById.keys()].sort();
    expect(actualContextIds).to.deep.equal(expected.contextIds, "mismatch between expected and actual for contextIds");

    const actualChildIdsById: ReadonlyArray<[number, ReadonlyArray<number>]> = createSimplifiedChildIdsById(
        nodeIdMapCollection.childIdsById,
    );

    expect(actualChildIdsById).to.deep.equal(
        expected.childIdsById,
        "mismatch between expected and actual for childIdsById",
    );

    const actualIdsByNodeKind: ReadonlyArray<[Language.Ast.NodeKind, ReadonlyArray<number>]> =
        createSimplifiedIdsByNodeKind(nodeIdMapCollection.idsByNodeKind);

    expect(actualIdsByNodeKind).to.deep.equal(
        expected.idsByNodeKind,
        "mismatch between expected and actual for idsByNodeKind",
    );

    const actualLeafIds: ReadonlyArray<number> = createSimplifiedLeafIds(nodeIdMapCollection.leafIds);
    expect(actualLeafIds).to.deep.equal(expected.leafIds, "mismatch on leafIds");

    const actualParentIdById: ReadonlyArray<[number, number]> = createSimplifiedParentIdById(
        nodeIdMapCollection.parentIdById,
    );

    expect(actualParentIdById).to.deep.equal(
        expected.parentIdById,
        "mismatch between expected and actual for parentIdById",
    );
}

// Compares the results from an Ast traversal to the state stored in NodeIdMap.Collection.
function assertTraverseMatchesState(traverseState: TraverseState, nodeIdMapCollection: NodeIdMap.Collection): void {
    expect(createSimplifiedMapKeys(nodeIdMapCollection.astNodeById)).to.deep.equal(
        traverseState.astIds.sort(),
        "mismatch between nodeIdMapCollection and traversal results for astIds",
    );

    expect(createSimplifiedMapKeys(nodeIdMapCollection.contextNodeById)).to.deep.equal(
        traverseState.contextIds.sort(),
        "mismatch between nodeIdMapCollection and traversal results for contextIds",
    );

    expect(createSimplifiedLeafIds(nodeIdMapCollection.leafIds)).to.deep.equal(
        createSimplifiedLeafIds(traverseState.leafIds),
        "mismatch between nodeIdMapCollection and traversal results for leafIds",
    );

    expect(createSimplifiedIdsByNodeKind(nodeIdMapCollection.idsByNodeKind)).to.deep.equal(
        createSimplifiedIdsByNodeKind(traverseState.idsByNodeKind),
        "mismatch between nodeIdMapCollection and traversal results for idsByNodeKind",
    );
}

// eslint-disable-next-line require-await
async function traverseVisitNode(state: TraverseState, xorNode: TXorNode): Promise<void> {
    if (XorNodeUtils.isAst(xorNode)) {
        state.astIds.push(xorNode.node.id);

        if (xorNode.node.isLeaf) {
            state.leafIds.add(xorNode.node.id);
        }
    } else {
        state.contextIds.push(xorNode.node.id);
    }

    const nodeIdsByNodeKind: Set<number> | undefined = state.idsByNodeKind.get(xorNode.node.kind);

    if (nodeIdsByNodeKind !== undefined) {
        nodeIdsByNodeKind.add(xorNode.node.id);
    } else {
        state.idsByNodeKind.set(xorNode.node.kind, new Set([xorNode.node.id]));
    }
}

describe("idUtils", () => {
    it(`1`, async () => {
        const text: string = `1`;

        const expected: AbridgedNodeIdMapCollection = {
            astIds: [3],
            childIdsById: [],
            contextIds: [],
            idsByNodeKind: [[Language.Ast.NodeKind.LiteralExpression, [3]]],
            leafIds: [3],
            parentIdById: [],
        };

        const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, text);
        await expectLinksMatch(triedLexParse, expected);
    });

    it(`-1`, async () => {
        const text: string = `-1`;

        const expected: AbridgedNodeIdMapCollection = {
            astIds: [3, 4, 5, 6],
            childIdsById: [
                [3, [4, 6]],
                [4, [5]],
            ],
            contextIds: [],
            idsByNodeKind: [
                [Language.Ast.NodeKind.ArrayWrapper, [4]],
                [Language.Ast.NodeKind.Constant, [5]],
                [Language.Ast.NodeKind.LiteralExpression, [6]],
                [Language.Ast.NodeKind.UnaryExpression, [3]],
            ],
            leafIds: [5, 6],
            parentIdById: [
                [4, 3],
                [5, 4],
                [6, 3],
            ],
        };

        const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, text);
        await expectLinksMatch(triedLexParse, expected);
    });

    it(`1 + 2`, async () => {
        const text: string = `1 + 2`;

        const expected: AbridgedNodeIdMapCollection = {
            astIds: [3, 4, 5, 6],
            childIdsById: [[6, [3, 4, 5]]],
            contextIds: [],
            idsByNodeKind: [
                [Language.Ast.NodeKind.ArithmeticExpression, [6]],
                [Language.Ast.NodeKind.Constant, [4]],
                [Language.Ast.NodeKind.LiteralExpression, [3, 5]],
            ],
            leafIds: [3, 4, 5],
            parentIdById: [
                [3, 6],
                [4, 6],
                [5, 6],
            ],
        };

        const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, text);
        await expectLinksMatch(triedLexParse, expected);
    });

    it(`WIP foo()`, async () => {
        const text: string = `foo()`;

        const expected: AbridgedNodeIdMapCollection = {
            astIds: [3, 4, 5, 6, 7, 8, 9, 10],
            childIdsById: [
                [3, [4, 6]],
                [4, [5]],
                [6, [7]],
                [7, [8, 9, 10]],
            ],
            contextIds: [],
            idsByNodeKind: [
                [Language.Ast.NodeKind.ArrayWrapper, [6, 9]],
                [Language.Ast.NodeKind.Constant, [8, 10]],
                [Language.Ast.NodeKind.Identifier, [5]],
                [Language.Ast.NodeKind.IdentifierExpression, [4]],
                [Language.Ast.NodeKind.InvokeExpression, [7]],
                [Language.Ast.NodeKind.RecursivePrimaryExpression, [3]],
            ],
            leafIds: [5, 8, 10],
            parentIdById: [
                [4, 3],
                [5, 4],
                [6, 3],
                [7, 6],
                [8, 7],
                [9, 7],
                [10, 7],
            ],
        };

        const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, text);
        await expectLinksMatch(triedLexParse, expected);
    });
});
