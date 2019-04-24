import { expect } from "chai";
import { Lexer, LexerSnapshot, LexerState, TokenKind, CommentKind } from "../../lexer";

export type AbridgedComments = ReadonlyArray<[CommentKind, string]>;

export type AbridgedTokens = ReadonlyArray<[TokenKind, string]>;

export interface AbridgedSnapshot {
    readonly tokens: AbridgedTokens;
    readonly comments: AbridgedComments;
}

export function expectLexSuccess(document: string, separator: string): LexerState {
    const state: LexerState = Lexer.fromSplit(document, separator);
    if (Lexer.isErrorState(state)) {
        const maybeErrorLine = Lexer.maybeFirstErrorLine(state);
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

export function expectWrappedAbridgedTokens(
    document: string,
    separator: string,
    expected: AbridgedTokens,
): LexerSnapshot {
    const newDocument = `wrapperOpen${separator}${document}${separator}wrapperClose`;
    const newExpected: AbridgedTokens = [
        [TokenKind.Identifier, "wrapperOpen"],
        ...expected,
        [TokenKind.Identifier, "wrapperClose"],
    ];
    expectAbridgedTokens(newDocument, separator, newExpected);
    return expectAbridgedTokens(document, separator, expected);
}

export function expectWrappedAbridgedComments(
    document: string,
    separator: string,
    expected: AbridgedComments,
): LexerSnapshot {
    const newDocument = `/*wrapperOpen*/${separator}${document}${separator}/*wrapperClose*/`;
    const newExpected: AbridgedComments = [
        [CommentKind.Multiline, "/*wrapperOpen*/"],
        ...expected,
        [CommentKind.Multiline, "/*wrapperClose*/"],
    ];
    expectAbridgedComments(newDocument, separator, newExpected);
    return expectAbridgedComments(document, separator, expected);
}

export function expectAbridgedTokens(
    document: string,
    separator: string,
    expected: AbridgedTokens,
): LexerSnapshot {
    return expectAbridgedSnapshot(
        document,
        separator,
        {
            tokens: expected,
            comments: [],
        },
    );
}

export function expectAbridgedComments(
    document: string,
    separator: string,
    expected: AbridgedComments,
): LexerSnapshot {
    return expectAbridgedSnapshot(
        document,
        separator,
        {
            tokens: [],
            comments: expected,
        },
    );
}

export function expectAbridgedSnapshot(
    document: string,
    separator: string,
    expected: AbridgedSnapshot,
): LexerSnapshot {
    const snapshot = expectLexerSnapshot(document, separator);
    const expectedTokens = expected.tokens;
    const expectedComments = expected.comments;
    const actualTokens = snapshot.tokens.map(token => [token.kind, token.data]);
    const actualComments = snapshot.comments.map(comment => [comment.kind, comment.data]);

    const tokenDetails = {
        actual: actualTokens,
        expected: expectedTokens,
    };
    expect(actualTokens).deep.equal(expectedTokens, JSON.stringify(tokenDetails));

    const commentDetails = {
        actual: actualTokens,
        expected: expectedTokens,
    };
    expect(actualComments).deep.equal(expectedComments, JSON.stringify(commentDetails));
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
