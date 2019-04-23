import "mocha";
import { LexerSnapshot, TokenKind } from "../../lexer";
import { expectAbridgedTokens } from "./common";

function expectWrappedAbridgedTokens(
    document: string,
    separator: string,
    expected: ReadonlyArray<[TokenKind, string]>
): LexerSnapshot {
    const newDocument = `wrapperOpen${separator}${document}${separator}wrapperClose`;
    const newExpected: ReadonlyArray<[TokenKind, string]> = [
        [TokenKind.Identifier, "wrapperOpen"],
        ...expected,
        [TokenKind.Identifier, "wrapperClose"],
    ];
    expectAbridgedTokens(newDocument, separator, newExpected);
    return expectAbridgedTokens(document, separator, expected);
}

describe(`Lexer`, () => {
    describe(`MultilineTokens`, () => {
        describe(`MultilineComment`, () => {
            it(`/**/`, () => {
                const separator = "\n";
                const document = `/**/`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.MultilineComment, `/**/`],
                ];
                expectWrappedAbridgedTokens(document, separator, expected);
            });

            it(`/* */`, () => {
                const seperator = "\n";
                const document = `/* */`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.MultilineComment, `/* */`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });

            it(`/* X */`, () => {
                const seperator = "\n";
                const document = `/* X */`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.MultilineComment, `/* X */`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });

            it(`/*X\\nX\\nX*/`, () => {
                const seperator = "\n";
                const document = `/*X${seperator}X${seperator}X*/`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.MultilineComment, `/*X${seperator}X${seperator}X*/`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });

            it(`abc /*X\\nX\\nX*/`, () => {
                const seperator = "\n";
                const document = `abc /*X${seperator}X${seperator}X*/`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.Identifier, `abc`],
                    [TokenKind.MultilineComment, `/*X${seperator}X${seperator}X*/`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });

            it(`/*X\\nX\\nX*/ abc`, () => {
                const seperator = "\n";
                const document = `/*X${seperator}X${seperator}X*/ abc`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.MultilineComment, `/*X${seperator}X${seperator}X*/`],
                    [TokenKind.Identifier, `abc`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });
        })

        describe(`StringLiteral`, () => {
            it(`"X"`, () => {
                const separator = "\n";
                const document = `"X"`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.StringLiteral, `"X"`],
                ];
                expectWrappedAbridgedTokens(document, separator, expected);
            });

            it(`"X\\nX\\nX"`, () => {
                const seperator = "\n";
                const document = `"X${seperator}X${seperator}X"`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.StringLiteral, `"X${seperator}X${seperator}X"`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });

            it(`abc "X\\nX\\nX"`, () => {
                const seperator = "\n";
                const document = `abc "X${seperator}X${seperator}X"`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.Identifier, `abc`],
                    [TokenKind.StringLiteral, `"X${seperator}X${seperator}X"`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });

            it(`"X\\nX\\nX" abc`, () => {
                const seperator = "\n";
                const document = `"X${seperator}X${seperator}X" abc`;
                const expected: ReadonlyArray<[TokenKind, string]> = [
                    [TokenKind.StringLiteral, `"X${seperator}X${seperator}X"`],
                    [TokenKind.Identifier, `abc`],
                ];
                expectWrappedAbridgedTokens(document, seperator, expected);
            });
        })
    })
});
