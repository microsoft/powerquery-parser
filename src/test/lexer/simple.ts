import { expect } from "chai";
import "mocha";
import { Lexer, LexerError, TokenKind } from "../../lexer";

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

function touchedLexerFactory(): Lexer.TLexer {
    const document = "!";
    let lexer = Lexer.from(document);
    lexer = Lexer.remaining(lexer);

    if (lexer.kind !== Lexer.LexerKind.Touched) {
        throw new Error(`lexer.kind !== Lexer.LexerKind.Touched: ${JSON.stringify(lexer)}`);
    }
    return lexer;
}

function touchedWithErrorLexerFactory(document: string): Lexer.TLexer {
    let lexer = Lexer.from(document);
    lexer = Lexer.remaining(lexer);

    if (!Lexer.hasError(lexer)) {
        throw new Error(`expected Lexer.hasError(lexer): ${JSON.stringify(lexer)}`);
    }
    return lexer;
}

describe("lexing errors", () => {
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

describe("incremental lexer", () => {
    it("appendToDocument '1' to '!' on Touched", () => {
        let lexer = touchedLexerFactory();
        lexer = Lexer.remaining(lexer);
        lexer = Lexer.appendToDocument(lexer, "1");
        lexer = Lexer.remaining(lexer);

        if (lexer.kind !== Lexer.LexerKind.Touched) {
            const details = JSON.stringify(lexer, null, 4);
            throw new Error(`expected lexer.kind === Lexer.LexerKind.Touched: ${details}`);
        }

        const lastRead = lexer.lastRead;
        expect(lastRead.documentStartIndex).to.equal(1, lastRead.documentStartIndex.toString());
        expect(lastRead.documentEndIndex).to.equal(2, lastRead.documentEndIndex.toString());
        expect(lastRead.comments).to.length(0, lastRead.comments.length.toString());

        expect(lastRead.tokens).to.length(1, lastRead.tokens.length.toString());
        expect(lastRead.tokens[0].kind).to.equal(TokenKind.NumericLiteral, lastRead.tokens[0].kind);
        expect(lastRead.tokens[0].data).to.equal("1", lastRead.tokens[0].data);
    });

    it("appendToDocument '1' to '0x' on TouchedError changes state", () => {
        let lexer = touchedWithErrorLexerFactory("0x");
        lexer = Lexer.appendToDocument(lexer, "1");
        expect(lexer.kind).to.equal(Lexer.LexerKind.Untouched, lexer.kind);
    })

    it("appendToDocument '1' to '0x' on TouchedError returns Ok", () => {
        let lexer = touchedWithErrorLexerFactory("0x");
        lexer = Lexer.appendToDocument(lexer, "1");

        lexer = Lexer.remaining(lexer);
        if (lexer.kind !== Lexer.LexerKind.Touched) {
            const details = JSON.stringify(lexer, null, 4);
            throw new Error(`expected lexer.kind === Lexer.LexerKind.Touched: ${details}`);
        }

        const lastRead = lexer.lastRead;
        expect(lastRead.documentStartIndex).to.equal(0, lastRead.documentStartIndex.toString());
        expect(lastRead.documentEndIndex).to.equal(3, lastRead.documentEndIndex.toString());
        expect(lastRead.comments).to.length(0, lastRead.comments.length.toString());

        expect(lastRead.tokens).to.length(1, lastRead.tokens.length.toString());
        expect(lastRead.tokens[0].kind).to.equal(TokenKind.HexLiteral, lastRead.tokens[0].kind);
        expect(lastRead.tokens[0].data).to.equal("0x1", lastRead.tokens[0].data);
    });
})
