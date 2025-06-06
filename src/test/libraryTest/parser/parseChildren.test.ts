// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Language, Parser, Task } from "../../..";
import { AssertTestUtils } from "../../testUtils";

interface ChildIdsByIdEntry {
    readonly childNodeIds: ReadonlyArray<number>;
    readonly id: number;
    readonly kind: Language.Ast.NodeKind;
}

function createActual(lexParseOk: Task.ParseTaskOk): ChildIdsByIdEntry[] {
    const actual: ChildIdsByIdEntry[] = [];
    const astNodeById: Parser.NodeIdMap.AstNodeById = lexParseOk.nodeIdMapCollection.astNodeById;

    for (const [key, value] of lexParseOk.nodeIdMapCollection.childIdsById.entries()) {
        actual.push({
            childNodeIds: value,
            id: key,
            kind: Assert.asDefined(astNodeById.get(key)).kind,
        });
    }

    return actual;
}

describe("Parser.Children", () => {
    it(`() as number => 1`, async () => {
        const text: string = `() as number => 1`;

        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [2, 6, 9, 11],
                id: 1,
                kind: Language.Ast.NodeKind.FunctionExpression,
            },
            {
                childNodeIds: [3, 4, 5],
                id: 2,
                kind: Language.Ast.NodeKind.ParameterList,
            },
            {
                childNodeIds: [7, 8],
                id: 6,
                kind: Language.Ast.NodeKind.AsNullablePrimitiveType,
            },
        ];

        const actual: ReadonlyArray<ChildIdsByIdEntry> = createActual(
            await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text),
        );

        expect(actual).to.deep.equal(expected);
    });

    it(`null ?? 1 ?? 2`, async () => {
        const text: string = `null ?? 1 ?? 2`;

        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [6, 8, 10],
                id: 11,
                kind: Language.Ast.NodeKind.NullCoalescingExpression,
            },
            {
                childNodeIds: [2, 4, 11],
                id: 12,
                kind: Language.Ast.NodeKind.NullCoalescingExpression,
            },
        ];

        const actual: ReadonlyArray<ChildIdsByIdEntry> = createActual(
            await AssertTestUtils.assertGetLexParseOk(DefaultSettings, text),
        );

        expect(actual).to.deep.equal(expected);
    });
});
