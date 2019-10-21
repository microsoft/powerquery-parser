// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultKind } from "../../common";
import { LexAndParseOk, TriedLexAndParse, tryLexAndParse } from "../../jobs";
import { Ast, NodeIdMap } from "../../parser";
import { CombinatorialParser } from "../../parser/parsers";

interface ChildIdsByIdEntry {
    readonly childNodeIds: ReadonlyArray<number>;
    readonly id: number;
    readonly kind: Ast.NodeKind;
}

function expectLexAndParseOk(text: string): LexAndParseOk {
    const triedLexAndParse: TriedLexAndParse = tryLexAndParse(text, CombinatorialParser);
    if (!(triedLexAndParse.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedLexAndParse.kind === ResultKind.Ok: ${triedLexAndParse.error.message}`);
    }
    return triedLexAndParse.value;
}

function expectChildrenEqual(text: string, expected: ReadonlyArray<ChildIdsByIdEntry>): void {
    const actual: ChildIdsByIdEntry[] = [];
    const lexAndParseOk: LexAndParseOk = expectLexAndParseOk(text);
    const astNodeById: NodeIdMap.AstNodeById = lexAndParseOk.nodeIdMapCollection.astNodeById;
    for (const [key, value] of lexAndParseOk.nodeIdMapCollection.childIdsById.entries()) {
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
                childNodeIds: [2, 6, 10, 17],
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
