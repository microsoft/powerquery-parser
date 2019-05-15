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
    text: string,
    expected: AbridgedSnapshot,
    wrapped: boolean,
): LexerSnapshot {
    if (wrapped) {
        const wrappedText = `wrapperOpen\n${text}\nwrapperClose`;
        const wrappedExpected: AbridgedSnapshot = {
            tokens: [
                [TokenKind.Identifier, "wrapperOpen"],
                ...expected.tokens,
                [TokenKind.Identifier, "wrapperClose"],
            ],
            comments: expected.comments,
        };
        expectAbridgedSnapshotMatch(wrappedText, wrappedExpected, false);
    }

    const snapshot = expectLexerSnapshot(text);
    const expectedTokens = expected.tokens;
    const expectedComments = expected.comments;
    const actualTokens = snapshot.tokens.map(token => [token.kind, token.data]);
    const actualComments = snapshot.comments.map(comment => [comment.kind, comment.data]);

    expect(actualTokens).deep.equal(expectedTokens);
    expect(actualComments).deep.equal(expectedComments);

    return snapshot;
}

export function expectLineTokenMatch(
    text: string,
    expected: AbridgedLineTokens,
    wrapped: boolean,
): Lexer.State {
    if (wrapped) {
        const wrappedText = `wrapperOpen\n${text}\nwrapperClose`;
        const wrappedExpected: AbridgedLineTokens = [
            [LineTokenKind.Identifier, "wrapperOpen"],
            ...expected,
            [LineTokenKind.Identifier, "wrapperClose"],
        ];
        expectLineTokenMatch(wrappedText, wrappedExpected, false);
    }

    const state = expectLexOk(text);

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
    text: string,
    expected: AbridgedTokens,
    wrapped: boolean,
): LexerSnapshot {
    return expectAbridgedSnapshotMatch(
        text,
        {
            tokens: expected,
            comments: [],
        },
        wrapped,
    );
}

export function expectSnapshotAbridgedComments(
    text: string,
    expected: AbridgedComments,
    wrapped: boolean,
): LexerSnapshot {
    return expectAbridgedSnapshotMatch(
        text,
        {
            tokens: [],
            comments: expected,
        },
        wrapped,
    );
}

export function expectLexOk(text: string): Lexer.State {
    const state: Lexer.State = Lexer.stateFrom(text);
    if (Lexer.isErrorState(state)) {
        const maybeErrorLines = Lexer.maybeErrorLines(state);
        if (!(maybeErrorLines !== undefined)) {
            throw new Error(`AssertFailed: maybeErrorLines !== undefined`);
        }
        const errorLines = maybeErrorLines;

        const details = { errorLines };
        throw new Error(`AssertFailed: Lexer.isErrorState(state) ${JSON.stringify(details, null, 4)}`);
    }

    return state;
}

export function expectLexerSnapshot(text: string): LexerSnapshot {
    const state = expectLexOk(text);
    const snapshotResult = LexerSnapshot.tryFrom(state);
    if (!(snapshotResult.kind === ResultKind.Ok)) {
        throw new Error("AssertFailed: snapshotResult.kind === ResultKind.Ok");
    }
    const snapshot = snapshotResult.value;

    return snapshot;
}
