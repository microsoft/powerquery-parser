// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Lexer, ResultUtils } from "../../..";

function assertBadLineNumberKind(lineNumber: number, expectedKind: Lexer.LexError.BadLineNumberKind): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, `foo`);
    Assert.isOk(triedLex);

    const triedUpdate: Lexer.TriedLex = Lexer.tryUpdateLine(triedLex.value, lineNumber, `bar`);
    Assert.isError(triedUpdate);

    const error: Lexer.LexError.LexError = triedUpdate.error;
    if (!(error.innerError instanceof Lexer.LexError.BadLineNumberError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.BadLineNumber: ${JSON.stringify(error)}`);
    }

    const innerError: Lexer.LexError.BadLineNumberError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function assertExpectedKind(text: string, expectedKind: Lexer.LexError.ExpectedKind): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    if (ResultUtils.isError(triedLex)) {
        throw new Error(`AssertFailed: ResultUtils.isError(triedLex)`);
    }
    const state: Lexer.State = triedLex.value;
    expect(state.lines.length).to.equal(1);

    const line: Lexer.TLine = state.lines[0];
    if (!Lexer.isErrorLine(line)) {
        throw new Error(`AssertFailed: Lexer.isErrorLine(line): ${JSON.stringify(line)}`);
    }

    const error: Lexer.LexError.TLexError = line.error;
    if (!(error.innerError instanceof Lexer.LexError.ExpectedError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.ExpectedError: ${JSON.stringify(line)}`);
    }

    const innerError: Lexer.LexError.ExpectedError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function assertBadRangeKind(range: Lexer.Range, expectedKind: Lexer.LexError.BadRangeKind): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, `foo`);
    if (ResultUtils.isError(triedLex)) {
        throw new Error(`AssertFailed: ResultUtils.isError(triedLex)`);
    }
    const state: Lexer.State = triedLex.value;

    const TriedLex: Lexer.TriedLex = Lexer.tryUpdateRange(state, range, `bar`);
    Assert.isError(TriedLex);

    const error: Lexer.LexError.LexError = TriedLex.error;
    if (!(error.innerError instanceof Lexer.LexError.BadRangeError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.BadRangeError: ${JSON.stringify(error)}`);
    }

    const innerError: Lexer.LexError.BadRangeError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function assertUnterminatedMultilineTokenKind(
    text: string,
    expectedKind: Lexer.LexError.UnterminatedMultilineTokenKind,
): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    Assert.isError(triedSnapshot);

    const error: Lexer.LexError.TLexError = triedSnapshot.error;
    if (!(error.innerError instanceof Lexer.LexError.UnterminatedMultilineTokenError)) {
        throw new Error(
            `AssertFailed: error.innerError instanceof LexError.UnterminatedMultilineTokenError: ${JSON.stringify(
                error,
            )}`,
        );
    }

    const innerError: Lexer.LexError.UnterminatedMultilineTokenError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

describe(`Lexer.Error`, () => {
    describe(`${Lexer.LexError.BadLineNumberError.name}`, () => {
        it(`${Lexer.LexError.BadLineNumberKind.LessThanZero}`, () => {
            assertBadLineNumberKind(-1, Lexer.LexError.BadLineNumberKind.LessThanZero);
        });

        it(`${Lexer.LexError.BadLineNumberKind.GreaterThanNumLines}`, () => {
            assertBadLineNumberKind(1, Lexer.LexError.BadLineNumberKind.GreaterThanNumLines);
        });
    });

    describe(`${Lexer.LexError.ExpectedError.name}`, () => {
        it(`${Lexer.LexError.ExpectedKind.HexLiteral}`, () => {
            assertExpectedKind(`0x`, Lexer.LexError.ExpectedKind.HexLiteral);
        });

        it(`${Lexer.LexError.ExpectedKind.KeywordOrIdentifier}`, () => {
            assertExpectedKind(`^`, Lexer.LexError.ExpectedKind.KeywordOrIdentifier);
        });

        // LexError.ExpectedKind.Numeric only throws if the regex is incorrect,
        // meaning there's no good way to test it.
    });

    describe(`${Lexer.LexError.BadRangeError.name}`, () => {
        it(`${Lexer.LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher}`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
            };
            assertBadRangeKind(range, Lexer.LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher);
        });

        it(`${Lexer.LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd}`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
            };
            assertBadRangeKind(range, Lexer.LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd);
        });

        it(`${Lexer.LexError.BadRangeKind.LineNumberStart_LessThan_Zero}`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: -1,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
            };
            assertBadRangeKind(range, Lexer.LexError.BadRangeKind.LineNumberStart_LessThan_Zero);
        });

        it(`${Lexer.LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines}`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 1,
                    lineCodeUnit: 0,
                },
            };
            assertBadRangeKind(range, Lexer.LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines);
        });

        it(`${Lexer.LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines}`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 1,
                    lineCodeUnit: 0,
                },
            };
            assertBadRangeKind(range, Lexer.LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines);
        });

        it(`${Lexer.LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength}`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 100,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 200,
                },
            };
            assertBadRangeKind(range, Lexer.LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength);
        });

        it(`${Lexer.LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength}`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 200,
                },
            };
            assertBadRangeKind(range, Lexer.LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength);
        });
    });

    describe(`${Lexer.LexError.UnterminatedMultilineTokenError.name}`, () => {
        it(`${Lexer.LexError.UnterminatedMultilineTokenKind.MultilineComment}`, () => {
            assertUnterminatedMultilineTokenKind(`/*`, Lexer.LexError.UnterminatedMultilineTokenKind.MultilineComment);
        });

        it(`${Lexer.LexError.UnterminatedMultilineTokenKind.Text}`, () => {
            assertUnterminatedMultilineTokenKind(`"`, Lexer.LexError.UnterminatedMultilineTokenKind.Text);
        });

        it(`${Lexer.LexError.UnterminatedMultilineTokenKind.QuotedIdentifier}`, () => {
            assertUnterminatedMultilineTokenKind(`#"`, Lexer.LexError.UnterminatedMultilineTokenKind.QuotedIdentifier);
        });
    });
});
