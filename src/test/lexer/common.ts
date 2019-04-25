import { expect } from "chai";
import { ResultKind } from "../../common";
import { CommentKind, Lexer, LexerSnapshot, LineTokenKind, TokenKind } from "../../lexer";

export type AbridgedComments = ReadonlyArray<[CommentKind, string]>;

export type AbridgedTokens = ReadonlyArray<[TokenKind, string]>;

export interface AbridgedSnapshot {
    readonly tokens: AbridgedTokens;
    readonly comments: AbridgedComments;
}

export type AbridgedLineTokens = ReadonlyArray<[LineTokenKind, string]>;

export function expectAbridgedSnapshotMatch(
    document: string,
    lineTerminator: string,
    expected: AbridgedSnapshot,
    wrapped: boolean,
): LexerSnapshot {
    if (wrapped) {
        const newDocument = `wrapperOpen${lineTerminator}${document}${lineTerminator}wrapperClose`;
        const newExpected: AbridgedSnapshot = {
            tokens: [
                [TokenKind.Identifier, "wrapperOpen"],
                ...expected.tokens,
                [TokenKind.Identifier, "wrapperClose"],
            ],
            comments: expected.comments,
        };
        expectAbridgedSnapshotMatch(newDocument, lineTerminator, newExpected, false);
    }

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

export function expectLineTokenMatch(
    document: string,
    lineTerminator: string,
    expected: AbridgedLineTokens,
    wrapped: boolean,
): Lexer.LexerState {
    if (wrapped) {
        const newDocument = `wrapperOpen${lineTerminator}${document}${lineTerminator}wrapperClose`;
        const newExpected: AbridgedLineTokens = [
            [LineTokenKind.Identifier, "wrapperOpen"],
            ...expected,
            [LineTokenKind.Identifier, "wrapperClose"],
        ];
        expectLineTokenMatch(newDocument, lineTerminator, newExpected, false);
    }

    const state = expectLexSuccess(document, lineTerminator);

    const tmp: [LineTokenKind, string][] = [];
    for (let line of state.lines) {
        for (let token of line.tokens) {
            tmp.push([token.kind, token.data]);
        }
    }
    const actual: AbridgedLineTokens = tmp;
    const tokenDetails = {
        actual,
        expected,
    };
    expect(actual).deep.equal(expected, JSON.stringify(tokenDetails));

    return state;
}

export function expectSnapshotAbridgedTokens(
    document: string,
    lineTerminator: string,
    expected: AbridgedTokens,
    wrapped: boolean,
): LexerSnapshot {
    return expectAbridgedSnapshotMatch(
        document,
        lineTerminator,
        {
            tokens: expected,
            comments: [],
        },
        wrapped,
    );
}

export function expectSnapshotAbridgedComments(
    document: string,
    lineTerminator: string,
    expected: AbridgedComments,
    wrapped: boolean,
): LexerSnapshot {
    return expectAbridgedSnapshotMatch(
        document,
        lineTerminator,
        {
            tokens: [],
            comments: expected,
        },
        wrapped,
    );
}

function expectLexSuccess(document: string, lineTerminator: string): Lexer.LexerState {
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

function expectLexerSnapshot(document: string, lineTerminator: string): LexerSnapshot {
    const state = expectLexSuccess(document, lineTerminator);
    const snapshotResult = LexerSnapshot.tryFrom(state);
    if (snapshotResult.kind === ResultKind.Err) {
        throw new Error("AssertFailed: snapshotResult.kind !== ResultKind.Err");
    }
    const snapshot = snapshotResult.value;

    return snapshot;
}
