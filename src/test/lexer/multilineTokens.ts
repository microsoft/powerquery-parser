import "mocha";
import { CommentKind, TokenKind } from "../../lexer";
import { AbridgedComments, expectAbridgedComments, AbridgedSnapshot, expectAbridgedSnapshot, expectAbridgedTokens, AbridgedTokens } from "./common";

const LINE_TERMINATOR = "\n"

describe(`Lexer`, () => {
    describe(`MultilineTokens`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const document = `/**/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/**/`],
                ];
                expectAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`/* */`, () => {
                const document = `/* */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* */`],
                ];
                expectAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`/* X */`, () => {
                const document = `/* X */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* X */`],
                ];
                expectAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const document = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`],
                ];
                expectAbridgedComments(document, LINE_TERMINATOR, expected);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const document = `abc /*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`;
                const expected: AbridgedSnapshot =
                {
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]],
                    tokens: [[TokenKind.Identifier, `abc`]],
                };
                expectAbridgedSnapshot(document, LINE_TERMINATOR, expected);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const document = `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/ abc`;
                const expected: AbridgedSnapshot = {
                    tokens: [[TokenKind.Identifier, `abc`]],
                    comments: [[CommentKind.Multiline, `/*X${LINE_TERMINATOR}X${LINE_TERMINATOR}X*/`]]
                };
                expectAbridgedSnapshot(document, LINE_TERMINATOR, expected);
            });
        });

        describe(`StringLiteral`, () => {
            it(`"X"`, () => {
                const document = `"X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X"`],
                ];
                expectAbridgedTokens(document, LINE_TERMINATOR, expected);
            });

            it(`"X\\nX\\nX"`, () => {
                const document = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectAbridgedTokens(document, LINE_TERMINATOR, expected);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const document = `abc "X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.Identifier, `abc`],
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                ];
                expectAbridgedTokens(document, LINE_TERMINATOR, expected);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const document = `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X" abc`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${LINE_TERMINATOR}X${LINE_TERMINATOR}X"`],
                    [TokenKind.Identifier, `abc`],
                ];
                expectAbridgedTokens(document, LINE_TERMINATOR, expected);
            });
        });
    })
});
