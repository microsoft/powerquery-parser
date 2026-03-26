// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Language, Lexer, ResultUtils } from "../../..";

function assertGetLexerSnapshot(settings: typeof DefaultSettings, text: string): Lexer.LexerSnapshot {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    ResultUtils.assertIsOk(triedLex);

    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(triedLex.value);
    ResultUtils.assertIsOk(triedSnapshot);

    return triedSnapshot.value;
}

describe("Lexer type directives", () => {
    it("do not populate line-comment directives when disabled", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(DefaultSettings, "/// @type Resource.Type\nvalue");

        const comment: Language.Comment.LineComment = snapshot.comments[0] as Language.Comment.LineComment;

        expect(comment.directive).to.equal(undefined);
    });

    it("populate line-comment directives when enabled", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            "/// @type Resource.Type\nvalue",
        );

        const comment: Language.Comment.LineComment = snapshot.comments[0] as Language.Comment.LineComment;

        expect(comment.directive?.value).to.equal("Resource.Type");
        expect(comment.directive?.comment).to.equal(comment);
    });

    it("accept tabs and trailing spaces in lexer-recognized directives", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            "\t///\t@type\tResource.Type   \nvalue",
        );

        const comment: Language.Comment.LineComment = snapshot.comments[0] as Language.Comment.LineComment;

        expect(comment.directive?.value).to.equal("Resource.Type");
    });
});
