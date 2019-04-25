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

export function expectWrappedSnapshotAbridgedTokens(
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
    expectSnapshotAbridgedTokens(newDocument, lineTerminator, newExpected);
    return expectSnapshotAbridgedTokens(document, lineTerminator, expected);
}

export function expectWrappedSnapshotAbridgedComments(
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
    expectSnapshotAbridgedComments(newDocument, lineTerminator, newExpected);
    return expectSnapshotAbridgedComments(document, lineTerminator, expected);
}

export function expectSnapshotAbridgedTokens(
    document: string,
    lineTerminator: string,
    expected: AbridgedTokens,
): LexerSnapshot {
    return expectSnapshotAbridgedSnapshot(
        document,
        lineTerminator,
        {
            tokens: expected,
            comments: [],
        },
    );
}

export function expectSnapshotAbridgedComments(
    document: string,
    lineTerminator: string,
    expected: AbridgedComments,
): LexerSnapshot {
    return expectSnapshotAbridgedSnapshot(
        document,
        lineTerminator,
        {
            tokens: [],
            comments: expected,
        },
    );
}

export function expectSnapshotAbridgedSnapshot(
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
