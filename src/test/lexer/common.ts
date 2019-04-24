import { expect } from "chai";
import { ResultKind } from "../../common";
import { CommentKind, Lexer, LexerSnapshot, TokenKind } from "../../lexer";

export type AbridgedComments = ReadonlyArray<[CommentKind, string]>;

export type AbridgedTokens = ReadonlyArray<[TokenKind, string]>;

export interface AbridgedSnapshot {
    readonly tokens: AbridgedTokens;
    readonly comments: AbridgedComments;
}

export function expectLexSuccess(document: string, lineTerminator: string): Lexer.LexerState {
    const state: Lexer.LexerState = Lexer.fromSplit(document, lineTerminator);
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

export function expectLexerSnapshot(document: string, lineTerminator: string): LexerSnapshot {
    const state = expectLexSuccess(document, lineTerminator);
    const snapshotResult = LexerSnapshot.tryFrom(state);
    if (snapshotResult.kind === ResultKind.Err) {
        throw new Error("AssertFailed: snapshotResult.kind !== ResultKind.Err");
    }
    const snapshot = snapshotResult.value;

    return snapshot;
}

export function expectWrappedAbridgedTokens(
    document: string,
    lineTerminator: string,
    expected: AbridgedTokens,
): LexerSnapshot {
    const newDocument = `wrapperOpen${lineTerminator}${document}${lineTerminator}wrapperClose`;
    const newExpected: AbridgedTokens = [
        [TokenKind.Identifier, "wrapperOpen"],
        ...expected,
        [TokenKind.Identifier, "wrapperClose"],
    ];
    expectAbridgedTokens(newDocument, lineTerminator, newExpected);
    return expectAbridgedTokens(document, lineTerminator, expected);
}

export function expectWrappedAbridgedComments(
    document: string,
    lineTerminator: string,
    expected: AbridgedComments,
): LexerSnapshot {
    const newDocument = `/*wrapperOpen*/${lineTerminator}${document}${lineTerminator}/*wrapperClose*/`;
    const newExpected: AbridgedComments = [
        [CommentKind.Multiline, "/*wrapperOpen*/"],
        ...expected,
        [CommentKind.Multiline, "/*wrapperClose*/"],
    ];
    expectAbridgedComments(newDocument, lineTerminator, newExpected);
    return expectAbridgedComments(document, lineTerminator, expected);
}

export function expectAbridgedTokens(
    document: string,
    lineTerminator: string,
    expected: AbridgedTokens,
): LexerSnapshot {
    return expectAbridgedSnapshot(
        document,
        lineTerminator,
        {
            tokens: expected,
            comments: [],
        },
    );
}

export function expectAbridgedComments(
    document: string,
    lineTerminator: string,
    expected: AbridgedComments,
): LexerSnapshot {
    return expectAbridgedSnapshot(
        document,
        lineTerminator,
        {
            tokens: [],
            comments: expected,
        },
    );
}

export function expectAbridgedSnapshot(
    document: string,
    lineTerminator: string,
    expected: AbridgedSnapshot,
): LexerSnapshot {
    const snapshot = expectLexerSnapshot(document, lineTerminator);
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
