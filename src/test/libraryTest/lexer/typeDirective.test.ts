// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Language, Lexer, ResultUtils } from "../../..";

function assertGetLexerSnapshot(settings: typeof DefaultSettings, text: string): Lexer.LexerSnapshot {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    ResultUtils.assertIsOk(triedLex);

    return triedLex.value;
}

describe("Lexer type directives", () => {
    it("do not populate line-comment directives when disabled", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(DefaultSettings, "/// @type Resource.Type\nvalue");

        const comment: Language.Comment.LineComment = snapshot.comments[0] as Language.Comment.LineComment;

        expect(comment.directive).to.equal(undefined);
        expect(snapshot.getPrecedingDirectives(1)).to.equal(undefined);
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

    it("precomputes contiguous preceding directives by line number", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            "/// @type Foo\n/// @type Bar\nvalue",
        );

        expect(
            snapshot.getPrecedingDirectives(2)?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["Foo", "Bar"]);
    });

    it("breaks the precomputed chain on non-directive comments", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            "/// @type Foo\n// not a directive\n/// @type Bar\nvalue",
        );

        expect(
            snapshot.getPrecedingDirectives(3)?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["Bar"]);
    });

    it("derives directive associations solely from comments when constructing a snapshot", () => {
        const original: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            { ...DefaultSettings, isTypeDirectiveAllowed: true },
            "/// @type Foo\n/// @type Bar\nvalue\n\nother",
        );

        const snapshot: Lexer.LexerSnapshot = new Lexer.LexerSnapshot(
            original.text,
            original.tokens,
            original.comments,
            original.lineTerminators,
        );

        expect(snapshot.getPrecedingDirectives(2)).to.deep.equal(original.getPrecedingDirectives(2));
        expect(snapshot.getPrecedingDirectives(2)?.length).to.equal(2);
        expect(snapshot.getPrecedingDirectives(2)?.[0]?.comment).to.equal(snapshot.comments[0]);
        expect(snapshot.getPrecedingDirectives(2)?.[1]?.comment).to.equal(snapshot.comments[1]);
        expect(snapshot.getPrecedingDirectives(4)).to.equal(undefined);
    });

    for (const [text, expectedValue] of [
        ["// ordinary", undefined],
        ["/// @type", undefined],
        ["/// @type \t", undefined],
        ["/// @typeX Foo", undefined],
        ["/// @type\u00a0Foo", undefined],
        ["///@type Foo", "Foo"],
        ["///\t@type\tFoo \t", "Foo"],
    ] as const) {
        it(`preserves comment construction for ${JSON.stringify(text)}`, () => {
            for (const isTypeDirectiveAllowed of [false, true]) {
                const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
                    { ...DefaultSettings, isTypeDirectiveAllowed },
                    ` \t${text}\r\nvalue`,
                );

                const comment: Language.Comment.TComment | undefined = snapshot.comments[0];

                if (comment?.kind !== Language.Comment.CommentKind.Line) {
                    throw new Error("Expected a line comment");
                }

                expect(comment.data).to.equal(text);
                expect(comment.containsNewline).to.equal(true);
                expect(comment.positionStart).to.deep.equal({ codeUnit: 2, lineNumber: 0, lineCodeUnit: 2 });

                expect(comment.positionEnd).to.deep.equal({
                    codeUnit: text.length + 2,
                    lineNumber: 0,
                    lineCodeUnit: text.length + 2,
                });

                if (isTypeDirectiveAllowed && expectedValue !== undefined) {
                    expect(comment.directive?.value).to.equal(expectedValue);
                    expect(comment.directive?.comment).to.equal(comment);
                    expect(snapshot.getPrecedingDirectives(1)).to.deep.equal([comment.directive]);
                } else {
                    expect(comment.directive).to.equal(undefined);
                    expect(snapshot.getPrecedingDirectives(1)).to.equal(undefined);
                }
            }
        });
    }
});
