// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as AssertTestUtils from "../../testUtils/assertTestUtils";
import { DefaultSettings, Language } from "../../../powerquery-parser";

type ParseOk = Awaited<ReturnType<typeof AssertTestUtils.assertGetLexParseOk>>;

describe("Type directives", () => {
    it("are disabled by default for let bindings", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            DefaultSettings,
            `let
    /// @type [ Foo = text ]
    value = []
in
    value`,
        );

        const letExpression: Language.Ast.LetExpression = parseOk.ast as Language.Ast.LetExpression;
        const variable: Language.Ast.IdentifierPairedExpression = letExpression.variableList.elements[0].node;

        expect(variable.precedingDirectives).to.equal(undefined);
    });

    it("attach to let bindings when explicitly enabled", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            `let
    /// @type [ Foo = text ]
    value = []
in
    value`,
        );

        const letExpression: Language.Ast.LetExpression = parseOk.ast as Language.Ast.LetExpression;
        const variable: Language.Ast.IdentifierPairedExpression = letExpression.variableList.elements[0].node;

        expect(variable.precedingDirectives).to.not.equal(undefined);

        expect(
            variable.precedingDirectives?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["[ Foo = text ]"]);
    });

    it("attach to section members before shared", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            `section Test;
/// @type Resource.Type
shared Value = [];`,
        );

        const section: Language.Ast.Section = parseOk.ast as Language.Ast.Section;
        const sectionMember: Language.Ast.SectionMember = section.sectionMembers.elements[0];

        expect(
            sectionMember.precedingDirectives?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["Resource.Type"]);
    });

    it("do not attach when a non-directive comment is closer than the directive", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            `let
    /// @type [ Foo = text ]
    // ordinary comment
    value = []
in
    value`,
        );

        const letExpression: Language.Ast.LetExpression = parseOk.ast as Language.Ast.LetExpression;
        const variable: Language.Ast.IdentifierPairedExpression = letExpression.variableList.elements[0].node;

        expect(variable.precedingDirectives).to.equal(undefined);
    });
});
