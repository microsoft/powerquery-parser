// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { DefaultSettings, Task } from "../../..";
import { Assert, Language, TaskUtils, Traverse } from "../../../powerquery-parser";
import { NodeIdMap, TXorNode, XorNodeUtils } from "../../../powerquery-parser/parser";
import { ChildIdsById, IdsByNodeKind, ParentIdById } from "../../../powerquery-parser/parser/nodeIdMap/nodeIdMap";
import { TestAssertUtils } from "../../testUtils";

type TraverseState = Traverse.IState<undefined> & Pick<NodeIdMap.Collection, "leafIds" | "idsByNodeKind">;

interface AbridgedNodeIdMapCollection {
    readonly astIds: ReadonlyArray<number>;
    readonly contextIds: ReadonlyArray<number>;

    readonly idsByNodeKind: ReadonlyArray<[Language.Ast.NodeKind, ReadonlyArray<number>]>;
    readonly leafIds: ReadonlyArray<number>;
    readonly childIdsById: ReadonlyArray<[number, ReadonlyArray<number>]>;
    readonly parentIdById: ReadonlyArray<[number, number]>;
}

function createSimplifiedChildIdsById(childIdsById: ChildIdsById): ReadonlyArray<[number, ReadonlyArray<number>]> {
    return [...childIdsById.entries()].sort();
}

function createSimplifiedIdsByNodeKind(
    idsByNodeKind: IdsByNodeKind,
): ReadonlyArray<[Language.Ast.NodeKind, ReadonlyArray<number>]> {
    const result: [Language.Ast.NodeKind, ReadonlyArray<number>][] = [...idsByNodeKind.entries()].map(
        ([nodeKind, nodeIds]: [Language.Ast.NodeKind, Set<number>]) => {
            return [nodeKind, [...nodeIds.values()]];
        },
    );
    return result.sort();
}

function createSimplifiedLeafIds(leafIds: Set<number>): ReadonlyArray<number> {
    return [...leafIds.values()].sort();
}

function createSimplifiedParentIdById(parentIdById: ParentIdById): ReadonlyArray<[number, number]> {
    return [...parentIdById.entries()].sort();
}

function expectLinksMatch(triedLexParse: Task.TriedLexParseTask, expected: AbridgedNodeIdMapCollection): void {
    let nodeIdMapCollection: NodeIdMap.Collection;
    let xorNode: TXorNode;

    if (TaskUtils.isParseStageOk(triedLexParse)) {
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
        xorNode = XorNodeUtils.createAstNode(triedLexParse.ast);
    } else if (TaskUtils.isParseStageParseError(triedLexParse)) {
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
        xorNode = XorNodeUtils.createContextNode(Assert.asDefined(triedLexParse.error.state.contextState.maybeRoot));
    } else {
        throw new Error(`expected TriedLexParse to be Ok`);
    }

    const traverseState: TraverseState = {
        locale: DefaultSettings.locale,
        result: undefined,
        leafIds: new Set<number>(),
        idsByNodeKind: new Map(),
    };

    const triedTraverse: Traverse.TriedTraverse<undefined> = Traverse.tryTraverseXor(
        traverseState,
        triedLexParse.nodeIdMapCollection,
        xorNode,
        Traverse.VisitNodeStrategy.BreadthFirst,
        traverseVisitNode,
        Traverse.assertGetAllXorChildren,
        undefined,
    );
    Assert.isOk(triedTraverse);

    // First, assert that the leafIds and idsByNodeKind are the same from both
    // TriedLexParseTask and from an Ast traversal.
    expect(createSimplifiedLeafIds(nodeIdMapCollection.leafIds)).to.deep.equal(
        createSimplifiedLeafIds(traverseState.leafIds),
        "mismatch between nodeIdMapCollection and traversal results for leafIds",
    );
    expect(createSimplifiedIdsByNodeKind(nodeIdMapCollection.idsByNodeKind)).to.deep.equal(
        createSimplifiedIdsByNodeKind(traverseState.idsByNodeKind),
        "mismatch between nodeIdMapCollection and traversal results for idsByNodeKind",
    );

    // Now compare the expected values to TriedLexParseTask
    expect([...nodeIdMapCollection.astNodeById.keys()].sort()).to.deep.equal(
        expected.astIds,
        "mismatch between expected and actual for astIds",
    );
    expect([...nodeIdMapCollection.contextNodeById.keys()].sort()).to.deep.equal(
        expected.contextIds,
        "mismatch between expected and actual for contextIds",
    );

    expect(createSimplifiedChildIdsById(nodeIdMapCollection.childIdsById)).to.deep.equal(
        expected.childIdsById,
        "mismatch between expected and actual for childIdsById",
    );
    expect(createSimplifiedIdsByNodeKind(nodeIdMapCollection.idsByNodeKind)).to.deep.equal(
        expected.idsByNodeKind,
        "mismatch between expected and actual for idsByNodeKind",
    );
    expect(createSimplifiedLeafIds(nodeIdMapCollection.leafIds)).to.deep.equal(expected.leafIds, "mismatch on leafIds");
    expect(createSimplifiedParentIdById(nodeIdMapCollection.parentIdById)).to.deep.equal(
        expected.parentIdById,
        "mismatch between expected and actual for parentIdById",
    );
}

function traverseVisitNode(state: TraverseState, xorNode: TXorNode): void {
    if (xorNode.node.isLeaf) {
        state.leafIds.add(xorNode.node.id);
    }

    const maybeNodeIdsByNodeKind: Set<number> | undefined = state.idsByNodeKind.get(xorNode.node.kind);
    if (maybeNodeIdsByNodeKind !== undefined) {
        maybeNodeIdsByNodeKind.add(xorNode.node.id);
    } else {
        state.idsByNodeKind.set(xorNode.node.kind, new Set([xorNode.node.id]));
    }
}

describe("idUtils", () => {
    it(`1`, () => {
        const text: string = `1`;
        const expected: AbridgedNodeIdMapCollection = {
            astIds: [3],
            childIdsById: [],
            contextIds: [],
            idsByNodeKind: [[Language.Ast.NodeKind.LiteralExpression, [3]]],
            leafIds: [3],
            parentIdById: [],
        };
        const triedLexParse: Task.TriedLexParseTask = TaskUtils.tryLexParse(DefaultSettings, text);
        expectLinksMatch(triedLexParse, expected);
    });

    it(`-1`, () => {
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
        const triedLexParse: Task.TriedLexParseTask = TaskUtils.tryLexParse(DefaultSettings, text);
        expectLinksMatch(triedLexParse, expected);
    });

    it(`WIP 1 + 2`, () => {
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
                [4, 6],
                [5, 6],
                [6, 6],
            ],
        };
        const triedLexParse: Task.TriedLexParseTask = TaskUtils.tryLexParse(DefaultSettings, text);
        expectLinksMatch(triedLexParse, expected);
    });

    xit(`let x = foo(){0} in x`, () => {
        const text: string = `let x = foo(){0} in x`;
        const expected: ReadonlyArray<number> = [2, 6, 7, 12, 15, 17, 19, 22, 23, 24, 28];
        const lexParseOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
        const actual: Set<number> = lexParseOk.nodeIdMapCollection.leafIds;
        expect([...actual.values()]).to.have.members(expected);
    });
});
