import { expect } from "chai";
import "mocha";
import { Result, ResultKind } from "../../common";
import { Lexer, LexerError, LexerSnapshot } from "../../lexer";

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

describe("Lexer.Error", () => {
    it("ExpectedHexLiteralError: 0x", () => {
        const stateErrorLinesPair = expectStateErrorLines("0x", "\n", 1);
        const innerError = stateErrorLinesPair.errorLines[0].error.innerError;
        expect(innerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, innerError.message);
    });

    it("lexerLineError: 0x \\n 0x", () => {
        const stateErrorLinesPair = expectStateErrorLines("0x \n 0x", "\n", 2);
        const firstInnerError = stateErrorLinesPair.errorLines[0].error.innerError;
        expect(firstInnerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, firstInnerError.message);

        const secondInnerError = stateErrorLinesPair.errorLines[1].error.innerError;
        expect(secondInnerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, secondInnerError.message);
    });

    it("UnterminatedMultilineCommentError: /*", () => {
        const innerError = expectSnapshotInnerError("/*", "\n");
        expect(innerError instanceof LexerError.UnterminatedMultilineCommentError).to.equal(true, innerError.message);
    });

    it("UnterminatedStringError: \"", () => {
        const innerError = expectSnapshotInnerError("\"", "\n");
        expect(innerError instanceof LexerError.UnterminatedStringError).to.equal(true, innerError.message);
    });
});
