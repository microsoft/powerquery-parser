// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import {
    AbridgedComments,
    AbridgedSnapshot,
    AbridgedTokens,
    assertGetAbridgedSnapshotMatch,
    assertGetSnapshotAbridgedComments,
    assertGetSnapshotAbridgedTokens,
} from "../../testUtils/lexTestUtils";
import { Language } from "../../..";

const LINE_TERMINATOR: string = "\n";

describe(`Lexer`, () => {
    describe("Complete multiline token emission", () => {
        for (const text of ["/**/", "/*/*/", "/*\n*/", "/*\nfoobar\n*/", "/*\n\nfoobar\n\n*/"]) {
            it(JSON.stringify(text), () => {
                assertGetSnapshotAbridgedComments(text, [[Language.Comment.CommentKind.Multiline, text]], true);
            });
        }

        for (const text of ['""', '"\n"', '"\nfoobar\n"', '#""', '#"\n"', '#"\nfoobar\n"']) {
            it(JSON.stringify(text), () => {
                const kind: Language.Token.TokenKind = text.startsWith("#")
                    ? Language.Token.TokenKind.Identifier
                    : Language.Token.TokenKind.TextLiteral;

                assertGetSnapshotAbridgedTokens(text, [[kind, text]], true);
            });
        }
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
