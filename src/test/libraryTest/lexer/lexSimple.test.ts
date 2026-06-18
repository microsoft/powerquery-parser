// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Language, Pattern, StringUtils } from "../../..";
import { assertGetSnapshotAbridgedTokens } from "../../testUtils/lexTestUtils";

describe(`Lexer.Simple.TokenKinds`, () => {
    it(`HexLiteral`, () => {
        const text: string = `
0x1
0X1`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.HexLiteral, `0x1`],
            [Language.Token.TokenKind.HexLiteral, `0X1`],
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

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.KeywordAnd, `and`],
            [Language.Token.TokenKind.KeywordAs, `as`],
            [Language.Token.TokenKind.KeywordEach, `each`],
            [Language.Token.TokenKind.KeywordElse, `else`],
            [Language.Token.TokenKind.KeywordError, `error`],
            [Language.Token.TokenKind.KeywordFalse, `false`],
            [Language.Token.TokenKind.KeywordIf, `if`],
            [Language.Token.TokenKind.KeywordIn, `in`],
            [Language.Token.TokenKind.KeywordIs, `is`],
            [Language.Token.TokenKind.KeywordLet, `let`],
            [Language.Token.TokenKind.KeywordMeta, `meta`],
            [Language.Token.TokenKind.KeywordNot, `not`],
            [Language.Token.TokenKind.KeywordOtherwise, `otherwise`],
            [Language.Token.TokenKind.KeywordOr, `or`],
            [Language.Token.TokenKind.KeywordSection, `section`],
            [Language.Token.TokenKind.KeywordShared, `shared`],
            [Language.Token.TokenKind.KeywordThen, `then`],
            [Language.Token.TokenKind.KeywordTrue, `true`],
            [Language.Token.TokenKind.KeywordTry, `try`],
            [Language.Token.TokenKind.KeywordType, `type`],
            [Language.Token.TokenKind.KeywordHashBinary, `#binary`],
            [Language.Token.TokenKind.KeywordHashDate, `#date`],
            [Language.Token.TokenKind.KeywordHashDateTime, `#datetime`],
            [Language.Token.TokenKind.KeywordHashDateTimeZone, `#datetimezone`],
            [Language.Token.TokenKind.KeywordHashDuration, `#duration`],
            [Language.Token.TokenKind.KeywordHashInfinity, `#infinity`],
            [Language.Token.TokenKind.KeywordHashNan, `#nan`],
            [Language.Token.TokenKind.KeywordHashSections, `#sections`],
            [Language.Token.TokenKind.KeywordHashShared, `#shared`],
            [Language.Token.TokenKind.KeywordHashTable, `#table`],
            [Language.Token.TokenKind.KeywordHashTime, `#time`],
        ];

        expect(expected.length).to.equal(Language.Keyword.KeywordKinds.length);
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`NullLiteral`, () => {
        const text: string = `null`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.NullLiteral, `null`],
        ];

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

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.NumericLiteral, `1`],
            [Language.Token.TokenKind.NumericLiteral, `1e1`],
            [Language.Token.TokenKind.NumericLiteral, `1e-1`],
            [Language.Token.TokenKind.NumericLiteral, `1e+1`],
            [Language.Token.TokenKind.NumericLiteral, `.1`],
            [Language.Token.TokenKind.NumericLiteral, `.1e1`],
            [Language.Token.TokenKind.NumericLiteral, `.1e-1`],
            [Language.Token.TokenKind.NumericLiteral, `.1e+1`],
            [Language.Token.TokenKind.NumericLiteral, `0.1`],
            [Language.Token.TokenKind.NumericLiteral, `0.1e1`],
            [Language.Token.TokenKind.NumericLiteral, `0.1e-1`],
            [Language.Token.TokenKind.NumericLiteral, `0.1e+1`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`NumericLiteral - backslash in exponent is not valid`, () => {
        // The old Pattern.Numeric regex used [\\+\\-] which included literal backslash.
        // This meant "1e\\3" would incorrectly match as a valid numeric literal.
        // After the fix, only + and - are valid exponent signs.
        expect(StringUtils.isNumeric(`1e\\3`)).to.equal(false, `"1e\\3" should not be a valid numeric literal`);
        expect(StringUtils.isNumeric(`1e+3`)).to.equal(true, `"1e+3" should be valid`);
        expect(StringUtils.isNumeric(`1e-3`)).to.equal(true, `"1e-3" should be valid`);
        expect(StringUtils.isNumeric(`1e3`)).to.equal(true, `"1e3" should be valid`);
    });

    it(`DotDot at end of input`, () => {
        // chr3 was typed as `string` but text[positionStart + 2] can be undefined
        // when ".." appears at end-of-input. Ensure it correctly lexes as DotDot.
        const text: string = `..`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [[Language.Token.TokenKind.DotDot, `..`]];

        assertGetSnapshotAbridgedTokens(text, expected, false);
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

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Comma, `,`],
            [Language.Token.TokenKind.Semicolon, `;`],
            [Language.Token.TokenKind.Equal, `=`],
            [Language.Token.TokenKind.LessThan, `<`],
            [Language.Token.TokenKind.LessThanEqualTo, `<=`],
            [Language.Token.TokenKind.GreaterThan, `>`],
            [Language.Token.TokenKind.GreaterThanEqualTo, `>=`],
            [Language.Token.TokenKind.NotEqual, `<>`],
            [Language.Token.TokenKind.Plus, `+`],
            [Language.Token.TokenKind.Minus, `-`],
            [Language.Token.TokenKind.Asterisk, `*`],
            [Language.Token.TokenKind.Division, `/`],
            [Language.Token.TokenKind.Ampersand, `&`],
            [Language.Token.TokenKind.LeftParenthesis, `(`],
            [Language.Token.TokenKind.RightParenthesis, `)`],
            [Language.Token.TokenKind.LeftBracket, `[`],
            [Language.Token.TokenKind.RightBracket, `]`],
            [Language.Token.TokenKind.LeftBrace, `{`],
            [Language.Token.TokenKind.RightBrace, `}`],
            [Language.Token.TokenKind.AtSign, `@`],
            [Language.Token.TokenKind.QuestionMark, `?`],
            [Language.Token.TokenKind.NullCoalescingOperator, `??`],
            [Language.Token.TokenKind.FatArrow, `=>`],
            [Language.Token.TokenKind.DotDot, `..`],
            [Language.Token.TokenKind.Ellipsis, `...`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`TextLiteral`, () => {
        const text: string = `
""
""""
`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.TextLiteral, `""`],
            [Language.Token.TokenKind.TextLiteral, `""""`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });
});

describe(`Lexer.Simple.Whitespace`, () => {
    it(`only whitespace`, () => {
        const text: string = `  `;
        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [];
        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`spaces`, () => {
        const text: string = ` a b `;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
            [Language.Token.TokenKind.Identifier, `b`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`tabs`, () => {
        const text: string = `\ta\tb\t`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
            [Language.Token.TokenKind.Identifier, `b`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing \\n`, () => {
        const text: string = `a\n`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing \\r\\n`, () => {
        const text: string = `a\r\n`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`trailing space`, () => {
        const text: string = `a `;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading \\n`, () => {
        const text: string = `\na`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading \\r\\n`, () => {
        const text: string = `\r\na`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });

    it(`leading space`, () => {
        const text: string = ` a`;

        const expected: ReadonlyArray<[Language.Token.TokenKind, string]> = [
            [Language.Token.TokenKind.Identifier, `a`],
        ];

        assertGetSnapshotAbridgedTokens(text, expected, true);
    });
});

describe(`Lexer.Simple.Whitespace Pattern`, () => {
    it(`should not match colon followed by whitespace char as a single whitespace token`, () => {
        // (:?[\u000b-\u000c\u2000-\u200a]) is a CAPTURING group with optional ':'
        // This means ":" + VT (vertical tab) matches as "whitespace", consuming the colon.
        // The correct syntax (?:[...]) is a non-capturing group that only matches the whitespace chars.
        const regex: RegExp = Pattern.Whitespace;
        regex.lastIndex = 0;

        const testStr: string = ":\u000B"; // colon + vertical tab
        const match: RegExpExecArray | null = regex.exec(testStr);

        // With bug: matches ":\u000B" (length 2) — colon consumed as whitespace
        // With fix: matches "\u000B" (length 1) — only the vertical tab
        expect(match).to.not.equal(null, "should match the vertical tab");
        expect(match![0]).to.equal("\u000B", "should match only the whitespace char, not the preceding colon");
    });

    it(`should match vertical tab (U+000B) as whitespace`, () => {
        // U+000B is in the first alternative's character class
        const regex: RegExp = Pattern.Whitespace;
        regex.lastIndex = 0;

        const testStr: string = "\u000B";
        const match: RegExpExecArray | null = regex.exec(testStr);

        expect(match).to.not.equal(null, "Whitespace pattern should match vertical tab U+000B");
        expect(match![0]).to.equal("\u000B");
    });
});
