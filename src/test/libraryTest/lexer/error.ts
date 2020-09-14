// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, Lexer, ResultUtils } from "../../..";
import { LexError } from "../../../lexer";
import { DefaultSettings } from "../../../settings";

function assertBadLineNumberKind(lineNumber: number, expectedKind: LexError.BadLineNumberKind): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, `foo`);
    Assert.isOk(triedLex);

    const triedUpdate: Lexer.TriedLex = Lexer.tryUpdateLine(triedLex.value, lineNumber, `bar`);
    Assert.isErr(triedUpdate);

    const error: LexError.LexError = triedUpdate.error;
    if (!(error.innerError instanceof LexError.BadLineNumberError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.BadLineNumber: ${JSON.stringify(error)}`);
    }

    const innerError: LexError.BadLineNumberError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function assertExpectedKind(text: string, expectedKind: LexError.ExpectedKind): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    if (ResultUtils.isErr(triedLex)) {
        throw new Error(`AssertFailed: ResultUtils.isErr(triedLex)`);
    }
    const state: Lexer.State = triedLex.value;
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

function assertBadRangeKind(range: Lexer.Range, expectedKind: LexError.BadRangeKind): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, `foo`);
    if (ResultUtils.isErr(triedLex)) {
        throw new Error(`AssertFailed: ResultUtils.isErr(triedLex)`);
    }
    const state: Lexer.State = triedLex.value;

    const TriedLex: Lexer.TriedLex = Lexer.tryUpdateRange(state, range, `bar`);
    Assert.isErr(TriedLex);

    const error: LexError.LexError = TriedLex.error;
    if (!(error.innerError instanceof LexError.BadRangeError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexError.BadRangeError: ${JSON.stringify(error)}`);
    }

    const innerError: LexError.BadRangeError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function assertUnterminatedMultilineTokenKind(
    text: string,
    expectedKind: LexError.UnterminatedMultilineTokenKind,
): void {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    Assert.isErr(triedSnapshot);

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
            assertBadLineNumberKind(-1, LexError.BadLineNumberKind.LessThanZero);
        });

        it(`${LexError.BadLineNumberKind.GreaterThanNumLines}`, () => {
            assertBadLineNumberKind(1, LexError.BadLineNumberKind.GreaterThanNumLines);
        });
    });

    describe(`${LexError.ExpectedError.name}`, () => {
        it(`${LexError.ExpectedKind.HexLiteral}`, () => {
            assertExpectedKind(`0x`, LexError.ExpectedKind.HexLiteral);
        });

        it(`${LexError.ExpectedKind.KeywordOrIdentifier}`, () => {
            assertExpectedKind(`^`, LexError.ExpectedKind.KeywordOrIdentifier);
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
            assertBadRangeKind(range, LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher);
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
            assertBadRangeKind(range, LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd);
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
            assertBadRangeKind(range, LexError.BadRangeKind.LineNumberStart_LessThan_Zero);
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
            assertBadRangeKind(range, LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines);
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
            assertBadRangeKind(range, LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines);
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
            assertBadRangeKind(range, LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength);
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
            assertBadRangeKind(range, LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength);
        });
    });

    describe(`${LexError.UnterminatedMultilineTokenError.name}`, () => {
        it(`${LexError.UnterminatedMultilineTokenKind.MultilineComment}`, () => {
            assertUnterminatedMultilineTokenKind(`/*`, LexError.UnterminatedMultilineTokenKind.MultilineComment);
        });

        it(`${LexError.UnterminatedMultilineTokenKind.Text}`, () => {
            assertUnterminatedMultilineTokenKind(`"`, LexError.UnterminatedMultilineTokenKind.Text);
        });

        it(`${LexError.UnterminatedMultilineTokenKind.QuotedIdentifier}`, () => {
            assertUnterminatedMultilineTokenKind(`#"`, LexError.UnterminatedMultilineTokenKind.QuotedIdentifier);
        });
    });
});
