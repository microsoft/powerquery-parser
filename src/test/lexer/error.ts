import { expect } from "chai";
import "mocha";
import { Result, ResultKind } from "../../common";
import { Lexer, LexerError, LexerSnapshot } from "../../lexer";

// interface StateErrorLinesPair {
//     readonly state: Lexer.State,
//     readonly errorLines: Lexer.TErrorLines,
// }

// function expectStateErrorLines(text: string, numErrorLines: number): StateErrorLinesPair {
//     const state: Lexer.State = Lexer.stateFrom(text);

//     const maybeErrorLines = Lexer.maybeErrorLines(state);
//     if (!(maybeErrorLines !== undefined)) {
//         throw new Error(`AssertFailed: Lexer.maybeFirstErrorLine(state) !== undefined: ${JSON.stringify(state)}`);
//     }
//     else if (!(maybeErrorLines !== undefined)) {
//         throw new Error(`AssertFailed: maybeErrorLines !== undefined: ${JSON.stringify(state)}`);
//     }
//     else if (!(numErrorLines === Object.keys(maybeErrorLines).length)) {
//         const details = {
//             "Object.keys(maybeErrorLines).length": Object.keys(maybeErrorLines).length,
//             numErrorLines,
//         };
//         throw new Error(`AssertFailed: numErrorLines === Object.keys(maybeErrorLines).length): ${JSON.stringify(details)}`);
//     }
//     else {
//         return {
//             state,
//             errorLines: maybeErrorLines,
//         };
//     }
// }

function expectSnapshotInnerError(text: string): LexerError.TInnerLexerError {
    const state: Lexer.State = Lexer.stateFrom(text);
    const snapshotResult: Result<LexerSnapshot, LexerError.TLexerError> = LexerSnapshot.tryFrom(state);

    if (!(snapshotResult.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: snapshotResult.kind === ResultKind.Err: ${JSON.stringify(state)}`);
    }
    else {
        return snapshotResult.error.innerError;
    }
}

function expectBadLineNumberKind(
    lineNumber: number,
    expectedKind: LexerError.BadLineNumberKind,
) {
    let state: Lexer.State = Lexer.stateFrom(`foo`);
    const updateRangeResult: Result<Lexer.State, LexerError.LexerError> = Lexer.updateLine(state, lineNumber, `bar`);
    if (!(updateRangeResult.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: updateRangeResult.kind === ResultKind.Err: ${JSON.stringify(state)}`);
    }

    const error: LexerError.LexerError = updateRangeResult.error;
    if (!(error.innerError instanceof LexerError.BadLineNumber)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexerError.BadLineNumber: ${JSON.stringify(error)}`);
    }

    const innerError: LexerError.BadLineNumber = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function expectExpectedKind(
    text: string,
    expectedKind: LexerError.ExpectedKind,
) {
    const state: Lexer.State = Lexer.stateFrom(text);
    expect(state.lines.length).to.equal(1);
    
    const line: Lexer.TLine = state.lines[0];
    if (!(Lexer.isErrorLine(line))) {
        throw new Error(`AssertFailed: Lexer.isErrorLine(line): ${JSON.stringify(line)}`);
    }

    const error: LexerError.TLexerError = line.error;
    if (!(error.innerError instanceof LexerError.ExpectedError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexerError.ExpectedError: ${JSON.stringify(line)}`);
    }

    const innerError: LexerError.ExpectedError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

function expectBadRangeKind(
    range: Lexer.Range,
    expectedKind: LexerError.BadRangeKind,
) {
    let state: Lexer.State = Lexer.stateFrom(`foo`);
    const updateRangeResult: Result<Lexer.State, LexerError.LexerError> = Lexer.updateRange(state, range, `bar`);
    if (!(updateRangeResult.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: updateRangeResult.kind === ResultKind.Err: ${JSON.stringify(state)}`);
    }

    const error: LexerError.LexerError = updateRangeResult.error;
    if (!(error.innerError instanceof LexerError.BadRangeError)) {
        throw new Error(`AssertFailed: error.innerError instanceof LexerError.BadRangeError: ${JSON.stringify(error)}`);
    }

    const innerError: LexerError.BadRangeError = error.innerError;
    if (!(innerError.kind === expectedKind)) {
        throw new Error(`AssertFailed: innerError.kind === kind: ${JSON.stringify({ error, kind: expectedKind })}`);
    }
}

describe(`Lexer.Error`, () => {

    it(`UnterminatedMultilineCommentError: /*`, () => {
        const innerError = expectSnapshotInnerError(`/*`);
        expect(innerError instanceof LexerError.UnterminatedMultilineCommentError).to.equal(true, innerError.message);
    });

    it(`UnterminatedStringError: "`, () => {
        const innerError = expectSnapshotInnerError(`"`);
        expect(innerError instanceof LexerError.UnterminatedStringError).to.equal(true, innerError.message);
    });

    describe(`${LexerError.BadLineNumber.name}`, () => {
        it(`${LexerError.BadLineNumberKind.LessThanZero}`, () => {
            expectBadLineNumberKind(-1, LexerError.BadLineNumberKind.LessThanZero)
        });

        it(`${LexerError.BadLineNumberKind.GreaterThanNumLines}`, () => {
            expectBadLineNumberKind(1, LexerError.BadLineNumberKind.GreaterThanNumLines)
        });
    });

    describe(`${LexerError.ExpectedError.name}`, () => {
        it(`${LexerError.ExpectedKind.HexLiteral}`, () => {
            expectExpectedKind(`0x`, LexerError.ExpectedKind.HexLiteral)
        });

        it(`${LexerError.ExpectedKind.KeywordOrIdentifier}`, () => {
            expectExpectedKind(`^`, LexerError.ExpectedKind.KeywordOrIdentifier)
        });

        // LexerError.ExpectedKind.Numeric only throws if the regex is incorrect,
        // meaning there's no good way to test it.

    });

    describe(`${LexerError.BadRangeError.name}`, () => {
        it(`${LexerError.BadRangeKind.SameLine_LineCodeUnitStart_Higher}`, () => {
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
            expectBadRangeKind(range, LexerError.BadRangeKind.SameLine_LineCodeUnitStart_Higher);
        });

        it(`${LexerError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd}`, () => {
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
            expectBadRangeKind(range, LexerError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd);
        });

        it(`${LexerError.BadRangeKind.LineNumberStart_LessThan_Zero}`, () => {
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
            expectBadRangeKind(range, LexerError.BadRangeKind.LineNumberStart_LessThan_Zero);
        });

        it(`${LexerError.BadRangeKind.LineNumberStart_GreaterThan_NumLines}`, () => {
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
            expectBadRangeKind(range, LexerError.BadRangeKind.LineNumberStart_GreaterThan_NumLines);
        });

        it(`${LexerError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines}`, () => {
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
            expectBadRangeKind(range, LexerError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines);
        });

        it(`${LexerError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength}`, () => {
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
            expectBadRangeKind(range, LexerError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength);
        });

        it(`${LexerError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength}`, () => {
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
            expectBadRangeKind(range, LexerError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength);
        });
    });
});
