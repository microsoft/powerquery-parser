// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Task } from "../../..";
import { Ast } from "../../../language";
import { IParseState, NodeIdMap } from "../../../powerquery-parser/parser";
import { DefaultSettings } from "../../../settings";
import { TestAssertUtils } from "../../testUtils";

interface ChildIdsByIdEntry {
    readonly childNodeIds: ReadonlyArray<number>;
    readonly id: number;
    readonly kind: Ast.NodeKind;
}

function actualFactory<S extends IParseState = IParseState>(lexParseOk: Task.LexParseOk<S>): ChildIdsByIdEntry[] {
    const actual: ChildIdsByIdEntry[] = [];
    const astNodeById: NodeIdMap.AstNodeById = lexParseOk.state.contextState.nodeIdMapCollection.astNodeById;

    for (const [key, value] of lexParseOk.state.contextState.nodeIdMapCollection.childIdsById.entries()) {
        actual.push({
            childNodeIds: value,
            id: key,
            kind: astNodeById.get(key)!.kind,
        });
    }

    return actual;
}

describe("Parser.Children", () => {
    it(`() as number => 1`, () => {
        const text: string = `() as number => 1`;
        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [2, 6, 9, 12],
                id: 1,
                kind: Ast.NodeKind.FunctionExpression,
            },
            {
                childNodeIds: [3, 4, 5],
                id: 2,
                kind: Ast.NodeKind.ParameterList,
            },
            {
                childNodeIds: [7, 8],
                id: 6,
                kind: Ast.NodeKind.AsNullablePrimitiveType,
            },
        ];
        const actual: ReadonlyArray<ChildIdsByIdEntry> = actualFactory(
            TestAssertUtils.assertGetLexParseOk(DefaultSettings, text),
        );
        expect(actual).to.deep.equal(expected);
    });

    it(`null ?? 1 ?? 2`, () => {
        const text: string = `null ?? 1 ?? 2`;
        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [3, 4, 5],
                id: 8,
                kind: Ast.NodeKind.NullCoalescingExpression,
            },
            {
                childNodeIds: [8, 6, 7],
                id: 9,
                kind: Ast.NodeKind.NullCoalescingExpression,
            },
        ];
        const actual: ReadonlyArray<ChildIdsByIdEntry> = actualFactory(
            TestAssertUtils.assertGetLexParseOk(DefaultSettings, text),
        );
        expect(actual).to.deep.equal(expected);
    });
});
