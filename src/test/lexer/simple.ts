import { expect } from "chai";
import "mocha";
import { Lexer, TokenKind } from "../../lexer";

function expectLexSuccess(document: string): Lexer.TouchedLexer {
    let lexer = Lexer.from(document);
    lexer = Lexer.remaining(lexer);

    if (lexer.kind !== Lexer.LexerKind.Touched) {
        const details = { lexer };
        throw new Error(`lexer.kind !== Lexer.LexerKind.Touched: ${JSON.stringify(details, null, 4)}`);
    }

    return lexer;
}

function expectTokens(document: string, expected: [TokenKind, string][]): Lexer.TouchedLexer {
    const touchedLexer = expectLexSuccess(document);
    const actual = touchedLexer.tokens.map(token => [token.kind, token.data]);
    const details = {
        actual,
        expected,
    };

    expect(actual).deep.equal(expected, JSON.stringify(details, null, 4));

    return touchedLexer;
}

describe("simple lexing", () => {
    it("HexLiteral", () => {
        const document = `
0x1
0X1`;
        const expected: [TokenKind, string][] = [
            [TokenKind.HexLiteral, "0x1"],
            [TokenKind.HexLiteral, "0X1"],
        ];
        expectTokens(document, expected);
    });

    it("keywords", () => {
        const document = `
and
as
each
else
error
false
if
in
is
let
meta
not
otherwise
or
section
shared
then
true
try
type
#binary
#date
#datetime
#datetimezone
#duration
#infinity
#nan
#sections
#shared
#table
#time`;
        const expected: [TokenKind, string][] = [
            [TokenKind.KeywordAnd, "and"],
            [TokenKind.KeywordAs, "as"],
            [TokenKind.KeywordEach, "each"],
            [TokenKind.KeywordElse, "else"],
            [TokenKind.KeywordError, "error"],
            [TokenKind.KeywordFalse, "false"],
            [TokenKind.KeywordIf, "if"],
            [TokenKind.KeywordIn, "in"],
            [TokenKind.KeywordIs, "is"],
            [TokenKind.KeywordLet, "let"],
            [TokenKind.KeywordMeta, "meta"],
            [TokenKind.KeywordNot, "not"],
            [TokenKind.KeywordOtherwise, "otherwise"],
            [TokenKind.KeywordOr, "or"],
            [TokenKind.KeywordSection, "section"],
            [TokenKind.KeywordShared, "shared"],
            [TokenKind.KeywordThen, "then"],
            [TokenKind.KeywordTrue, "true"],
            [TokenKind.KeywordTry, "try"],
            [TokenKind.KeywordType, "type"],
            [TokenKind.KeywordHashBinary, "#binary"],
            [TokenKind.KeywordHashDate, "#date"],
            [TokenKind.KeywordHashDateTime, "#datetime"],
            [TokenKind.KeywordHashDateTimeZone, "#datetimezone"],
            [TokenKind.KeywordHashDuration, "#duration"],
            [TokenKind.KeywordHashInfinity, "#infinity"],
            [TokenKind.KeywordHashNan, "#nan"],
            [TokenKind.KeywordHashSections, "#sections"],
            [TokenKind.KeywordHashShared, "#shared"],
            [TokenKind.KeywordHashTable, "#table"],
            [TokenKind.KeywordHashTime, "#time"],
        ];
        expectTokens(document, expected);
    });

    it("NullLiteral", () => {
        const document = `null`;
        const expected: [TokenKind, string][] = [[TokenKind.NullLiteral, "null"]];
        expectTokens(document, expected);
    });

    it("NumericLiteral", () => {
        const document = `
1
1e1
1e-1
1e+1
.1
.1e1
.1e-1
.1e+1
0.1
0.1e1
0.1e-1
0.1e+1`;
        const expected: [TokenKind, string][] = [
            [TokenKind.NumericLiteral, "1"],
            [TokenKind.NumericLiteral, "1e1"],
            [TokenKind.NumericLiteral, "1e-1"],
            [TokenKind.NumericLiteral, "1e+1"],
            [TokenKind.NumericLiteral, ".1"],
            [TokenKind.NumericLiteral, ".1e1"],
            [TokenKind.NumericLiteral, ".1e-1"],
            [TokenKind.NumericLiteral, ".1e+1"],
            [TokenKind.NumericLiteral, "0.1"],
            [TokenKind.NumericLiteral, "0.1e1"],
            [TokenKind.NumericLiteral, "0.1e-1"],
            [TokenKind.NumericLiteral, "0.1e+1"],
        ];
        expectTokens(document, expected);
    });
});
