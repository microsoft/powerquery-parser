import { Lexer } from "../../lexer";

export function touchedLexerFactory(): Lexer.TLexer {
    const document = "!";
    let lexer: Lexer.TLexer = Lexer.from(document);
    lexer = Lexer.remaining(lexer);

    if (lexer.kind !== Lexer.LexerKind.Touched) {
        throw new Error(`lexer.kind !== Lexer.LexerKind.Touched: ${JSON.stringify(lexer)}`);
    }
    return lexer;
}

export function touchedWithErrorLexerFactory(document: string): Lexer.TLexer {
    let lexer: Lexer.TLexer = Lexer.from(document);
    lexer = Lexer.remaining(lexer);

    if (!Lexer.hasError(lexer)) {
        throw new Error(`expected Lexer.hasError(lexer): ${JSON.stringify(lexer)}`);
    }
    return lexer;
}
