// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Task } from "../../..";
import { Ast } from "../../../language";
import { IParserState, NodeIdMap } from "../../../parser";
import { DefaultSettings } from "../../../settings";
import { expectDeepEqual, expectLexParseOk } from "../../common";

interface ChildIdsByIdEntry {
    readonly childNodeIds: ReadonlyArray<number>;
    readonly id: number;
    readonly kind: Ast.NodeKind;
}

function acutalFactoryFn<S extends IParserState = IParserState>(lexParseOk: Task.LexParseOk<S>): ChildIdsByIdEntry[] {
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
                childNodeIds: [3, 7, 11, 14],
                id: 2,
                kind: Ast.NodeKind.FunctionExpression,
            },
            {
                childNodeIds: [4, 5, 6],
                id: 3,
                kind: Ast.NodeKind.ParameterList,
            },
            {
                childNodeIds: [8, 9],
                id: 7,
                kind: Ast.NodeKind.AsNullablePrimitiveType,
            },
            {
                childNodeIds: [10],
                id: 9,
                kind: Ast.NodeKind.PrimitiveType,
            },
        ];
        expectDeepEqual(expectLexParseOk(DefaultSettings, text), expected, acutalFactoryFn);
    });
});
