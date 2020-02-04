// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultUtils } from "../../common";
import { Lexer, LexError, LexerSnapshot, TriedLexerSnapshot } from "../../lexer";
import { DefaultSettings } from "../../settings";

function expectBadLineNumberKind(lineNumber: number, expectedKind: LexError.BadLineNumberKind): void {
    const state: Lexer.State = Lexer.stateFrom(DefaultSettings, `foo`);
    const triedLexerUpdate: Lexer.TriedLexerUpdate = Lexer.tryUpdateLine(state, lineNumber, `bar`);
    if (!ResultUtils.isErr(triedLexerUpdate)) {
        throw new Error(`AssertFailed: ResultUtils.isErr(triedLexerUpdate): ${JSON.stringify(state)}`);
    }

    const error: LexError.LexError = triedLexerUpdate.error;
    if (!(error.innerError instanceof LexError.BadLineNumberError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.BadLineNumber: ${JSON.stringify(error)}`);
    }

    const innerError: LexError.BadLineNumberError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function expectExpectedKind(text: string, expectedKind: LexError.ExpectedKind): void {
    const state: Lexer.State = Lexer.stateFrom(DefaultSettings, text);
    expect(state.lines.length).to.equal(1);

    const line: Lexer.TLine = state.lines[0];
    if (!Lexer.isErrorLine(line)) {
        throw new Error(`AssertFailed: Lexer.isErrorLine(line): ${JSON.stringify(line)}`);
    }

    const error: LexError.TLexError = line.error;
    if (!(error.innerError instanceof LexError.ExpectedError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.ExpectedError: ${JSON.stringify(line)}`);
    }

    const innerError: LexError.ExpectedError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function expectBadRangeKind(range: Lexer.Range, expectedKind: LexError.BadRangeKind): void {
    const state: Lexer.State = Lexer.stateFrom(DefaultSettings, `foo`);
    const triedLexerUpdate: Lexer.TriedLexerUpdate = Lexer.tryUpdateRange(state, range, `bar`);
    if (!ResultUtils.isErr(triedLexerUpdate)) {
        throw new Error(`AssertFailed: ResultUtils.isErr(triedLexerUpdate): ${JSON.stringify(state)}`);
    }

    const error: LexError.LexError = triedLexerUpdate.error;
    if (!(error.innerError instanceof LexError.BadRangeError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.BadRangeError: ${JSON.stringify(error)}`);
    }

    const innerError: LexError.BadRangeError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function expectUnterminatedMultilineTokenKind(
    text: string,
    expectedKind: LexError.UnterminatedMultilineTokenKind,
): void {
    const state: Lexer.State = Lexer.stateFrom(DefaultSettings, text);
    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    if (!ResultUtils.isErr(triedSnapshot)) {
        throw new Error(`AssertFailed: ResultUtils.isErr(triedSnapshot): ${JSON.stringify(state)}`);
    }

    const error: LexError.TLexError = triedSnapshot.error;
    if (!(error.innerError instanceof LexError.UnterminatedMultilineTokenError)) {
        throw new Error(
            `AssertFailed: error.innerError instanceof LexError.UnterminatedMultilineTokenError: ${JSON.stringify(
                error,
            )}`,
        );
    }

    const innerError: LexError.UnterminatedMultilineTokenError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

describe(`Lexer.Error`, () => {
    describe(`${LexError.BadLineNumberError.name}`, () => {
        it(`${LexError.BadLineNumberKind.LessThanZero}`, () => {
            expectBadLineNumberKind(-1, LexError.BadLineNumberKind.LessThanZero);
        });

        it(`${LexError.BadLineNumberKind.GreaterThanNumLines}`, () => {
            expectBadLineNumberKind(1, LexError.BadLineNumberKind.GreaterThanNumLines);
        });
    });

    describe(`${LexError.ExpectedError.name}`, () => {
        it(`${LexError.ExpectedKind.HexLiteral}`, () => {
            expectExpectedKind(`0x`, LexError.ExpectedKind.HexLiteral);
        });

        it(`${LexError.ExpectedKind.KeywordOrIdentifier}`, () => {
            expectExpectedKind(`^`, LexError.ExpectedKind.KeywordOrIdentifier);
        });

        // LexError.ExpectedKind.Numeric only throws if the regex is incorrect,
        // meaning there's no good way to test it.
    });

    describe(`${LexError.BadRangeError.name}`, () => {
        it(`${LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher}`, () => {
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
            expectBadRangeKind(range, LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher);
        });

        it(`${LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd}`, () => {
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
            expectBadRangeKind(range, LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd);
        });

        it(`${LexError.BadRangeKind.LineNumberStart_LessThan_Zero}`, () => {
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
            expectBadRangeKind(range, LexError.BadRangeKind.LineNumberStart_LessThan_Zero);
        });

        it(`${LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines}`, () => {
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
            expectBadRangeKind(range, LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines);
        });

        it(`${LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines}`, () => {
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
            expectBadRangeKind(range, LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines);
        });

        it(`${LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength}`, () => {
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
            expectBadRangeKind(range, LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength);
        });

        it(`${LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength}`, () => {
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
            expectBadRangeKind(range, LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength);
        });
    });

    describe(`${LexError.UnterminatedMultilineTokenError.name}`, () => {
        it(`${LexError.UnterminatedMultilineTokenKind.MultilineComment}`, () => {
            expectUnterminatedMultilineTokenKind(`/*`, LexError.UnterminatedMultilineTokenKind.MultilineComment);
        });

        it(`${LexError.UnterminatedMultilineTokenKind.String}`, () => {
            expectUnterminatedMultilineTokenKind(`"`, LexError.UnterminatedMultilineTokenKind.String);
        });

        it(`${LexError.UnterminatedMultilineTokenKind.QuotedIdentifier}`, () => {
            expectUnterminatedMultilineTokenKind(`#"`, LexError.UnterminatedMultilineTokenKind.QuotedIdentifier);
        });
    });
});
