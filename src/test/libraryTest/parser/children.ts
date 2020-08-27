// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Task } from "../../..";
import { Ast } from "../../../language";
import { IParserState, NodeIdMap } from "../../../parser";
import { DefaultSettings } from "../../../settings";
import { assertDeepEqual, assertLexParseOk } from "../../testUtils/assertUtils";

interface ChildIdsByIdEntry {
    readonly childNodeIds: ReadonlyArray<number>;
    readonly id: number;
    readonly kind: Ast.NodeKind;
}

function actualFactoryFn<S extends IParserState = IParserState>(lexParseOk: Task.LexParseOk<S>): ChildIdsByIdEntry[] {
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
                childNodeIds: [2, 6, 10, 13],
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
            {
                childNodeIds: [9],
                id: 8,
                kind: Ast.NodeKind.PrimitiveType,
            },
        ];
        assertDeepEqual(assertLexParseOk(DefaultSettings, text), expected, actualFactoryFn);
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
        assertDeepEqual(assertLexParseOk(DefaultSettings, text), expected, actualFactoryFn);
    });
});
