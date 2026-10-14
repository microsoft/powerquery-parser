// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import { DefaultSettings, Language, Lexer, ResultUtils } from "../..";

export type AbridgedComments = ReadonlyArray<[Language.Comment.CommentKind, string]>;

export type AbridgedTokens = ReadonlyArray<[Language.Token.TokenKind, string]>;

export interface AbridgedSnapshot {
    readonly tokens: AbridgedTokens;
    readonly comments: AbridgedComments;
}

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
    const actualTokens: AbridgedTokens = snapshot.tokens.map((token: Language.Token.Token) => [token.kind, token.data]);

    const actualComments: AbridgedComments = snapshot.comments.map((comment: Language.Comment.TComment) => [
        comment.kind,
        comment.data,
    ]);

    expect(actualTokens).deep.equal(expectedTokens);
    expect(actualComments).deep.equal(expectedComments);

    return snapshot;
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

export function assertGetLexerSnapshot(text: string): Lexer.LexerSnapshot {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    ResultUtils.assertIsOk(triedLex);

    return triedLex.value;
}
