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

export function assertAbridgedSnapshotMatch(text: string, expected: AbridgedSnapshot, wrapped: boolean): LexerSnapshot {
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
        assertAbridgedSnapshotMatch(wrappedText, wrappedExpected, false);
    }

    const snapshot: LexerSnapshot = assertLexerSnapshot(text);
    const expectedTokens: AbridgedTokens = expected.tokens;
    const expectedComments: AbridgedComments = expected.comments;
    const actualTokens: AbridgedTokens = snapshot.tokens.map(token => [token.kind, token.data]);
    const actualComments: AbridgedComments = snapshot.comments.map(comment => [comment.kind, comment.data]);

    expect(actualTokens).deep.equal(expectedTokens);
    expect(actualComments).deep.equal(expectedComments);

    return snapshot;
}

export function assertLineTokenMatch(text: string, expected: AbridgedLineTokens, wrapped: boolean): Lexer.State {
    if (wrapped) {
        const wrappedText: string = `wrapperOpen\n${text}\nwrapperClose`;
        const wrappedExpected: AbridgedLineTokens = [
            [Language.LineTokenKind.Identifier, "wrapperOpen"],
            ...expected,
            [Language.LineTokenKind.Identifier, "wrapperClose"],
        ];
        assertLineTokenMatch(wrappedText, wrappedExpected, false);
    }

    const state: Lexer.State = assertLexOk(text);

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

export function assertSnapshotAbridgedTokens(text: string, expected: AbridgedTokens, wrapped: boolean): LexerSnapshot {
    return assertAbridgedSnapshotMatch(
        text,
        {
            tokens: expected,
            comments: [],
        },
        wrapped,
    );
}

export function assertSnapshotAbridgedComments(
    text: string,
    expected: AbridgedComments,
    wrapped: boolean,
): LexerSnapshot {
    return assertAbridgedSnapshotMatch(
        text,
        {
            tokens: [],
            comments: expected,
        },
        wrapped,
    );
}

export function assertLexOk(text: string): Lexer.State {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;

    if (Lexer.isErrorState(lexerState)) {
        const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(lexerState);
        Assert.isDefined(maybeErrorLineMap);
        const errorLines: ReadonlyArray<number> = [...maybeErrorLineMap.keys()];

        const details: {} = { errorLines };
        throw new Error(`AssertFailed: Lexer.isErrorState(state) ${JSON.stringify(details, undefined, 4)}`);
    }

    return lexerState;
}

export function assertLexerSnapshot(text: string): LexerSnapshot {
    const state: Lexer.State = assertLexOk(text);
    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    Assert.isOk(triedSnapshot);

    return triedSnapshot.value;
}
