// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { DefaultSettings, Task } from "../../..";
import { Assert, Language, TaskUtils, Traverse } from "../../../powerquery-parser";
import { NodeIdMap } from "../../../powerquery-parser/parser";
import { TestAssertUtils } from "../../testUtils";

type TraverseState = Traverse.IState<undefined> & Pick<NodeIdMap.Collection, "leafIds" | "idsByNodeKind">;

interface AbridgedNodeIdMapCollection {
    readonly idsByNodeKind: ReadonlyArray<[Language.Ast.NodeKind, ReadonlyArray<number>]>;
    readonly leafIds: ReadonlyArray<number>;
    readonly childIdsById: ReadonlyArray<[number, ReadonlyArray<number>]>;
    readonly parentIdById: ReadonlyArray<[number, number]>;
}

function expectLinksMatch(triedLexParse: Task.TriedLexParseTask): void {
    if (!TaskUtils.isParseStageOk(triedLexParse)) {
        throw new Error(`expected TriedLexParse to be Ok`);
    }

    const traverseState: TraverseState = {
        locale: DefaultSettings.locale,
        result: undefined,
        leafIds: new Set<number>(),
        idsByNodeKind: new Map(),
    };

    const triedTraverse: Traverse.TriedTraverse<undefined> = Traverse.tryTraverseAst(
        traverseState,
        triedLexParse.nodeIdMapCollection,
        triedLexParse.ast,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitNodeFn,
        Traverse.assertGetAllAstChildren,
        undefined,
    );
    Assert.isOk(triedTraverse);

    expect([triedLexParse.nodeIdMapCollection.leafIds.entries()]).to.deep.equal([...traverseState.leafIds.entries()]);
    // expect(triedLexParse.nodeIdMapCollection.)
}

function visitNodeFn(state: TraverseState, node: Language.Ast.TNode): void {
    if (node.isLeaf) {
        state.leafIds.add(node.id);
    }

    const maybeNodeIdsByNodeKind: Set<number> | undefined = state.idsByNodeKind.get(node.kind);
    if (maybeNodeIdsByNodeKind !== undefined) {
        maybeNodeIdsByNodeKind.add(node.id);
    } else {
        state.idsByNodeKind.set(node.kind, new Set([node.id]));
    }
}

describe("idUtils", () => {
    it(`let x = foo(){0} in x`, () => {
        const text: string = `let x = foo(){0} in x`;
        const expected: ReadonlyArray<number> = [2, 6, 7, 12, 15, 17, 19, 22, 23, 24, 28];
        const lexParseOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
        const actual: Set<number> = lexParseOk.nodeIdMapCollection.leafIds;
        expect([...actual.values()]).to.have.members(expected);
    });
});
