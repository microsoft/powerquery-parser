// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Language, Parser, Task } from "../../..";
import { TestAssertUtils } from "../../testUtils";

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
                childNodeIds: [2, 6, 9, 12],
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
            await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text),
        );

        expect(actual).to.deep.equal(expected);
    });

    it(`null ?? 1 ?? 2`, async () => {
        const text: string = `null ?? 1 ?? 2`;

        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [3, 4, 5],
                id: 8,
                kind: Language.Ast.NodeKind.NullCoalescingExpression,
            },
            {
                childNodeIds: [8, 6, 7],
                id: 9,
                kind: Language.Ast.NodeKind.NullCoalescingExpression,
            },
        ];

        const actual: ReadonlyArray<ChildIdsByIdEntry> = createActual(
            await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text),
        );

        expect(actual).to.deep.equal(expected);
    });
});
