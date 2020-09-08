// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Comment, Token } from "../../../language";
import {
    AbridgedComments,
    AbridgedLineTokens,
    AbridgedSnapshot,
    AbridgedTokens,
    assertGetAbridgedSnapshotMatch,
    assertGetLineTokenMatch,
    assertGetSnapshotAbridgedComments,
    assertGetSnapshotAbridgedTokens,
} from "./common";

const LINE_TERMINATOR: string = "\n";

describe(`Lexer`, () => {
    describe(`MultilineTokens Abridged LineToken`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const text: string = `/**/`;
                const expected: AbridgedLineTokens = [[Token.LineTokenKind.MultilineComment, `/**/`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*/*/`, () => {
                const text: string = `/*/*/`;
                const expected: AbridgedLineTokens = [[Token.LineTokenKind.MultilineComment, `/*/*/`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*\\n*/`, () => {
                const text: string = `/*${LINE_TERMINATOR}*/`;
                const expected: AbridgedLineTokens = [
                    [Token.LineTokenKind.MultilineCommentStart, `/*`],
                    [Token.LineTokenKind.MultilineCommentEnd, `*/`],
                ];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*\\nfoobar\\n*/`, () => {
                const text: string = `/*${LINE_TERMINATOR}foobar${LINE_TERMINATOR}*/`;
                const expected: AbridgedLineTokens = [
                    [Token.LineTokenKind.MultilineCommentStart, `/*`],
                    [Token.LineTokenKind.MultilineCommentContent, `foobar`],
                    [Token.LineTokenKind.MultilineCommentEnd, `*/`],
                ];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`/*\\n\nfoobar\\n\\n*/`, () => {
                const text: string = `/*${LINE_TERMINATOR}${LINE_TERMINATOR}foobar${LINE_TERMINATOR}${LINE_TERMINATOR}*/`;
                const expected: AbridgedLineTokens = [
                    [Token.LineTokenKind.MultilineCommentStart, `/*`],
                    [Token.LineTokenKind.MultilineCommentContent, `foobar`],
                    [Token.LineTokenKind.MultilineCommentEnd, `*/`],
                ];
                assertGetLineTokenMatch(text, expected, true);
            });
        });

        describe(`TextLiteral`, () => {
            it(`""`, () => {
                const text: string = `""`;
                const expected: AbridgedLineTokens = [[Token.LineTokenKind.TextLiteral, `""`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`"\\n"`, () => {
                const text: string = `"${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [Token.LineTokenKind.TextLiteralStart, `"`],
                    [Token.LineTokenKind.TextLiteralEnd, `"`],
                ];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`"\\nfoobar\\n"`, () => {
                const text: string = `"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [Token.LineTokenKind.TextLiteralStart, `"`],
                    [Token.LineTokenKind.TextLiteralContent, `foobar`],
                    [Token.LineTokenKind.TextLiteralEnd, `"`],
                ];
                assertGetLineTokenMatch(text, expected, true);
            });
        });

        describe(`QuotedIdentifer`, () => {
            it(`""`, () => {
                const text: string = `#""`;
                const expected: AbridgedLineTokens = [[Token.LineTokenKind.Identifier, `#""`]];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`#"\\n"`, () => {
                const text: string = `#"${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [Token.LineTokenKind.QuotedIdentifierStart, `#"`],
                    [Token.LineTokenKind.QuotedIdentifierEnd, `"`],
                ];
                assertGetLineTokenMatch(text, expected, true);
            });

            it(`#"\\nfoobar\\n"`, () => {
                const text: string = `#"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [Token.LineTokenKind.QuotedIdentifierStart, `#"`],
                    [Token.LineTokenKind.QuotedIdentifierContent, `foobar`],
                    [Token.LineTokenKind.QuotedIdentifierEnd, `"`],
                ];
                assertGetLineTokenMatch(text, expected, true);
            });
        });
    });

    describe(`MultilineTokens Abridged LexerSnapshot`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const text: string = `/**/`;
                const expected: AbridgedComments = [[Comment.CommentKind.Multiline, `/**/`]];
                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`/* */`, () => {
                const text: string = `/* */`;
                const expected: AbridgedComments = [[Comment.CommentKind.Multiline, `/* */`]];
                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`/* X */`, () => {
                const text: string = `/* X */`;
                const expected: AbridgedComments = [[Comment.CommentKind.Multiline, `/* X */`]];
                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const text: string = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedComments = [
                    [Comment.CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`],
                ];
                assertGetSnapshotAbridgedComments(text, expected, true);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const text: string = `abc /*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedSnapshot = {
                    comments: [[Comment.CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                    tokens: [[Token.TokenKind.Identifier, `abc`]],
                };
                assertGetAbridgedSnapshotMatch(text, expected, true);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const text: string = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/ abc`;
                const expected: AbridgedSnapshot = {
                    tokens: [[Token.TokenKind.Identifier, `abc`]],
                    comments: [[Comment.CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                };
                assertGetAbridgedSnapshotMatch(text, expected, true);
            });
        });

        describe(`TextLiteral`, () => {
            it(`"X"`, () => {
                const text: string = `"X"`;
                const expected: AbridgedTokens = [[Token.TokenKind.TextLiteral, `"X"`]];
                assertGetSnapshotAbridgedTokens(text, expected, true);
            });

            it(`"X\\nX\\nX"`, () => {
                const text: string = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [Token.TokenKind.TextLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                assertGetSnapshotAbridgedTokens(text, expected, true);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const text: string = `abc "X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [Token.TokenKind.Identifier, `abc`],
                    [Token.TokenKind.TextLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                assertGetSnapshotAbridgedTokens(text, expected, true);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const text: string = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X" abc`;
                const expected: AbridgedTokens = [
                    [Token.TokenKind.TextLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                    [Token.TokenKind.Identifier, `abc`],
                ];
                assertGetSnapshotAbridgedTokens(text, expected, true);
            });
        });
    });
});
