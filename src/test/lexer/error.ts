import { expect } from "chai";
import "mocha";
import { Result, ResultKind } from "../../common";
import { Lexer, LexerError, LexerSnapshot } from "../../lexer";

function expectStateInnerError(document: string, lineTerminator: string): LexerError.TInnerLexerError {
    const state: Lexer.LexerState = Lexer.fromSplit(document, lineTerminator);

    const maybeErrorLine = Lexer.maybeFirstErrorLine(state);
    if (maybeErrorLine === undefined) {
        throw new Error(`AssertFailed: Lexer.maybeFirstErrorLine(state) !== undefined: ${JSON.stringify(state)}`);
    }
    else {
        return maybeErrorLine.error.innerError;
    }
}

function expectSnapshotInnerError(document: string, lineTerminator: string): LexerError.TInnerLexerError {
    const state: Lexer.LexerState = Lexer.fromSplit(document, lineTerminator);
    const snapshotResult: Result<LexerSnapshot, LexerError.TLexerError> = LexerSnapshot.tryFrom(state);

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
