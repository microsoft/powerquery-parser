import { expect } from "chai";
import "mocha";
import { Lexer, LexerError, LexerState, LexerSnapshot } from "../../lexer";
import { Result, ResultKind } from "../../common";

function expectStateInnerError(document: string, separator: string): LexerError.TInnerLexerError {
    const state: LexerState = Lexer.fromSplit(document, separator);

    const maybeErrorLine = Lexer.maybeFirstErrorLine(state);
    if (maybeErrorLine === undefined) {
        throw new Error(`AssertFailed: Lexer.maybeFirstErrorLine(state) !== undefined: ${JSON.stringify(state)}`);
    }
    else {
        return maybeErrorLine.error.innerError;
    }
}

function expectSnapshotInnerError(document: string, separator: string): LexerError.TInnerLexerError {
    const state: LexerState = Lexer.fromSplit(document, separator);
    const snapshotResult: Result<LexerSnapshot, LexerError.TLexerError> = Lexer.trySnapshotFrom(state);

    if (snapshotResult.kind !== ResultKind.Err) {
        throw new Error(`AssertFailed: snapshotResult.kind !== ResultKind.Err: ${JSON.stringify(state)}`);
    }
    else {
        return snapshotResult.error.innerError;
    }
}

describe("Lexer.Error", () => {
    it("ExpectedHexLiteralError: 0x", () => {
        const innerError = expectStateInnerError("0x", "\n");
        expect(innerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, innerError.message);
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
