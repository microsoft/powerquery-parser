// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Keyword, Token } from "../../../language";
import { assertGetSnapshotAbridgedTokens } from "./common";

describe(`Lexer.Simple.TokenKinds`, () => {
    it(`HexLiteral`, () => {
        const text: string = `
0x1
0X1`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [
            [Token.TokenKind.HexLiteral, `0x1`],
            [Token.TokenKind.HexLiteral, `0X1`],
        ];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`keywords`, () => {
        const text: string = `
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
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [
            [Token.TokenKind.KeywordAnd, `and`],
            [Token.TokenKind.KeywordAs, `as`],
            [Token.TokenKind.KeywordEach, `each`],
            [Token.TokenKind.KeywordElse, `else`],
            [Token.TokenKind.KeywordError, `error`],
            [Token.TokenKind.KeywordFalse, `false`],
            [Token.TokenKind.KeywordIf, `if`],
            [Token.TokenKind.KeywordIn, `in`],
            [Token.TokenKind.KeywordIs, `is`],
            [Token.TokenKind.KeywordLet, `let`],
            [Token.TokenKind.KeywordMeta, `meta`],
            [Token.TokenKind.KeywordNot, `not`],
            [Token.TokenKind.KeywordOtherwise, `otherwise`],
            [Token.TokenKind.KeywordOr, `or`],
            [Token.TokenKind.KeywordSection, `section`],
            [Token.TokenKind.KeywordShared, `shared`],
            [Token.TokenKind.KeywordThen, `then`],
            [Token.TokenKind.KeywordTrue, `true`],
            [Token.TokenKind.KeywordTry, `try`],
            [Token.TokenKind.KeywordType, `type`],
            [Token.TokenKind.KeywordHashBinary, `#binary`],
            [Token.TokenKind.KeywordHashDate, `#date`],
            [Token.TokenKind.KeywordHashDateTime, `#datetime`],
            [Token.TokenKind.KeywordHashDateTimeZone, `#datetimezone`],
            [Token.TokenKind.KeywordHashDuration, `#duration`],
            [Token.TokenKind.KeywordHashInfinity, `#infinity`],
            [Token.TokenKind.KeywordHashNan, `#nan`],
            [Token.TokenKind.KeywordHashSections, `#sections`],
            [Token.TokenKind.KeywordHashShared, `#shared`],
            [Token.TokenKind.KeywordHashTable, `#table`],
            [Token.TokenKind.KeywordHashTime, `#time`],
        ];
        expect(expected.length).to.equal(Keyword.KeywordKinds.length);
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`NullLiteral`, () => {
        const text: string = `null`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [[Token.TokenKind.NullLiteral, `null`]];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`NumericLiteral`, () => {
        const text: string = `
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
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [
            [Token.TokenKind.NumericLiteral, `1`],
            [Token.TokenKind.NumericLiteral, `1e1`],
            [Token.TokenKind.NumericLiteral, `1e-1`],
            [Token.TokenKind.NumericLiteral, `1e+1`],
            [Token.TokenKind.NumericLiteral, `.1`],
            [Token.TokenKind.NumericLiteral, `.1e1`],
            [Token.TokenKind.NumericLiteral, `.1e-1`],
            [Token.TokenKind.NumericLiteral, `.1e+1`],
            [Token.TokenKind.NumericLiteral, `0.1`],
            [Token.TokenKind.NumericLiteral, `0.1e1`],
            [Token.TokenKind.NumericLiteral, `0.1e-1`],
            [Token.TokenKind.NumericLiteral, `0.1e+1`],
        ];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`operator-or-punctuation`, () => {
        const text: string = `
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
??
=>
..
...`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [
            [Token.TokenKind.Comma, `,`],
            [Token.TokenKind.Semicolon, `;`],
            [Token.TokenKind.Equal, `=`],
            [Token.TokenKind.LessThan, `<`],
            [Token.TokenKind.LessThanEqualTo, `<=`],
            [Token.TokenKind.GreaterThan, `>`],
            [Token.TokenKind.GreaterThanEqualTo, `>=`],
            [Token.TokenKind.NotEqual, `<>`],
            [Token.TokenKind.Plus, `+`],
            [Token.TokenKind.Minus, `-`],
            [Token.TokenKind.Asterisk, `*`],
            [Token.TokenKind.Division, `/`],
            [Token.TokenKind.Ampersand, `&`],
            [Token.TokenKind.LeftParenthesis, `(`],
            [Token.TokenKind.RightParenthesis, `)`],
            [Token.TokenKind.LeftBracket, `[`],
            [Token.TokenKind.RightBracket, `]`],
            [Token.TokenKind.LeftBrace, `{`],
            [Token.TokenKind.RightBrace, `}`],
            [Token.TokenKind.AtSign, `@`],
            [Token.TokenKind.QuestionMark, `?`],
            [Token.TokenKind.NullCoalescingOperator, `??`],
            [Token.TokenKind.FatArrow, `=>`],
            [Token.TokenKind.DotDot, `..`],
            [Token.TokenKind.Ellipsis, `...`],
        ];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`TextLiteral`, () => {
        const text: string = `
""
""""
`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [
            [Token.TokenKind.TextLiteral, `""`],
            [Token.TokenKind.TextLiteral, `""""`],
        ];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });
});

describe(`Lexer.Simple.Whitespace`, () => {
    it(`only whitespace`, () => {
        const text: string = `  `;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`spaces`, () => {
        const text: string = ` a b `;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [
            [Token.TokenKind.Identifier, `a`],
            [Token.TokenKind.Identifier, `b`],
        ];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`tabs`, () => {
        const text: string = `\ta\tb\t`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [
            [Token.TokenKind.Identifier, `a`],
            [Token.TokenKind.Identifier, `b`],
        ];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing \\n`, () => {
        const text: string = `a\n`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [[Token.TokenKind.Identifier, `a`]];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing \\r\\n`, () => {
        const text: string = `a\r\n`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [[Token.TokenKind.Identifier, `a`]];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing space`, () => {
        const text: string = `a `;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [[Token.TokenKind.Identifier, `a`]];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading \\n`, () => {
        const text: string = `\na`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [[Token.TokenKind.Identifier, `a`]];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading \\r\\n`, () => {
        const text: string = `\r\na`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [[Token.TokenKind.Identifier, `a`]];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading space`, () => {
        const text: string = ` a`;
        const expected: ReadonlyArray<[Token.TokenKind, string]> = [[Token.TokenKind.Identifier, `a`]];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });
});
