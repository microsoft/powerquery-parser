// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { NodeIdMap, NodeIdMapUtils, ParseOk } from "../../../powerquery-parser/parser";
import { Ast } from "../../../powerquery-parser/language";
import { DefaultSettings } from "../../..";
import { TestAssertUtils } from "../../testUtils";

function assertGetIdentifierByLiteral(parseOk: ParseOk, identifierLiteral: string): Ast.Identifier {
    const nodeIdMapCollection: NodeIdMap.Collection = parseOk.state.contextState.nodeIdMapCollection;
    const matches: Ast.Identifier[] = [];

    for (const identifierId of nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.Identifier) ?? []) {
        const identifier: Ast.Identifier = NodeIdMapUtils.assertUnboxAstChecked(
            nodeIdMapCollection.astNodeById,
            identifierId,
            Ast.NodeKind.Identifier,
        );

        if (identifier.literal === identifierLiteral) {
            matches.push(identifier);
        }
    }

    if (matches.length === 0) {
        throw new Error(`could not find the following identifier in the ast: ${identifierLiteral}`);
    } else if (matches.length === 1) {
        return matches[0];
    } else {
        throw new Error(`found multiple instances of the following identifier: ${identifierLiteral}`);
    }
}

function assertIdentifierIsInContext(
    parseOk: ParseOk,
    identifierLiteral: string,
    identifierContextKind: Ast.IdentifierContextKind,
): void {
    const identifier: Ast.Identifier = assertGetIdentifierByLiteral(parseOk, identifierLiteral);
    expect(identifier.identifierContextKind).to.equal(identifierContextKind);
}

describe("Parser.IdentifierContextKind", () => {
    it("let foo = 1 in bar", async () => {
        const parseOk: ParseOk = await TestAssertUtils.assertGetParseOk(DefaultSettings, "let foo = 1 in bar");

        assertIdentifierIsInContext(parseOk, "foo", Ast.IdentifierContextKind.Key);
        assertIdentifierIsInContext(parseOk, "bar", Ast.IdentifierContextKind.Value);
    });

    it("let fn = (foo as number) => 1 in 1", async () => {
        const parseOk: ParseOk = await TestAssertUtils.assertGetParseOk(
            DefaultSettings,
            "let fn = (foo as number) => 1 in 1",
        );

        assertIdentifierIsInContext(parseOk, "fn", Ast.IdentifierContextKind.Key);
        assertIdentifierIsInContext(parseOk, "foo", Ast.IdentifierContextKind.Parameter);
    });

    it("let foo = #date in 1", async () => {
        const parseOk: ParseOk = await TestAssertUtils.assertGetParseOk(DefaultSettings, "let foo = #date in 1");

        assertIdentifierIsInContext(parseOk, "foo", Ast.IdentifierContextKind.Key);
        assertIdentifierIsInContext(parseOk, "#date", Ast.IdentifierContextKind.Keyword);
    });
});
