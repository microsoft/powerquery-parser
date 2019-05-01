import { expect } from "chai";
import "mocha";
import { Keywords, TokenKind } from "../../lexer";
import { expectSnapshotAbridgedTokens } from "./common";

describe(`Lexer.Simple.TokenKinds`, () => {
    it(`HexLiteral`, () => {
        const text = `
0x1
0X1`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.HexLiteral, `0x1`],
            [TokenKind.HexLiteral, `0X1`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`keywords`, () => {
        const text = `
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
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`NullLiteral`, () => {
        const text = `null`;
        const expected: ReadonlyArray<[TokenKind, string]> = [[TokenKind.NullLiteral, `null`]];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`NumericLiteral`, () => {
        const text = `
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
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    // TODO: look into adding `..`
    it(`operator-or-punctuator`, () => {
        const text = `
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
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`StringLiteral`, () => {
        const text = `
""
""""
`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.StringLiteral, `""`],
            [TokenKind.StringLiteral, `""""`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });
});

describe(`Lexer.Simple.Whitespace`, () => {
    it(`spaces`, () => {
        const text = ` a b `;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
            [TokenKind.Identifier, `b`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`tabs`, () => {
        const text = `\ta\tb\t`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
            [TokenKind.Identifier, `b`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`trailing \\n`, () => {
        const text = `a\n`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`trailing \\r\\n`, () => {
        const text = `a\r\n`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectSnapshotAbridgedTokens(text, "\r\n", expected, true);
    });

    it(`trailing space`, () => {
        const text = `a `;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`leading \\n`, () => {
        const text = `\na`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });

    it(`leading \\r\\n`, () => {
        const text = `\r\na`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectSnapshotAbridgedTokens(text, "\r\n", expected, true);
    });

    it(`leading space`, () => {
        const text = ` a`;
        const expected: ReadonlyArray<[TokenKind, string]> = [
            [TokenKind.Identifier, `a`],
        ];
        expectSnapshotAbridgedTokens(text, "\n", expected, true);
    });
});
