import { expect } from "chai";
import "mocha";
import { Lexer, LexerError } from "../../lexer";
import { touchedWithErrorLexerFactory } from "./common";

function expectLexerInnerError(document: string): LexerError.TInnerLexerError {
    let lexer: Lexer.TLexer = Lexer.from(document);
    lexer = Lexer.remaining(lexer);

    if (!Lexer.hasError(lexer)) {
        throw new Error(`expected !Lexer.hasError(lexer): ${JSON.stringify(lexer)}`);
    }
    else if (!(lexer.error instanceof LexerError.LexerError)) {
        throw new Error(`!(lexer.error instanceof LexerError): ${lexer.error.message}`);
    }
    else {
        return lexer.error.innerError;
    }
}

describe("Lexer.Error", () => {
    it("EndOfStream: ''", () => {
        const innerError = expectLexerInnerError("");
        expect(innerError instanceof LexerError.EndOfStreamError).to.equal(true, innerError.message);
    });

    it("ExpectedHexLiteralError: 0x", () => {
        const innerError = expectLexerInnerError("0x");
        expect(innerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, innerError.message);
    });

    it("UnterminatedMultilineCommentError: /*", () => {
        const innerError = expectLexerInnerError("/*");
        expect(innerError instanceof LexerError.UnterminatedMultilineCommentError).to.equal(true, innerError.message);
    });

    it("UnterminatedStringError: \"", () => {
        const innerError = expectLexerInnerError("\"");
        expect(innerError instanceof LexerError.UnterminatedStringError).to.equal(true, innerError.message);
    });

    it("BadStateError", () => {
        let lexer = touchedWithErrorLexerFactory("1 0x");

        if (lexer.kind !== Lexer.LexerKind.TouchedWithError) {
            const details = JSON.stringify(lexer, null, 4);
            throw new Error(`expected lexer.kind === Lexer.LexerKind.TouchedWithError: ${details}`);
        }
        let innerError = lexer.error.innerError;
        expect(innerError instanceof LexerError.ExpectedHexLiteralError).to.equal(true, innerError.message);

        lexer = Lexer.remaining(lexer);
        if (lexer.kind !== Lexer.LexerKind.Error) {
            const details = JSON.stringify(lexer, null, 4);
            throw new Error(`expected lexer.kind === Lexer.LexerKind.Error: ${details}`);
        }
        innerError = lexer.error.innerError;
        expect(innerError instanceof LexerError.BadStateError).to.equal(true, innerError.message);
    });
});
