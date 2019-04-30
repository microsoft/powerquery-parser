import "mocha";
import { CommentKind, LineTokenKind, TokenKind } from "../../lexer";
import { AbridgedComments, AbridgedLineTokens, AbridgedSnapshot, AbridgedTokens, expectAbridgedSnapshotMatch, expectLineTokenMatch, expectSnapshotAbridgedComments, expectSnapshotAbridgedTokens } from "./common";

const LINE_TERMINATOR = "\n"

describe(`Lexer`, () => {
    describe(`MultilineTokens Abridged LineToken`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const text = `/**/`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.MultilineComment, `/**/`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });

            it(`/*\\n*/`, () => {
                const text = `/*${LINE_TERMINATOR}*/`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.MultilineCommentStart, `/*`],
                    [LineTokenKind.MultilineCommentEnd, `*/`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });

            it(`/*\\nfoobar\\n*/`, () => {
                const text = `/*${LINE_TERMINATOR}foobar${LINE_TERMINATOR}*/`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.MultilineCommentStart, `/*`],
                    [LineTokenKind.MultilineCommentContent, `foobar`],
                    [LineTokenKind.MultilineCommentEnd, `*/`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });
        });

        describe(`StringLiteral`, () => {
            it(`""`, () => {
                const text = `""`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.StringLiteral, `""`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });

            it(`"\\n"`, () => {
                const text = `"${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.StringLiteralStart, `"`],
                    [LineTokenKind.StringLiteralEnd, `"`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });

            it(`"\\nfoobar\\n"`, () => {
                const text = `"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.StringLiteralStart, `"`],
                    [LineTokenKind.StringLiteralContent, `foobar`],
                    [LineTokenKind.StringLiteralEnd, `"`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });
        });

        describe(`QuotedIdentiifer`, () => {
            it(`""`, () => {
                const text = `#""`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.Identifier, `#""`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });

            it(`#"\\n"`, () => {
                const text = `#"${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.QuotedIdentifierStart, `#"`],
                    [LineTokenKind.QuotedIdentifierEnd, `"`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });

            it(`#"\\nfoobar\\n"`, () => {
                const text = `#"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.QuotedIdentifierStart, `#"`],
                    [LineTokenKind.QuotedIdentifierContent, `foobar`],
                    [LineTokenKind.QuotedIdentifierEnd, `"`],
                ];
                expectLineTokenMatch(text, LINE_TERMINATOR, expected, true);
            });
        });
    });

    describe(`MultilineTokens Abridged LexerSnapshot`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const text = `/**/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/**/`],
                ];
                expectSnapshotAbridgedComments(text, LINE_TERMINATOR, expected, true);
            });

            it(`/* */`, () => {
                const text = `/* */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* */`],
                ];
                expectSnapshotAbridgedComments(text, LINE_TERMINATOR, expected, true);
            });

            it(`/* X */`, () => {
                const text = `/* X */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* X */`],
                ];
                expectSnapshotAbridgedComments(text, LINE_TERMINATOR, expected, true);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const text = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`],
                ];
                expectSnapshotAbridgedComments(text, LINE_TERMINATOR, expected, true);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const text = `abc /*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedSnapshot =
                {
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                    tokens: [[TokenKind.Identifier, `abc`]],
                };
                expectAbridgedSnapshotMatch(text, LINE_TERMINATOR, expected, true);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const text = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/ abc`;
                const expected: AbridgedSnapshot = {
                    tokens: [[TokenKind.Identifier, `abc`]],
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]]
                };
                expectAbridgedSnapshotMatch(text, LINE_TERMINATOR, expected, true);
            });
        });

        describe(`StringLiteral`, () => {
            it(`"X"`, () => {
                const text = `"X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X"`],
                ];
                expectSnapshotAbridgedTokens(text, LINE_TERMINATOR, expected, true);
            });

            it(`"X\\nX\\nX"`, () => {
                const text = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectSnapshotAbridgedTokens(text, LINE_TERMINATOR, expected, true);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const text = `abc "X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.Identifier, `abc`],
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectSnapshotAbridgedTokens(text, LINE_TERMINATOR, expected, true);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const text = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X" abc`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                    [TokenKind.Identifier, `abc`],
                ];
                expectSnapshotAbridgedTokens(text, LINE_TERMINATOR, expected, true);
            });
        });
    })
});
