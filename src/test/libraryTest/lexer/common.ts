// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import { Language } from "../../..";
import { Assert } from "../../../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../../lexer";
import { DefaultSettings } from "../../../settings";

export type AbridgedComments = ReadonlyArray<[Language.CommentKind, string]>;

export type AbridgedTokens = ReadonlyArray<[Language.TokenKind, string]>;

export interface AbridgedSnapshot {
    readonly tokens: AbridgedTokens;
    readonly comments: AbridgedComments;
}

export type AbridgedLineTokens = ReadonlyArray<[Language.LineTokenKind, string]>;

export function expectAbridgedSnapshotMatch(text: string, expected: AbridgedSnapshot, wrapped: boolean): LexerSnapshot {
    if (wrapped) {
        const wrappedText: string = `wrapperOpen\n${text}\nwrapperClose`;
        const wrappedExpected: AbridgedSnapshot = {
            tokens: [
                [Language.TokenKind.Identifier, "wrapperOpen"],
                ...expected.tokens,
                [Language.TokenKind.Identifier, "wrapperClose"],
            ],
            comments: expected.comments,
        };
        expectAbridgedSnapshotMatch(wrappedText, wrappedExpected, false);
    }

    const snapshot: LexerSnapshot = expectLexerSnapshot(text);
    const expectedTokens: AbridgedTokens = expected.tokens;
    const expectedComments: AbridgedComments = expected.comments;
    const actualTokens: AbridgedTokens = snapshot.tokens.map(token => [token.kind, token.data]);
    const actualComments: AbridgedComments = snapshot.comments.map(comment => [comment.kind, comment.data]);

    expect(actualTokens).deep.equal(expectedTokens);
    expect(actualComments).deep.equal(expectedComments);

    return snapshot;
}

export function expectLineTokenMatch(text: string, expected: AbridgedLineTokens, wrapped: boolean): Lexer.State {
    if (wrapped) {
        const wrappedText: string = `wrapperOpen\n${text}\nwrapperClose`;
        const wrappedExpected: AbridgedLineTokens = [
            [Language.LineTokenKind.Identifier, "wrapperOpen"],
            ...expected,
            [Language.LineTokenKind.Identifier, "wrapperClose"],
        ];
        expectLineTokenMatch(wrappedText, wrappedExpected, false);
    }

    const state: Lexer.State = expectLexOk(text);

    const tmp: [Language.LineTokenKind, string][] = [];
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

export function expectSnapshotAbridgedTokens(text: string, expected: AbridgedTokens, wrapped: boolean): LexerSnapshot {
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
    const state: Lexer.State = Lexer.stateFrom(DefaultSettings, text);
    if (Lexer.isErrorState(state)) {
        const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(state);
        Assert.isDefined(maybeErrorLineMap);
        const errorLines: ReadonlyArray<number> = [...maybeErrorLineMap.keys()];

        const details: {} = { errorLines };
        throw new Error(`AssertFailed: Lexer.isErrorState(state) ${JSON.stringify(details, undefined, 4)}`);
    }

    return state;
}

export function expectLexerSnapshot(text: string): LexerSnapshot {
    const state: Lexer.State = expectLexOk(text);
    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    Assert.isOk(triedSnapshot);

    return triedSnapshot.value;
}
