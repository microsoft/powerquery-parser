// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert } from "../../../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../../lexer";
import { assertLexOk } from "./common";

const LINE_TERMINATOR: string = `\n`;

type AbridgedTLexerLine = ReadonlyArray<[Lexer.LineKind, Lexer.LineMode, Lexer.LineMode, string]>;

function assertAbridgedTLexerLine(state: Lexer.State, expected: AbridgedTLexerLine): void {
    const actual: AbridgedTLexerLine = state.lines.map((line: Lexer.TLine) => [
        line.kind,
        line.lineModeStart,
        line.lineModeEnd,
        line.text,
    ]);
    expect(actual).deep.equal(expected);
}

function assertLexerUpdateRangeOk(originalText: string, newText: string, range: Lexer.Range): Lexer.State {
    const state: Lexer.State = assertLexOk(originalText);
    const triedLexerUpdate: Lexer.TriedLex = Lexer.tryUpdateRange(state, range, newText);
    Assert.isOk(triedLexerUpdate);

    return triedLexerUpdate.value;
}

function assertLexerUpdateLine(
    originalText: string,
    expectedOriginal: AbridgedTLexerLine,
    lineNumber: number,
    newText: string,
    expectedUpdate: AbridgedTLexerLine,
): Lexer.State {
    let state: Lexer.State = assertLexOk(originalText);
    assertAbridgedTLexerLine(state, expectedOriginal);

    const triedLexerUpdate: Lexer.TriedLex = Lexer.tryUpdateLine(state, lineNumber, newText);
    Assert.isOk(triedLexerUpdate);

    state = triedLexerUpdate.value;
    assertAbridgedTLexerLine(triedLexerUpdate.value, expectedUpdate);

    return state;
}

function assertLexerUpdateLineAlphaBravoCharlie(
    newText: string,
    lineNumber: number,
    expectedUpdate: AbridgedTLexerLine,
): Lexer.State {
    const originalText: string = `alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`;
    const originalExpected: AbridgedTLexerLine = [
        [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
        [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
        [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
    ];
    return assertLexerUpdateLine(originalText, originalExpected, lineNumber, newText, expectedUpdate);
}

describe(`Lexer.Incremental`, () => {
    describe(`Lexer.updateRange`, () => {
        it(`foobar -> Xfoobar`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foobar`, "X", range);
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].text).to.equal("Xfoobar");
        });

        it(`foobar -> fooXbar`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 3,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 3,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foobar`, "X", range);
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].text).to.equal("fooXbar");
        });

        it(`foobar -> Xoobar`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foobar`, "X", range);
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].text).to.equal("Xoobar");
        });

        it(`foobar -> X`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 0,
                    lineCodeUnit: 6,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foobar`, "X", range);
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].text).to.equal("X");
        });

        it(`foo\\nbar -> X`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 1,
                    lineCodeUnit: 3,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foo\nbar`, "X", range);
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].text).to.equal("X");
        });

        it(`foo\\nbar -> fXr`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                },
                end: {
                    lineNumber: 1,
                    lineCodeUnit: 2,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foo\nbar`, "X", range);
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].text).to.equal("fXr");
        });

        it(`foo\\nbar\\baz -> foo\\nX\\nbaz`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    lineCodeUnit: 0,
                },
                end: {
                    lineNumber: 1,
                    lineCodeUnit: 3,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foo\nbar\nbaz`, "X", range);
            expect(state.lines.length).to.equal(3);
            expect(state.lines[0].text).to.equal("foo");
            expect(state.lines[1].text).to.equal("X");
            expect(state.lines[2].text).to.equal("baz");
        });

        it(`foo\\nbar\\baz -> foo\\nbXr\\nbaz`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    lineCodeUnit: 1,
                },
                end: {
                    lineNumber: 1,
                    lineCodeUnit: 2,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(`foo\nbar\nbaz`, "X", range);
            expect(state.lines.length).to.equal(3);
            expect(state.lines[0].text).to.equal("foo");
            expect(state.lines[1].text).to.equal("bXr");
            expect(state.lines[2].text).to.equal("baz");
        });

        it(`lineTerminator maintained on single line change`, () => {
            const original: string = `foo\nbar\nbaz`;
            const range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    lineCodeUnit: 1,
                },
                end: {
                    lineNumber: 1,
                    lineCodeUnit: 2,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(original, "X", range);

            const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
            Assert.isOk(triedSnapshot);
            const snapshot: LexerSnapshot = triedSnapshot.value;
            expect(snapshot.text).equals(`foo\nbXr\nbaz`, "expected snapshot text doesn't match");
        });

        it(`lineTerminator maintained on multiline change`, () => {
            const original: string = `foo\nbar\nbaz\nboo`;
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                },
                end: {
                    lineNumber: 2,
                    lineCodeUnit: 1,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(original, "OO\nB", range);
            expect(state.lines.length).to.equal(3);

            const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
            Assert.isOk(triedSnapshot);
            const snapshot: LexerSnapshot = triedSnapshot.value;
            expect(snapshot.text).equals(`fOO\nBaz\nboo`, "expected snapshot text doesn't match");
        });

        it(`text match on multiline deconstion`, () => {
            const original: string = `foo\nbar\nbaz\nboo`;
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    lineCodeUnit: 1,
                },
                end: {
                    lineNumber: 2,
                    lineCodeUnit: 1,
                },
            };
            const state: Lexer.State = assertLexerUpdateRangeOk(original, "", range);

            expect(state.lines.length).to.equal(2);

            const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
            Assert.isOk(triedSnapshot);
            const snapshot: LexerSnapshot = triedSnapshot.value;
            expect(snapshot.text).equals("faz\nboo", "expected snapshot text doesn't match");
        });
    });

    describe(`Lexer.updateLine`, () => {
        describe(`single line`, () => {
            it(`identifier -> identifier`, () => {
                assertLexerUpdateLine(
                    `foo`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foo`]],
                    0,
                    `foobar`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`]],
                );
            });

            it(`identifier -> unterminated string`, () => {
                assertLexerUpdateLine(
                    `foo`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foo`]],
                    0,
                    `"`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Text, `"`]],
                );
            });

            it(`unterminated string -> identifier`, () => {
                assertLexerUpdateLine(
                    `"`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Text, `"`]],
                    0,
                    `foobar`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`]],
                );
            });
        });

        describe(`multiple lines, no mode change`, () => {
            it(`first`, () => {
                assertLexerUpdateLine(
                    `"`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Text, `"`]],
                    0,
                    `foobar`,
                    [[Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`]],
                );
            });

            it(`first`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`foobar`, 0, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ]);
            });

            it(`middle`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`foobar`, 1, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ]);
            });

            it(`last`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`foobar`, 2, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                ]);
            });
        });

        describe(`multiple lines, default mode to string mode`, () => {
            it(`first`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`"`, 0, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Text, `"`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Text, Lexer.LineMode.Text, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Text, Lexer.LineMode.Text, `charlie`],
                ]);
            });

            it(`middle`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`"`, 1, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Text, `"`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Text, Lexer.LineMode.Text, `charlie`],
                ]);
            });

            it(`last`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`"`, 2, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Text, `"`],
                ]);
            });
        });

        describe(`multiple lines, string mode to default mode`, () => {
            it(`first`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`foobar`, 0, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ]);
            });

            it(`middle`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`foobar`, 1, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ]);
            });

            it(`last`, () => {
                assertLexerUpdateLineAlphaBravoCharlie(`foobar`, 2, [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                ]);
            });
        });
    });
});
