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

function expectTokenKinds(document: string, expectedTokenKinds: TokenKind[]): Lexer.TouchedLexer {
    const touchedLexer = expectLexSuccess(document);
    const lexedTokenKinds = touchedLexer.tokens.map(token => token.kind);
    const details = {
        lexedTokenKinds,
        expectedNodeKinds: expectedTokenKinds,
    };
    expect(lexedTokenKinds).members(expectedTokenKinds, JSON.stringify(details, null, 4));

    return touchedLexer;
}

describe("simple lexing", () => {
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
        const expectedTokenKinds = [
            TokenKind.KeywordAnd,
            TokenKind.KeywordAs,
            TokenKind.KeywordEach,
            TokenKind.KeywordElse,
            TokenKind.KeywordError,
            TokenKind.KeywordFalse,
            TokenKind.KeywordIf,
            TokenKind.KeywordIn,
            TokenKind.KeywordIs,
            TokenKind.KeywordLet,
            TokenKind.KeywordMeta,
            TokenKind.KeywordNot,
            TokenKind.KeywordOtherwise,
            TokenKind.KeywordOr,
            TokenKind.KeywordSection,
            TokenKind.KeywordShared,
            TokenKind.KeywordThen,
            TokenKind.KeywordTrue,
            TokenKind.KeywordTry,
            TokenKind.KeywordType,
            TokenKind.KeywordHashBinary,
            TokenKind.KeywordHashDate,
            TokenKind.KeywordHashDateTime,
            TokenKind.KeywordHashDateTimeZone,
            TokenKind.KeywordHashDuration,
            TokenKind.KeywordHashInfinity,
            TokenKind.KeywordHashNan,
            TokenKind.KeywordHashSections,
            TokenKind.KeywordHashShared,
            TokenKind.KeywordHashTable,
            TokenKind.KeywordHashTime,
        ];
        expectTokenKinds(document, expectedTokenKinds);
    });
});
