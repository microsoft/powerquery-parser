import { expect } from "chai";
import "mocha";
import { Keywords, TokenKind } from "../../lexer";
import { expectAbridgedTokens } from "./common";

describe(`Lexer.Simple.TokenKinds`, () => {
    it(`HexLiteral`, () => {
        const document = `
0x1
0X1`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.HexLiteral, `0x1`],
            [TokenKind.HexLiteral, `0X1`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`keywords`, () => {
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
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.KeywordAnd, `and`],
            [TokenKind.KeywordAs, `as`],
            [TokenKind.KeywordEach, `each`],
            [TokenKind.KeywordElse, `else`],
            [TokenKind.KeywordError, `error`],
            [TokenKind.KeywordFalse, `false`],
            [TokenKind.KeywordIf, `if`],
            [TokenKind.KeywordIn, `in`],
            [TokenKind.KeywordIs, `is`],
            [TokenKind.KeywordLet, `let`],
            [TokenKind.KeywordMeta, `meta`],
            [TokenKind.KeywordNot, `not`],
            [TokenKind.KeywordOtherwise, `otherwise`],
            [TokenKind.KeywordOr, `or`],
            [TokenKind.KeywordSection, `section`],
            [TokenKind.KeywordShared, `shared`],
            [TokenKind.KeywordThen, `then`],
            [TokenKind.KeywordTrue, `true`],
            [TokenKind.KeywordTry, `try`],
            [TokenKind.KeywordType, `type`],
            [TokenKind.KeywordHashBinary, `#binary`],
            [TokenKind.KeywordHashDate, `#date`],
            [TokenKind.KeywordHashDateTime, `#datetime`],
            [TokenKind.KeywordHashDateTimeZone, `#datetimezone`],
            [TokenKind.KeywordHashDuration, `#duration`],
            [TokenKind.KeywordHashInfinity, `#infinity`],
            [TokenKind.KeywordHashNan, `#nan`],
            [TokenKind.KeywordHashSections, `#sections`],
            [TokenKind.KeywordHashShared, `#shared`],
            [TokenKind.KeywordHashTable, `#table`],
            [TokenKind.KeywordHashTime, `#time`],
        ];
        expect(expected.length).to.equal(Keywords.length);
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`LineComment`, () => {
        const document = `
a // b
c`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
            [TokenKind.LineComment, `// b`],
            [TokenKind.Identifier, `c`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`LineComment on last line`, () => {
        const document = `
a
// b`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
            [TokenKind.LineComment, `// b`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`MultilineComment`, () => {
        const document = `a /* b */ c`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
            [TokenKind.MultilineComment, `/* b */`],
            [TokenKind.Identifier, `c`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`NullLiteral`, () => {
        const document = `null`;
        const expected: ReadonlyArray<[TokenKind, string]> = [[TokenKind.NullLiteral, `null`]];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`NumericLiteral`, () => {
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
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.NumericLiteral, `1`],
            [TokenKind.NumericLiteral, `1e1`],
            [TokenKind.NumericLiteral, `1e-1`],
            [TokenKind.NumericLiteral, `1e+1`],
            [TokenKind.NumericLiteral, `.1`],
            [TokenKind.NumericLiteral, `.1e1`],
            [TokenKind.NumericLiteral, `.1e-1`],
            [TokenKind.NumericLiteral, `.1e+1`],
            [TokenKind.NumericLiteral, `0.1`],
            [TokenKind.NumericLiteral, `0.1e1`],
            [TokenKind.NumericLiteral, `0.1e-1`],
            [TokenKind.NumericLiteral, `0.1e+1`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    // TODO: look into adding `..`
    it(`operator-or-punctuator`, () => {
        const document = `
,
;
=
<
<=
>
>=
<>
+
-
*
/
&
(
)
[
]
{
}
@
?
=>
...`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Comma, `,`],
            [TokenKind.Semicolon, `;`],
            [TokenKind.Equal, `=`],
            [TokenKind.LessThan, `<`],
            [TokenKind.LessThanEqualTo, `<=`],
            [TokenKind.GreaterThan, `>`],
            [TokenKind.GreaterThanEqualTo, `>=`],
            [TokenKind.NotEqual, `<>`],
            [TokenKind.Plus, `+`],
            [TokenKind.Minus, `-`],
            [TokenKind.Asterisk, `*`],
            [TokenKind.Division, `/`],
            [TokenKind.Ampersand, `&`],
            [TokenKind.LeftParenthesis, `(`],
            [TokenKind.RightParenthesis, `)`],
            [TokenKind.LeftBracket, `[`],
            [TokenKind.RightBracket, `]`],
            [TokenKind.LeftBrace, `{`],
            [TokenKind.RightBrace, `}`],
            [TokenKind.AtSign, `@`],
            [TokenKind.QuestionMark, `?`],
            [TokenKind.FatArrow, `=>`],
            [TokenKind.Ellipsis, `...`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`StringLiteral`, () => {
        const document = `
""
""""
`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.StringLiteral, `""`],
            [TokenKind.StringLiteral, `""""`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });
});

describe(`Lexer.Simple.Whitespace`, () => {
    it(`spaces`, () => {
        const document = ` a b `;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
            [TokenKind.Identifier, `b`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`tabs`, () => {
        const document = `\ta\tb\t`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
            [TokenKind.Identifier, `b`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`trailing \\n`, () => {
        const document = `a\n`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`trailing \\r\\n`, () => {
        const document = `a\r\n`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectAbridgedTokens(document, "\r\n", expected);
    });

    it(`trailing space`, () => {
        const document = `a `;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`leading \\n`, () => {
        const document = `\na`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });

    it(`leading \\r\\n`, () => {
        const document = `\r\na`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectAbridgedTokens(document, "\r\n", expected);
    });

    it(`leading space`, () => {
        const document = ` a`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectAbridgedTokens(document, "\n", expected);
    });
});
