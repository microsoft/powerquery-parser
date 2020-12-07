// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import { Assert, DefaultSettings, Language, Lexer } from "../../..";

export type AbridgedComments = ReadonlyArray<[Language.Comment.CommentKind, string]>;

export type AbridgedTokens = ReadonlyArray<[Language.Token.TokenKind, string]>;

export interface AbridgedSnapshot {
    readonly tokens: AbridgedTokens;
    readonly comments: AbridgedComments;
}

export type AbridgedLineTokens = ReadonlyArray<[Language.Token.LineTokenKind, string]>;

export function assertGetAbridgedSnapshotMatch(
    text: string,
    expected: AbridgedSnapshot,
    wrapped: boolean,
): Lexer.LexerSnapshot {
    if (wrapped) {
        const wrappedText: string = `wrapperOpen\n${text}\nwrapperClose`;
        const wrappedExpected: AbridgedSnapshot = {
            tokens: [
                [Language.Token.TokenKind.Identifier, "wrapperOpen"],
                ...expected.tokens,
                [Language.Token.TokenKind.Identifier, "wrapperClose"],
            ],
            comments: expected.comments,
        };
        assertGetAbridgedSnapshotMatch(wrappedText, wrappedExpected, false);
    }

    const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);
    const expectedTokens: AbridgedTokens = expected.tokens;
    const expectedComments: AbridgedComments = expected.comments;
    const actualTokens: AbridgedTokens = snapshot.tokens.map(token => [token.kind, token.data]);
    const actualComments: AbridgedComments = snapshot.comments.map(comment => [comment.kind, comment.data]);

    expect(actualTokens).deep.equal(expectedTokens);
    expect(actualComments).deep.equal(expectedComments);

    return snapshot;
}

export function assertGetLineTokenMatch(text: string, expected: AbridgedLineTokens, wrapped: boolean): Lexer.State {
    if (wrapped) {
        const wrappedText: string = `wrapperOpen\n${text}\nwrapperClose`;
        const wrappedExpected: AbridgedLineTokens = [
            [Language.Token.LineTokenKind.Identifier, "wrapperOpen"],
            ...expected,
            [Language.Token.LineTokenKind.Identifier, "wrapperClose"],
        ];
        assertGetLineTokenMatch(wrappedText, wrappedExpected, false);
    }

    const state: Lexer.State = assertGetLexOk(text);

    const tmp: [Language.Token.LineTokenKind, string][] = [];
    for (const line of state.lines) {
        for (const token of line.tokens) {
            tmp.push([token.kind, token.data]);
        }
    }
    const actual: AbridgedLineTokens = tmp;
    const tokenDetails: {} = {
        actual,
        expected,
    };
    expect(actual).deep.equal(expected, JSON.stringify(tokenDetails));

    return state;
}

export function assertGetSnapshotAbridgedTokens(
    text: string,
    expected: AbridgedTokens,
    wrapped: boolean,
): Lexer.LexerSnapshot {
    return assertGetAbridgedSnapshotMatch(
        text,
        {
            tokens: expected,
            comments: [],
        },
        wrapped,
    );
}

export function assertGetSnapshotAbridgedComments(
    text: string,
    expected: AbridgedComments,
    wrapped: boolean,
): Lexer.LexerSnapshot {
    return assertGetAbridgedSnapshotMatch(
        text,
        {
            tokens: [],
            comments: expected,
        },
        wrapped,
    );
}

export function assertGetLexOk(text: string): Lexer.State {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;

    if (Lexer.isErrorState(lexerState)) {
        const errorLineMap: Lexer.ErrorLineMap = Assert.asDefined(Lexer.maybeErrorLineMap(lexerState));
        const errorLines: ReadonlyArray<number> = [...errorLineMap.keys()];

        const details: {} = { errorLines };
        throw new Error(`AssertFailed: Lexer.isErrorState(state) ${JSON.stringify(details, undefined, 4)}`);
    }

    return lexerState;
}

export function assertGetLexerSnapshot(text: string): Lexer.LexerSnapshot {
    const state: Lexer.State = assertGetLexOk(text);
    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(state);
    Assert.isOk(triedSnapshot);

    return triedSnapshot.value;
}
