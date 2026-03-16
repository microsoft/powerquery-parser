// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Language, Lexer, ResultUtils, StringUtils } from "../../..";

function assertGetLexerSnapshot(text: string): Lexer.LexerSnapshot {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    ResultUtils.assertIsOk(triedLex);
    const state: Lexer.State = triedLex.value;

    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(state);
    ResultUtils.assertIsOk(triedSnapshot);

    return triedSnapshot.value;
}

// Asserts that for every token in the snapshot, the cached instance method produces
// the same GraphemePosition as the uncached static method.
function assertCachedMatchesUncached(text: string): Lexer.LexerSnapshot {
    const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);

    for (const token of snapshot.tokens) {
        const cached: StringUtils.GraphemePosition = snapshot.graphemePositionStartFrom(token);

        const uncached: StringUtils.GraphemePosition = Lexer.LexerSnapshot.graphemePositionStartFrom(
            snapshot.text,
            snapshot.lineTerminators,
            token,
        );

        expect(cached).to.deep.equal(
            uncached,
            `mismatch for token "${token.data}" at codeUnit ${token.positionStart.codeUnit}`,
        );
    }

    return snapshot;
}

describe("LexerSnapshot.graphemePositionStartFrom cache", () => {
    describe("cached matches uncached", () => {
        it("ASCII single line", () => {
            assertCachedMatchesUncached("let x = 1");
        });

        it("ASCII multi-line", () => {
            assertCachedMatchesUncached("let\n  x\n  = 1");
        });

        it("combining characters (n + combining tilde)", () => {
            // \u006E\u0303 = ñ as 2 code units, 1 grapheme cluster
            assertCachedMatchesUncached("let \u006E\u0303 = 1");
        });

        it("combining characters on multiple lines", () => {
            assertCachedMatchesUncached("let\n  \u006E\u0303\n  = 1");
        });

        it("CJK characters", () => {
            // CJK characters: each is 1 code unit, 1 grapheme
            assertCachedMatchesUncached('let x = "\u4e16\u754c"');
        });

        it("empty lines between tokens", () => {
            assertCachedMatchesUncached("let\n\n  x = 1");
        });

        it("CRLF line endings", () => {
            assertCachedMatchesUncached("let\r\n  x\r\n  = 1");
        });

        it("single token", () => {
            assertCachedMatchesUncached("1");
        });
    });

    describe("cache hit consistency", () => {
        it("repeated calls return identical results", () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot("let x = 1");
            const token: Language.Token.Token = snapshot.tokens[0];

            const first: StringUtils.GraphemePosition = snapshot.graphemePositionStartFrom(token);
            const second: StringUtils.GraphemePosition = snapshot.graphemePositionStartFrom(token);

            expect(first).to.deep.equal(second);
        });

        it("different tokens on same line share cache", () => {
            // "let x = 1" has 4 tokens all on line 0
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot("let x = 1");

            // Call for each token — all should use the same cache entry
            const positions: StringUtils.GraphemePosition[] = snapshot.tokens.map((token: Language.Token.Token) =>
                snapshot.graphemePositionStartFrom(token),
            );

            // All should be on line 0
            for (const pos of positions) {
                expect(pos.lineNumber).to.equal(0);
            }

            // Column numbers should be increasing
            for (let i: number = 1; i < positions.length; i += 1) {
                expect(positions[i].columnNumber).to.be.greaterThan(positions[i - 1].columnNumber);
            }
        });

        it("tokens on different lines use separate cache entries", () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot("let\n  x\n  = 1");

            // "let" on line 0, "x" on line 1, "=" on line 2, "1" on line 2
            const positions: StringUtils.GraphemePosition[] = snapshot.tokens.map((token: Language.Token.Token) =>
                snapshot.graphemePositionStartFrom(token),
            );

            expect(positions[0].lineNumber).to.equal(0);
            expect(positions[1].lineNumber).to.equal(1);
            expect(positions[2].lineNumber).to.equal(2);
            expect(positions[3].lineNumber).to.equal(2);
        });
    });
});
