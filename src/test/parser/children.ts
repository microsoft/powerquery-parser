// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultUtils } from "../../common";
import { Ast, NodeIdMap, Parser } from "../../parser";
import { LexParseOk, TriedLexParse, tryLexParse } from "../../tasks";

interface ChildIdsByIdEntry {
    readonly childNodeIds: ReadonlyArray<number>;
    readonly id: number;
    readonly kind: Ast.NodeKind;
}

function expectLexParseOk(text: string): LexParseOk {
    const triedLexParse: TriedLexParse = tryLexParse(text, Parser.CombinatorialParser);
    if (!ResultUtils.isOk(triedLexParse)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedLexParse): ${triedLexParse.error.message}`);
    }
    return triedLexParse.value;
}

function expectChildrenEqual(text: string, expected: ReadonlyArray<ChildIdsByIdEntry>): void {
    const actual: ChildIdsByIdEntry[] = [];
    const lexParseOk: LexParseOk = expectLexParseOk(text);
    const astNodeById: NodeIdMap.AstNodeById = lexParseOk.nodeIdMapCollection.astNodeById;
    for (const [key, value] of lexParseOk.nodeIdMapCollection.childIdsById.entries()) {
        actual.push({
            childNodeIds: value,
            id: key,
            kind: astNodeById.get(key)!.kind,
        });
    }
    expect(actual).deep.equal(expected, JSON.stringify(actual));
}

describe("Parser.Children", () => {
    it(`() as number => 1`, () => {
        const text: string = `() as number => 1`;
        const expected: ReadonlyArray<ChildIdsByIdEntry> = [
            {
                childNodeIds: [2, 6, 10, 12],
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
        expectChildrenEqual(text, expected);
    });
});
