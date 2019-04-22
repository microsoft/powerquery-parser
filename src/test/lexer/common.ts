import { expect } from "chai";
import { Lexer, LexerSnapshot, LexerState, TokenKind } from "../../lexer";

export function expectLexSuccess(document: string, separator: string): LexerState {
    const state: LexerState = Lexer.fromSplit(document, separator);
    if (Lexer.isErrorState(state)) {
        const maybeErrorLine = Lexer.firstErrorLine(state);
        if (maybeErrorLine === undefined) {
            throw new Error(`AssertFailed: maybeErrorLine === undefined`);
        }
        const errorLine = maybeErrorLine;

        const details = {
            errorLine,
            error: errorLine.error.message,
        };
        throw new Error(`AssertFailed: Lexer.isErrorState(state) ${JSON.stringify(details, null, 4)}`);
    }

    return state;
}

export function expectLexerSnapshot(document: string, separator: string): LexerSnapshot {
    const state = expectLexSuccess(document, separator);
    return new LexerSnapshot(state);
}

export function expectAbridgedTokens(
    document: string,
    separator: string,
    expected: ReadonlyArray<[TokenKind, string]>
): LexerSnapshot {
    const snapshot = expectLexerSnapshot(document, separator);
    const actual = snapshot.tokens.map(token => [token.kind, token.data]);
    const details = {
        actual,
        expected,
    };

    expect(actual).deep.equal(expected, JSON.stringify(details, null, 4));
    return snapshot;
}

// export function touchedLexerFactory(): Lexer.TLexer {
//     const document = "!";
//     let lexer: Lexer.TLexer = Lexer.from(document);
//     lexer = Lexer.remaining(lexer);

//     if (lexer.kind !== Lexer.LexerKind.Touched) {
//         throw new Error(`lexer.kind !== Lexer.LexerKind.Touched: ${JSON.stringify(lexer)}`);
//     }
//     return lexer;
// }

// export function touchedWithErrorLexerFactory(document: string): Lexer.TLexer {
//     let lexer: Lexer.TLexer = Lexer.from(document);
//     lexer = Lexer.remaining(lexer);

//     if (!Lexer.hasError(lexer)) {
//         throw new Error(`expected Lexer.hasError(lexer): ${JSON.stringify(lexer)}`);
//     }
//     return lexer;
// }
