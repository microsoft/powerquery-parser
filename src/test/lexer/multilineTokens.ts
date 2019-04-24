import "mocha";
import { CommentKind, TokenKind } from "../../lexer";
import { AbridgedComments, expectAbridgedComments, AbridgedSnapshot, expectAbridgedSnapshot, expectAbridgedTokens, AbridgedTokens } from "./common";

describe(`Lexer`, () => {
    describe(`MultilineTokens`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const separator = "\n";
                const document = `/**/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/**/`],
                ];
                expectAbridgedComments(document, separator, expected);
            });

            it(`/* */`, () => {
                const seperator = "\n";
                const document = `/* */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* */`],
                ];
                expectAbridgedComments(document, seperator, expected);
            });

            it(`/* X */`, () => {
                const seperator = "\n";
                const document = `/* X */`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/* X */`],
                ];
                expectAbridgedComments(document, seperator, expected);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const seperator = "\n";
                const document = `/*X${seperator}X${seperator}X*/`;
                const expected: AbridgedComments = [
                    [CommentKind.Multiline, `/*X${seperator}X${seperator}X*/`],
                ];
                expectAbridgedComments(document, seperator, expected);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const seperator = "\n";
                const document = `abc /*X${seperator}X${seperator}X*/`;
                const expected: AbridgedSnapshot =
                {
                    comments: [[CommentKind.Multiline, `/*X${seperator}X${seperator}X*/`]],
                    tokens: [[TokenKind.Identifier, `abc`]],
                };
                expectAbridgedSnapshot(document, seperator, expected);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const seperator = "\n";
                const document = `/*X${seperator}X${seperator}X*/ abc`;
                const expected: AbridgedSnapshot = {
                    tokens: [[TokenKind.Identifier, `abc`]],
                    comments: [[CommentKind.Multiline, `/*X${seperator}X${seperator}X*/`]]
                };
                expectAbridgedSnapshot(document, seperator, expected);
            });
        });

        describe(`StringLiteral`, () => {
            it(`"X"`, () => {
                const separator = "\n";
                const document = `"X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X"`],
                ];
                expectAbridgedTokens(document, separator, expected);
            });

            it(`"X\\nX\\nX"`, () => {
                const seperator = "\n";
                const document = `"X${seperator}X${seperator}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${seperator}X${seperator}X"`],
                ];
                expectAbridgedTokens(document, seperator, expected);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const seperator = "\n";
                const document = `abc "X${seperator}X${seperator}X"`;
                const expected: AbridgedTokens = [
                    [TokenKind.Identifier, `abc`],
                    [TokenKind.StringLiteral, `"X${seperator}X${seperator}X"`],
                ];
                expectAbridgedTokens(document, seperator, expected);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const seperator = "\n";
                const document = `"X${seperator}X${seperator}X" abc`;
                const expected: AbridgedTokens = [
                    [TokenKind.StringLiteral, `"X${seperator}X${seperator}X"`],
                    [TokenKind.Identifier, `abc`],
                ];
                expectAbridgedTokens(document, seperator, expected);
            });
        });
    })
});
