import { expect } from "chai";
import "mocha";
import { Result, ResultKind } from "../../common";
import { Lexer, LexerError, LexerSnapshot } from "../../lexer";

const LINE_TERMINATOR: string = `\n`;

interface StateErrorLinesPair {
    readonly state: Lexer.State,
    readonly errorLines: Lexer.TErrorLines,
}

function expectStateErrorLines(text: string, lineTerminator: string, numErrorLines: number): StateErrorLinesPair {
    const state: Lexer.State = Lexer.fromSplit(text, lineTerminator);

    const maybeErrorLines = Lexer.maybeErrorLines(state);
    if (!(maybeErrorLines !== undefined)) {
        throw new Error(`AssertFailed: Lexer.maybeFirstErrorLine(state) !== undefined: ${JSON.stringify(state)}`);
    }
    else if (!(maybeErrorLines !== undefined)) {
        throw new Error(`AssertFailed: maybeErrorLines !== undefined: ${JSON.stringify(state)}`);
    }
    else if (!(numErrorLines === Object.keys(maybeErrorLines).length)) {
        const details = {
            "Object.keys(maybeErrorLines).length": Object.keys(maybeErrorLines).length,
            numErrorLines,
        };
        throw new Error(`AssertFailed: numErrorLines === Object.keys(maybeErrorLines).length): ${JSON.stringify(details)}`);
    }
    else {
        return {
            state,
            errorLines: maybeErrorLines,
        };
    }
}

function expectSnapshotInnerError(text: string, lineTerminator: string): LexerError.TInnerLexerError {
    const state: Lexer.State = Lexer.fromSplit(text, lineTerminator);
    const snapshotResult: Result<LexerSnapshot, LexerError.TLexerError> = LexerSnapshot.tryFrom(state);

    if (!(snapshotResult.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: snapshotResult.kind === ResultKind.Err: ${JSON.stringify(state)}`);
    }
    else {
        return snapshotResult.error.innerError;
    }
}

function expectBadRangeKind(
    text: string,
    lineTerminator: string,
    range: Lexer.Range,
    expectedKind: LexerError.BadRangeKind,
) {
    let state: Lexer.State = Lexer.fromSplit(text, lineTerminator);
    const updateRangeResult: Result<Lexer.State, LexerError.LexerError> = Lexer.updateRange(state, range, `foobar`);
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
    it(`ExpectedHexLiteralError: 0x`, () => {
        const stateErrorLinesPair = expectStateErrorLines(`0x`, `\n`, 1);
        const innerError = stateErrorLinesPair.errorLines[0].error.innerError;
        expect(innerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, innerError.message);
    });

    it(`lexerLineError: 0x \\n 0x`, () => {
        const stateErrorLinesPair = expectStateErrorLines(`0x \n 0x`, `\n`, 2);
        const firstInnerError = stateErrorLinesPair.errorLines[0].error.innerError;
        expect(firstInnerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, firstInnerError.message);

        const secondInnerError = stateErrorLinesPair.errorLines[1].error.innerError;
        expect(secondInnerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, secondInnerError.message);
    });

    it(`UnterminatedMultilineCommentError: /*`, () => {
        const innerError = expectSnapshotInnerError(`/*`, `\n`);
        expect(innerError instanceof LexerError.UnterminatedMultilineCommentError).to.equal(true, innerError.message);
    });

    it(`UnterminatedStringError: "`, () => {
        const innerError = expectSnapshotInnerError(`"`, `\n`);
        expect(innerError instanceof LexerError.UnterminatedStringError).to.equal(true, innerError.message);
    });

    describe(`BadRange`, () => {
        it(`start.lineNumber === end.lineNumber && start.columnNumber > end.columnNumber`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 1,
                },
                end: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
            };
            expectBadRangeKind(`foobar`, LINE_TERMINATOR, range, LexerError.BadRangeKind.SameLine_ColumnNumberStart_Higher);
        });

        it(`start.lineNumber > end.lineNumber`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
            };
            expectBadRangeKind(`foobar`, LINE_TERMINATOR, range, LexerError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd);
        });

        it(`start.lineNumber < 0`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: -1,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
            };
            expectBadRangeKind(`foobar`, LINE_TERMINATOR, range, LexerError.BadRangeKind.LineNumberStart_LessThan_Zero);
        });

        it(`start.lineNumber >= numLines`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 1,
                    columnNumber: 0,
                },
            };
            expectBadRangeKind(`foobar`, LINE_TERMINATOR, range, LexerError.BadRangeKind.LineNumberStart_GreaterThan_NumLines);
        });

        it(`end.lineNumber >= numLines`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 1,
                    columnNumber: 0,
                },
            };
            expectBadRangeKind(`foobar`, LINE_TERMINATOR, range, LexerError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines);
        });

        it(`start.columnNumber >= lines[start.lineNumber].lineString.text.length`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 100,
                },
                end: {
                    lineNumber: 0,
                    columnNumber: 200,
                },
            };
            expectBadRangeKind(`foobar`, LINE_TERMINATOR, range, LexerError.BadRangeKind.ColumnNumberStart_GreaterThan_LineLength);
        });

        it(`end.columnNumber >= lines[end.lineNumber].lineString.text.length`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 0,
                    columnNumber: 200,
                },
            };
            expectBadRangeKind(`foobar`, LINE_TERMINATOR, range, LexerError.BadRangeKind.ColumnNumberEnd_GreaterThan_LineLength);
        });
    });
});
