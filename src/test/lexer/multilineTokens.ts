import "mocha";
import { TokenKind, LexerSnapshot, LineTokenKind } from "../../lexer";
import { expectAbridgedTokens } from "./common";

function expectWrappedAbridgedTokens(
    document: string,
    separator: string,
    expected: ReadonlyArray<[TokenKind, string]>
): LexerSnapshot {
    const newDocument = `a${separator}${document}${separator}b`;
    const newExpected: ReadonlyArray<[TokenKind, string]> = [
        [TokenKind.Identifier, "a"],
        ...expected,
        [TokenKind.Identifier, "b"],
    ];
    return expectAbridgedTokens(newDocument, separator, newExpected);
}

describe(`Lexer.MultilineTokens`, () => {
    it(`StringLiteral - whole line is ${LineTokenKind.StringLiteralContent}`, () => {
        const seperator = "\n";
        const document = `"${seperator}foo${seperator}"`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.StringLiteral, `"${seperator}foo${seperator}"`],
        ];
        expectWrappedAbridgedTokens(document, seperator, expected);
    });

    it(`StringLiteral - remainder of line is ${LineTokenKind.StringLiteralContent}`, () => {
        const separator = "\n";
        const document = `"foo"`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.StringLiteral, `"foo"`],
        ];
        expectWrappedAbridgedTokens(document, separator, expected);
    });
});
