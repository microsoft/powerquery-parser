// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { DefaultSettings, Language, Lexer, ResultUtils, StringUtils } from "../../..";
import { ArrayUtils } from "../../../powerquery-parser/common";

function assertGetLexerSnapshot(text: string): Lexer.LexerSnapshot {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    ResultUtils.assertIsOk(triedLex);

    return triedLex.value;
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
            const token: Language.Token.Token = ArrayUtils.assertGet(snapshot.tokens, 0);

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
                expect(ArrayUtils.assertGet(positions, i).columnNumber).to.be.greaterThan(
                    ArrayUtils.assertGet(positions, i - 1).columnNumber,
                );
            }
        });

        it("tokens on different lines use separate cache entries", () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot("let\n  x\n  = 1");

            // "let" on line 0, "x" on line 1, "=" on line 2, "1" on line 2
            const positions: StringUtils.GraphemePosition[] = snapshot.tokens.map((token: Language.Token.Token) =>
                snapshot.graphemePositionStartFrom(token),
            );

            expect(ArrayUtils.assertGet(positions, 0).lineNumber).to.equal(0);
            expect(ArrayUtils.assertGet(positions, 1).lineNumber).to.equal(1);
            expect(ArrayUtils.assertGet(positions, 2).lineNumber).to.equal(2);
            expect(ArrayUtils.assertGet(positions, 3).lineNumber).to.equal(2);
        });
    });

    describe("codeUnit correctness", () => {
        it("codeUnit should reflect the token start position, not end", () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot("let x = 1");

            for (const token of snapshot.tokens) {
                const position: StringUtils.GraphemePosition = snapshot.graphemePositionStartFrom(token);

                expect(position.codeUnit).to.equal(
                    token.positionStart.codeUnit,
                    `graphemePositionStartFrom("${token.data}") returned codeUnit ${position.codeUnit} ` +
                        `but token.positionStart.codeUnit is ${token.positionStart.codeUnit}`,
                );
            }
        });

        it("static graphemePositionStartFrom returns start codeUnit", () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot("let x = 1");

            for (const token of snapshot.tokens) {
                const position: StringUtils.GraphemePosition = Lexer.LexerSnapshot.graphemePositionStartFrom(
                    snapshot.text,
                    snapshot.lineTerminators,
                    token,
                );

                expect(position.codeUnit).to.equal(
                    token.positionStart.codeUnit,
                    `static graphemePositionStartFrom("${token.data}") returned codeUnit ${position.codeUnit} ` +
                        `but token.positionStart.codeUnit is ${token.positionStart.codeUnit}`,
                );
            }
        });
    });

    describe("indexed starting-line lookup", () => {
        for (const newline of ["\n", "\r\n", "\u2028", "\u2029"]) {
            it(`preserves multiline token columns with ${JSON.stringify(newline)}`, () => {
                const text: string = `\n${newline}A\u0301 \u{10400} "first${newline}second" #"third${newline}fourth" tail`;

                const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);
                const textToken: Language.Token.Token = ArrayUtils.assertGet(snapshot.tokens, 2);
                const identifierToken: Language.Token.Token = ArrayUtils.assertGet(snapshot.tokens, 3);

                const expectedTextPosition: StringUtils.GraphemePosition = {
                    codeUnit: text.indexOf('"first'),
                    lineNumber: 2,
                    lineCodeUnit: 6,
                    columnNumber: 4,
                };

                const expectedIdentifierPosition: StringUtils.GraphemePosition = {
                    codeUnit: text.indexOf('#"third'),
                    lineNumber: 3,
                    lineCodeUnit: 8,
                    columnNumber: 8,
                };

                for (const token of [...snapshot.tokens].reverse()) {
                    snapshot.graphemePositionStartFrom(token);
                }

                expect(snapshot.graphemePositionStartFrom(textToken)).to.deep.equal(expectedTextPosition);
                expect(snapshot.graphemePositionStartFrom(identifierToken)).to.deep.equal(expectedIdentifierPosition);

                expect(
                    Lexer.LexerSnapshot.graphemePositionStartFrom(text, snapshot.lineTerminators, textToken),
                ).to.deep.equal(expectedTextPosition);

                expect(snapshot.graphemePositionStartFrom(ArrayUtils.assertGet(snapshot.tokens, 0))).to.deep.equal({
                    codeUnit: 1 + newline.length,
                    lineNumber: 2,
                    lineCodeUnit: 0,
                    columnNumber: 0,
                });
            });
        }

        it("reads only the starting line's terminator and reuses it through the cache", () => {
            const text: string = `${"\n".repeat(4096)}"first\nsecond"`;
            const original: Lexer.LexerSnapshot = assertGetLexerSnapshot(text);
            const accessedIndices: number[] = [];

            const lineTerminators: ReadonlyArray<Lexer.LineTerminator> = new Proxy(original.lineTerminators, {
                get: (
                    target: ReadonlyArray<Lexer.LineTerminator>,
                    property: string | symbol,
                    receiver: unknown,
                ): unknown => {
                    if (typeof property === "string" && /^\d+$/.test(property)) {
                        accessedIndices.push(Number(property));
                    }

                    return Reflect.get(target, property, receiver);
                },
            });

            const snapshot: Lexer.LexerSnapshot = new Lexer.LexerSnapshot(
                text,
                original.tokens,
                original.comments,
                lineTerminators,
            );

            const token: Language.Token.Token = ArrayUtils.assertGet(snapshot.tokens, 0);
            const first: StringUtils.GraphemePosition = snapshot.graphemePositionStartFrom(token);
            expect(accessedIndices).to.deep.equal([4096]);
            expect(first).to.deep.equal({ codeUnit: 4096, lineNumber: 4096, lineCodeUnit: 0, columnNumber: 0 });

            expect(snapshot.graphemePositionStartFrom(token)).to.deep.equal(first);
            expect(accessedIndices).to.deep.equal([4096]);

            expect(Lexer.LexerSnapshot.graphemePositionStartFrom(text, lineTerminators, token)).to.deep.equal(first);
            expect(accessedIndices).to.deep.equal([4096, 4096]);
        });

        it("uses the final unterminated line for EOF token positions", () => {
            const snapshot: Lexer.LexerSnapshot = assertGetLexerSnapshot("\r\nA\u0301 value");
            const token: Language.Token.Token = ArrayUtils.assertGet(snapshot.tokens, 1);

            const expected: StringUtils.GraphemePosition = {
                codeUnit: 5,
                lineNumber: 1,
                lineCodeUnit: 3,
                columnNumber: 2,
            };

            expect(snapshot.graphemePositionStartFrom(token)).to.deep.equal(expected);

            expect(
                Lexer.LexerSnapshot.graphemePositionStartFrom(snapshot.text, snapshot.lineTerminators, token),
            ).to.deep.equal(expected);
        });
    });
});
