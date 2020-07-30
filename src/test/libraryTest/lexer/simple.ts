// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Language } from "../../..";
import { expectSnapshotAbridgedTokens } from "./common";

describe(`Lexer.Simple.TokenKinds`, () => {
    it(`HexLiteral`, () => {
        const text: string = `
0x1
0X1`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [
            [Language.TokenKind.HexLiteral, `0x1`],
            [Language.TokenKind.HexLiteral, `0X1`],
        ];
        expectSnapshotAbridgedTokens(text, expected, true);
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
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [
            [Language.TokenKind.KeywordAnd, `and`],
            [Language.TokenKind.KeywordAs, `as`],
            [Language.TokenKind.KeywordEach, `each`],
            [Language.TokenKind.KeywordElse, `else`],
            [Language.TokenKind.KeywordError, `error`],
            [Language.TokenKind.KeywordFalse, `false`],
            [Language.TokenKind.KeywordIf, `if`],
            [Language.TokenKind.KeywordIn, `in`],
            [Language.TokenKind.KeywordIs, `is`],
            [Language.TokenKind.KeywordLet, `let`],
            [Language.TokenKind.KeywordMeta, `meta`],
            [Language.TokenKind.KeywordNot, `not`],
            [Language.TokenKind.KeywordOtherwise, `otherwise`],
            [Language.TokenKind.KeywordOr, `or`],
            [Language.TokenKind.KeywordSection, `section`],
            [Language.TokenKind.KeywordShared, `shared`],
            [Language.TokenKind.KeywordThen, `then`],
            [Language.TokenKind.KeywordTrue, `true`],
            [Language.TokenKind.KeywordTry, `try`],
            [Language.TokenKind.KeywordType, `type`],
            [Language.TokenKind.KeywordHashBinary, `#binary`],
            [Language.TokenKind.KeywordHashDate, `#date`],
            [Language.TokenKind.KeywordHashDateTime, `#datetime`],
            [Language.TokenKind.KeywordHashDateTimeZone, `#datetimezone`],
            [Language.TokenKind.KeywordHashDuration, `#duration`],
            [Language.TokenKind.KeywordHashInfinity, `#infinity`],
            [Language.TokenKind.KeywordHashNan, `#nan`],
            [Language.TokenKind.KeywordHashSections, `#sections`],
            [Language.TokenKind.KeywordHashShared, `#shared`],
            [Language.TokenKind.KeywordHashTable, `#table`],
            [Language.TokenKind.KeywordHashTime, `#time`],
        ];
        expect(expected.length).to.equal(Language.Keywords.length);
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`NullLiteral`, () => {
        const text: string = `null`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [[Language.TokenKind.NullLiteral, `null`]];
        expectSnapshotAbridgedTokens(text, expected, true);
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
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [
            [Language.TokenKind.NumericLiteral, `1`],
            [Language.TokenKind.NumericLiteral, `1e1`],
            [Language.TokenKind.NumericLiteral, `1e-1`],
            [Language.TokenKind.NumericLiteral, `1e+1`],
            [Language.TokenKind.NumericLiteral, `.1`],
            [Language.TokenKind.NumericLiteral, `.1e1`],
            [Language.TokenKind.NumericLiteral, `.1e-1`],
            [Language.TokenKind.NumericLiteral, `.1e+1`],
            [Language.TokenKind.NumericLiteral, `0.1`],
            [Language.TokenKind.NumericLiteral, `0.1e1`],
            [Language.TokenKind.NumericLiteral, `0.1e-1`],
            [Language.TokenKind.NumericLiteral, `0.1e+1`],
        ];
        expectSnapshotAbridgedTokens(text, expected, true);
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
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [
            [Language.TokenKind.Comma, `,`],
            [Language.TokenKind.Semicolon, `;`],
            [Language.TokenKind.Equal, `=`],
            [Language.TokenKind.LessThan, `<`],
            [Language.TokenKind.LessThanEqualTo, `<=`],
            [Language.TokenKind.GreaterThan, `>`],
            [Language.TokenKind.GreaterThanEqualTo, `>=`],
            [Language.TokenKind.NotEqual, `<>`],
            [Language.TokenKind.Plus, `+`],
            [Language.TokenKind.Minus, `-`],
            [Language.TokenKind.Asterisk, `*`],
            [Language.TokenKind.Division, `/`],
            [Language.TokenKind.Ampersand, `&`],
            [Language.TokenKind.LeftParenthesis, `(`],
            [Language.TokenKind.RightParenthesis, `)`],
            [Language.TokenKind.LeftBracket, `[`],
            [Language.TokenKind.RightBracket, `]`],
            [Language.TokenKind.LeftBrace, `{`],
            [Language.TokenKind.RightBrace, `}`],
            [Language.TokenKind.AtSign, `@`],
            [Language.TokenKind.QuestionMark, `?`],
            [Language.TokenKind.NullCoalescingOperator, `??`],
            [Language.TokenKind.FatArrow, `=>`],
            [Language.TokenKind.DotDot, `..`],
            [Language.TokenKind.Ellipsis, `...`],
        ];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`TextLiteral`, () => {
        const text: string = `
""
""""
`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [
            [Language.TokenKind.TextLiteral, `""`],
            [Language.TokenKind.TextLiteral, `""""`],
        ];
        expectSnapshotAbridgedTokens(text, expected, true);
    });
});

describe(`Lexer.Simple.Whitespace`, () => {
    it(`only whitespace`, () => {
        const text: string = `  `;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`spaces`, () => {
        const text: string = ` a b `;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [
            [Language.TokenKind.Identifier, `a`],
            [Language.TokenKind.Identifier, `b`],
        ];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`tabs`, () => {
        const text: string = `\ta\tb\t`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [
            [Language.TokenKind.Identifier, `a`],
            [Language.TokenKind.Identifier, `b`],
        ];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing \\n`, () => {
        const text: string = `a\n`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [[Language.TokenKind.Identifier, `a`]];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing \\r\\n`, () => {
        const text: string = `a\r\n`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [[Language.TokenKind.Identifier, `a`]];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing space`, () => {
        const text: string = `a `;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [[Language.TokenKind.Identifier, `a`]];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading \\n`, () => {
        const text: string = `\na`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [[Language.TokenKind.Identifier, `a`]];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading \\r\\n`, () => {
        const text: string = `\r\na`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [[Language.TokenKind.Identifier, `a`]];
        expectSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading space`, () => {
        const text: string = ` a`;
        const expected: ReadonlyArray<[Language.TokenKind, string]> = [[Language.TokenKind.Identifier, `a`]];
        expectSnapshotAbridgedTokens(text, expected, true);
    });
});
