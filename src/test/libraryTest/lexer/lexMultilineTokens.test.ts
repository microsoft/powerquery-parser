// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import {
    AbridgedComments,
    AbridgedLineTokens,
    AbridgedSnapshot,
    AbridgedTokens,
    assertGetAbridgedSnapshotMatch,
    assertGetLineTokenMatch,
    assertGetSnapshotAbridgedComments,
    assertGetSnapshotAbridgedTokens,
} from "../../testUtils/lexTestTestUtils";
import { Language } from "../../..";

const LINE_TERMINATOR: string = "\n";

describe(`Lexer`, () => {
    describe(`MultilineTokens Abridged LineToken`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const text: string = `/**/`;
                const expected: AbridgedLineTokens = [[Language.Token.LineTokenKind.MultilineComment, `/**/`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*/*/`, () => {
                const text: string = `/*/*/`;
                const expected: AbridgedLineTokens = [[Language.Token.LineTokenKind.MultilineComment, `/*/*/`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*\\n*/`, () => {
                const text: string = `/*${LINE_TERMINATOR}*/`;

                const expected: AbridgedLineTokens = [
                    [Language.Token.LineTokenKind.MultilineCommentStart, `/*`],
                    [Language.Token.LineTokenKind.MultilineCommentEnd, `*/`],
                ];

                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*\\nfoobar\\n*/`, () => {
                const text: string = `/*${LINE_TERMINATOR}foobar${LINE_TERMINATOR}*/`;

                const expected: AbridgedLineTokens = [
                    [Language.Token.LineTokenKind.MultilineCommentStart, `/*`],
                    [Language.Token.LineTokenKind.MultilineCommentContent, `foobar`],
                    [Language.Token.LineTokenKind.MultilineCommentEnd, `*/`],
                ];

                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*\\n\nfoobar\\n\\n*/`, () => {
                const text: string = `/*${LINE_TERMINATOR}${LINE_TERMINATOR}foobar${LINE_TERMINATOR}${LINE_TERMINATOR}*/`;

                const expected: AbridgedLineTokens = [
                    [Language.Token.LineTokenKind.MultilineCommentStart, `/*`],
                    [Language.Token.LineTokenKind.MultilineCommentContent, `foobar`],
                    [Language.Token.LineTokenKind.MultilineCommentEnd, `*/`],
                ];

                assertGetLineTokenMatch(text, expected, true);
            });
        });

        describe(`TextLiteral`, () => {
            it(`""`, () => {
                const text: string = `""`;
                const expected: AbridgedLineTokens = [[Language.Token.LineTokenKind.TextLiteral, `""`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`"\\n"`, () => {
                const text: string = `"${LINE_TERMINATOR}"`;

                const expected: AbridgedLineTokens = [
                    [Language.Token.LineTokenKind.TextLiteralStart, `"`],
                    [Language.Token.LineTokenKind.TextLiteralEnd, `"`],
                ];

                assertGetLineTokenMatch(text, expected, true);
            });

            it(`"\\nfoobar\\n"`, () => {
                const text: string = `"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;

                const expected: AbridgedLineTokens = [
                    [Language.Token.LineTokenKind.TextLiteralStart, `"`],
                    [Language.Token.LineTokenKind.TextLiteralContent, `foobar`],
                    [Language.Token.LineTokenKind.TextLiteralEnd, `"`],
                ];

                assertGetLineTokenMatch(text, expected, true);
            });
        });

        describe(`QuotedIdentifer`, () => {
            it(`""`, () => {
                const text: string = `#""`;
                const expected: AbridgedLineTokens = [[Language.Token.LineTokenKind.Identifier, `#""`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`#"\\n"`, () => {
                const text: string = `#"${LINE_TERMINATOR}"`;

                const expected: AbridgedLineTokens = [
                    [Language.Token.LineTokenKind.QuotedIdentifierStart, `#"`],
                    [Language.Token.LineTokenKind.QuotedIdentifierEnd, `"`],
                ];

                assertGetLineTokenMatch(text, expected, true);
            });

            it(`#"\\nfoobar\\n"`, () => {
                const text: string = `#"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;

                const expected: AbridgedLineTokens = [
                    [Language.Token.LineTokenKind.QuotedIdentifierStart, `#"`],
                    [Language.Token.LineTokenKind.QuotedIdentifierContent, `foobar`],
                    [Language.Token.LineTokenKind.QuotedIdentifierEnd, `"`],
                ];

                assertGetLineTokenMatch(text, expected, true);
            });
        });
    });

    describe(`MultilineTokens Abridged LexerSnapshot`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const text: string = `/**/`;
                const expected: AbridgedComments = [[Language.Comment.CommentKind.Multiline, `/**/`]];
                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`/* */`, () => {
                const text: string = `/* */`;
                const expected: AbridgedComments = [[Language.Comment.CommentKind.Multiline, `/* */`]];
                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`/* X */`, () => {
                const text: string = `/* X */`;
                const expected: AbridgedComments = [[Language.Comment.CommentKind.Multiline, `/* X */`]];
                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const text: string = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;

                const expected: AbridgedComments = [
                    [Language.Comment.CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`],
                ];

                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const text: string = `abc /*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;

                const expected: AbridgedSnapshot = {
                    comments: [[Language.Comment.CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                    tokens: [[Language.Token.TokenKind.Identifier, `abc`]],
                };

                assertGetAbridgedSnapshotMatch(text, expected, true);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const text: string = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/ abc`;

                const expected: AbridgedSnapshot = {
                    tokens: [[Language.Token.TokenKind.Identifier, `abc`]],
                    comments: [[Language.Comment.CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                };

                assertGetAbridgedSnapshotMatch(text, expected, true);
            });
        });

        describe(`TextLiteral`, () => {
            it(`"X"`, () => {
                const text: string = `"X"`;
                const expected: AbridgedTokens = [[Language.Token.TokenKind.TextLiteral, `"X"`]];
                assertGetSnapshotAbridgedTokens(text, expected, true);
            });

            it(`"X\\nX\\nX"`, () => {
                const text: string = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;

                const expected: AbridgedTokens = [
                    [Language.Token.TokenKind.TextLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];

                assertGetSnapshotAbridgedTokens(text, expected, true);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const text: string = `abc "X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;

                const expected: AbridgedTokens = [
                    [Language.Token.TokenKind.Identifier, `abc`],
                    [Language.Token.TokenKind.TextLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];

                assertGetSnapshotAbridgedTokens(text, expected, true);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const text: string = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X" abc`;

                const expected: AbridgedTokens = [
                    [Language.Token.TokenKind.TextLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                    [Language.Token.TokenKind.Identifier, `abc`],
                ];

                assertGetSnapshotAbridgedTokens(text, expected, true);
            });
        });
    });
});
