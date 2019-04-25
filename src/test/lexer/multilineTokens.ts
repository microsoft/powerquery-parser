import "mocha";
import { CommentKind, LineTokenKind, TokenKind } from "../../lexer";
import { AbridgedComments, AbridgedLineTokens, AbridgedSnapshot, AbridgedTokens, expectAbridgedSnapshotMatch, expectLineTokenMatch, expectSnapshotAbridgedComments, expectSnapshotAbridgedTokens } from "./common";

const LINE_TERMINATOR = "\n"

describe(`Lexer`, () => {
    describe(`MultilineTokens Abridged LineToken`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const document = `/**/`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.MultilineComment, `/**/`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });

            it(`/*\\n*/`, () => {
                const document = `/*${LINE_TERMINATOR}*/`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.MultilineCommentStart, `/*`],
                    [LineTokenKind.MultilineCommentEnd, `*/`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });

            it(`/*\\nfoobar\\n*/`, () => {
                const document = `/*${LINE_TERMINATOR}foobar${LINE_TERMINATOR}*/`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.MultilineCommentStart, `/*`],
                    [LineTokenKind.MultilineCommentContent, `foobar`],
                    [LineTokenKind.MultilineCommentEnd, `*/`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });
        });

        describe(`StringLiteral`, () => {
            it(`""`, () => {
                const document = `""`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.StringLiteral, `""`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });

            it(`"\\n"`, () => {
                const document = `"${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.StringLiteralStart, `"`],
                    [LineTokenKind.StringLiteralEnd, `"`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });

            it(`"\\nfoobar\\n"`, () => {
                const document = `"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.StringLiteralStart, `"`],
                    [LineTokenKind.StringLiteralContent, `foobar`],
                    [LineTokenKind.StringLiteralEnd, `"`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });
        });

        describe(`QuotedIdentiifer`, () => {
            it(`""`, () => {
                const document = `#""`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.Identifier, `#""`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });

            it(`#"\\n"`, () => {
                const document = `#"${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.QuotedIdentifierStart, `#"`],
                    [LineTokenKind.QuotedIdentifierEnd, `"`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });

            it(`#"\\nfoobar\\n"`, () => {
                const document = `#"${LINE_TERMINATOR}foobar${LINE_TERMINATOR}"`;
                const expected: AbridgedLineTokens = [
                    [LineTokenKind.QuotedIdentifierStart, `#"`],
                    [LineTokenKind.QuotedIdentifierContent, `foobar`],
                    [LineTokenKind.QuotedIdentifierEnd, `"`],
                ];
                expectLineTokenMatch(document, LINE_TERMINATOR, expected, true);
            });
        });
    });

    describe(`MultilineTokens Abridged LexerSnapshot`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const document = `/**/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/**/`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected, true);
            });

            it(`/* */`, () => {
                const document = `/* */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* */`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected, true);
            });

            it(`/* X */`, () => {
                const document = `/* X */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* X */`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected, true);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const document = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`],
                ];
                expectSnapshotAbridgedComments(document, LINE_TERMINATOR, expected, true);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const document = `abc /*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedSnapshot =
                {
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                    tokens: [[TokenKind.Identifier, `abc`]],
                };
                expectAbridgedSnapshotMatch(document, LINE_TERMINATOR, expected, true);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const document = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/ abc`;
                const expected: AbridgedSnapshot = {
                    tokens: [[TokenKind.Identifier, `abc`]],
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]]
                };
                expectAbridgedSnapshotMatch(document, LINE_TERMINATOR, expected, true);
            });
        });

        describe(`StringLiteral`, () => {
            it(`"X"`, () => {
                const document = `"X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X"`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected, true);
            });

            it(`"X\\nX\\nX"`, () => {
                const document = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected, true);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const document = `abc "X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.Identifier, `abc`],
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected, true);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const document = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X" abc`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                    [TokenKind.Identifier, `abc`],
                ];
                expectSnapshotAbridgedTokens(document, LINE_TERMINATOR, expected, true);
            });
        });
    })
});
