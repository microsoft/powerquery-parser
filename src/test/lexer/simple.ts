import { expect } from "chai";
import "mocha";
import { Lexer, LexerSnapshot, LexerState, TokenKind } from "../../lexer";

function expectLexSuccess(document: string): LexerState {
    const state: LexerState = Lexer.fromSplit(document, "\n");
    if (Lexer.isErrorState(state)) {
        const maybeErrorLine = Lexer.firstErrorLine(state);
        if (maybeErrorLine === undefined) {
            throw new Error(`AssertFailed: maybeErrorLine === undefined`);
        }
        const errorLine = maybeErrorLine;

        const details = {
            errorLine,
            error: errorLine.error.message,
        };
        throw new Error(`AssertFailed: Lexer.isErrorState(state) ${JSON.stringify(details, null, 4)}`);
    }

    return state;
}

function expectLexerSnapshot(document: string): LexerSnapshot {
    const state = expectLexSuccess(document);
    return Lexer.snapshot(state);
}

function expectTokens(document: string, expected: ReadonlyArray<[TokenKind, string]>): LexerSnapshot {
    const snapshot = expectLexerSnapshot(document);
    const actual = snapshot.tokens.map(token => [token.kind, token.data]);
    const details = {
        actual,
        expected,
    };

    expect(actual).deep.equal(expected, JSON.stringify(details, null, 4));
    return snapshot;
}

// describe(`Lexer.Simple.TokenKinds`, () => {
//     it(`HexLiteral`, () => {
//         const document = `
// 0x1
// 0X1`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.HexLiteral, `0x1`],
//             [TokenKind.HexLiteral, `0X1`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`keywords`, () => {
//         const document = `
// and
// as
// each
// else
// error
// false
// if
// in
// is
// let
// meta
// not
// otherwise
// or
// section
// shared
// then
// true
// try
// type
// #binary
// #date
// #datetime
// #datetimezone
// #duration
// #infinity
// #nan
// #sections
// #shared
// #table
// #time`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.KeywordAnd, `and`],
//             [TokenKind.KeywordAs, `as`],
//             [TokenKind.KeywordEach, `each`],
//             [TokenKind.KeywordElse, `else`],
//             [TokenKind.KeywordError, `error`],
//             [TokenKind.KeywordFalse, `false`],
//             [TokenKind.KeywordIf, `if`],
//             [TokenKind.KeywordIn, `in`],
//             [TokenKind.KeywordIs, `is`],
//             [TokenKind.KeywordLet, `let`],
//             [TokenKind.KeywordMeta, `meta`],
//             [TokenKind.KeywordNot, `not`],
//             [TokenKind.KeywordOtherwise, `otherwise`],
//             [TokenKind.KeywordOr, `or`],
//             [TokenKind.KeywordSection, `section`],
//             [TokenKind.KeywordShared, `shared`],
//             [TokenKind.KeywordThen, `then`],
//             [TokenKind.KeywordTrue, `true`],
//             [TokenKind.KeywordTry, `try`],
//             [TokenKind.KeywordType, `type`],
//             [TokenKind.KeywordHashBinary, `#binary`],
//             [TokenKind.KeywordHashDate, `#date`],
//             [TokenKind.KeywordHashDateTime, `#datetime`],
//             [TokenKind.KeywordHashDateTimeZone, `#datetimezone`],
//             [TokenKind.KeywordHashDuration, `#duration`],
//             [TokenKind.KeywordHashInfinity, `#infinity`],
//             [TokenKind.KeywordHashNan, `#nan`],
//             [TokenKind.KeywordHashSections, `#sections`],
//             [TokenKind.KeywordHashShared, `#shared`],
//             [TokenKind.KeywordHashTable, `#table`],
//             [TokenKind.KeywordHashTime, `#time`],
//         ];
//         expect(expected.length).to.equal(Keywords.length);
//         expectTokens(document, expected);
//     });

//     it(`NullLiteral`, () => {
//         const document = `null`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [[TokenKind.NullLiteral, `null`]];
//         expectTokens(document, expected);
//     });

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
    expectTokens(document, expected);
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
        expectTokens(document, expected);
    });

//     it(`StringLiteral`, () => {
//         const document = `
// ""
// """"
// `;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.StringLiteral, `""`],
//             [TokenKind.StringLiteral, `""""`],
//         ];
//         expectTokens(document, expected);
//     });
// });

// describe(`Lexer.Simple.Whitespace`, () => {
//     it(`spaces`, () => {
//         const document = ` a a `;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`tabs`, () => {
//         const document = `\ta\ta\t`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`trailing \\n`, () => {
//         const document = `a\n`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`trailing \\r\\n`, () => {
//         const document = `a\r\n`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`trailing space`, () => {
//         const document = `a `;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`leading \\n`, () => {
//         const document = `\na`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`leading \\r\\n`, () => {
//         const document = `\r\na`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });

//     it(`leading space`, () => {
//         const document = ` a`;
//         const expected: ReadonlyArray<[TokenKind, string]> = [
//             [TokenKind.Identifier, `a`],
//         ];
//         expectTokens(document, expected);
//     });
// });
