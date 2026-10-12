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
    });

    it("observes getter-backed settings after cancellation callbacks", () => {
        let directivesEnabled: boolean = false;

        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            {
                ...DefaultSettings,
                get isTypeDirectiveAllowed(): boolean {
                    return directivesEnabled;
                },
                cancellationToken: {
                    isCancelled: (): boolean => false,
                    cancel: (): void => {},
                    throwIfCancelled: (): void => {
                        directivesEnabled = true;
                    },
                },
            },
            "/// @type Foo\nvalue",
        );

        expect(
            snapshot.getPrecedingDirectives(1)?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["Foo"]);
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

    it("keeps earlier directive prefixes separate and preserves comment references", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            { ...DefaultSettings, isTypeDirectiveAllowed: true },
            "/// @type Foo\n/// @type Bar\n/// @type Baz\nvalue",
        );

        for (let line: number = 1; line <= 3; line += 1) {
            const directives: ReadonlyArray<Language.Comment.TDirective> | undefined =
                snapshot.getPrecedingDirectives(line);

            expect(directives?.map((directive: Language.Comment.TDirective) => directive.value)).to.deep.equal(
                ["Foo", "Bar", "Baz"].slice(0, line),
            );

            directives?.forEach((directive: Language.Comment.TDirective, index: number) => {
                expect(directive.comment).to.equal(snapshot.comments[index]);
            });
        }

        expect(snapshot.getPrecedingDirectives(1)).not.to.equal(snapshot.getPrecedingDirectives(3));
    });

    it("uses document line numbers for directives following a multiline comment", () => {
        const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
            { ...DefaultSettings, isTypeDirectiveAllowed: true },
            "/// @type Foo\r\n/*first\u2028second*/ /// @type Bar\u2029value",
        );

        expect(snapshot.comments[2]?.positionStart.lineNumber).to.equal(2);
        expect(snapshot.tokens[0]?.positionStart.lineNumber).to.equal(3);
        expect(snapshot.getPrecedingDirectives(2)).to.equal(undefined);

        expect(
            snapshot.getPrecedingDirectives(3)?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["Bar"]);

        expect(snapshot.getPrecedingDirectives(3)?.[0]?.comment).to.equal(snapshot.comments[2]);
    });

    for (const newline of ["\n", "\r\n", "\u2028", "\u2029"]) {
        it(`matches constructor-built directive associations with ${JSON.stringify(newline)}`, () => {
            const documents: ReadonlyArray<ReadonlyArray<string>> = [
                ["/// @type Foo", "/// @type Bar", "value"],
                ["/// @type Foo", "", "/// @type Bar", "value"],
                ["/// @type Foo", "// ordinary", "value"],
                ["/// @type Foo", "/* block */ /// @type Bar", "value"],
                ["value /// @type Foo", "next"],
                ["/// @type Foo"],
            ];

            for (const lines of documents) {
                for (const enabled of [false, true]) {
                    const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(
                        { ...DefaultSettings, isTypeDirectiveAllowed: enabled },
                        lines.join(newline),
                    );

                    const reconstructed: Lexer.LexerSnapshot = new Lexer.LexerSnapshot(
                        snapshot.text,
                        snapshot.tokens,
                        snapshot.comments,
                        snapshot.lineTerminators,
                    );

                    for (let line: number = 0; line <= lines.length; line += 1) {
                        expect(snapshot.getPrecedingDirectives(line)).to.deep.equal(
                            reconstructed.getPrecedingDirectives(line),
                        );
                    }
                }
            }
        });
    }
});
