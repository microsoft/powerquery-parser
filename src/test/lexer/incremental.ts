import { expect } from "chai";
import "mocha";
import { Lexer } from "../../lexer";
import { expectLexSuccess } from "./common";
import { ResultKind } from "../../common";

const LINE_TERMINATOR: string = `\n`;

type AbridgedTLexerLine = ReadonlyArray<[Lexer.LineKind, Lexer.LineMode, Lexer.LineMode, string]>;

function expectAbridgedTLexerLine(state: Lexer.State, expected: AbridgedTLexerLine) {
    const actual = state.lines.map((line: Lexer.TLine) => [line.kind, line.lineModeStart, line.lineModeEnd, line.lineString.text]);
    expect(actual).deep.equal(expected);
}

function expectLexerUpdateRangeOk(
    originalText: string,
    lineTerminator: string,
    newText: string,
    range: Lexer.Range,
): Lexer.State {
    let state = expectLexSuccess(originalText, lineTerminator);

    const stateResult = Lexer.updateRange(state, range, newText);
    if (!(stateResult.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: stateResult.kind === ResultKind.Ok ${JSON.stringify(stateResult, null, 4)}`);
    }

    return stateResult.value;
}

describe(`Lexer.Incremental`, () => {
    describe(`Error`, () => {
        it(`Lexer.UpdateLine(less than 0)`, () => {
            const state = expectLexSuccess(``, LINE_TERMINATOR);
            expect(() => Lexer.updateLine(state, ``, -1, undefined)).to.throw(`InvariantError: lineNumber < 0 : -1 < 0`);
        });

        it(`Lexer.UpdateLine(=== state.lines.length)`, () => {
            const state = expectLexSuccess(``, LINE_TERMINATOR);
            expect(() => Lexer.updateLine(state, ``, 1, undefined)).to.throw(`InvariantError: lineNumber >= numLines : 1 >= 1`);
        });

        it(`Lexer.UpdateLine(>= state.lines.length)`, () => {
            const state = expectLexSuccess(``, LINE_TERMINATOR);
            expect(() => Lexer.updateLine(state, ``, 2, undefined)).to.throw(`InvariantError: lineNumber >= numLines : 2 >= 1`);
        });
    });

    describe(`Lexer.updateRange`, () => {
        it(`foobar -> Xoobar`, () => {
            const range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
            };
            const state: Lexer.State = expectLexerUpdateRangeOk(
                `foobar`,
                LINE_TERMINATOR,
                "X",
                range
            );
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].lineString.text).to.equal("Xoobar");
        });

        it(`foobar -> X`, () => {
            let range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 0,
                    columnNumber: 5,
                },
            };
            const state: Lexer.State = expectLexerUpdateRangeOk(
                `foobar`,
                LINE_TERMINATOR,
                "X",
                range
            );
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].lineString.text).to.equal("X");
        });

        it(`foo\\nbar -> X`, () => {
            let range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 1,
                    columnNumber: 2,
                },
            };
            const state: Lexer.State = expectLexerUpdateRangeOk(
                `foo\nbar`,
                LINE_TERMINATOR,
                "X",
                range
            );
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].lineString.text).to.equal("X");
        });

        it(`foo\\nbar -> fXr`, () => {
            let range: Lexer.Range = {
                start: {
                    lineNumber: 0,
                    columnNumber: 1,
                },
                end: {
                    lineNumber: 1,
                    columnNumber: 1,
                },
            };
            const state: Lexer.State = expectLexerUpdateRangeOk(
                `foo\nbar`,
                LINE_TERMINATOR,
                "X",
                range
            );
            expect(state.lines.length).to.equal(1);
            expect(state.lines[0].lineString.text).to.equal("fXr");
        });

        it(`foo\\nbar\\baz -> foo\\nX\\nbaz`, () => {
            let range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    columnNumber: 0,
                },
                end: {
                    lineNumber: 1,
                    columnNumber: 2,
                },
            };
            const state: Lexer.State = expectLexerUpdateRangeOk(
                `foo\nbar\nbaz`,
                LINE_TERMINATOR,
                "X",
                range
            );
            expect(state.lines.length).to.equal(3);
            expect(state.lines[0].lineString.text).to.equal("foo");
            expect(state.lines[1].lineString.text).to.equal("X");
            expect(state.lines[2].lineString.text).to.equal("baz");
        });

        it(`foo\\nbar\\baz -> foo\\nbXr\\nbaz`, () => {
            let range: Lexer.Range = {
                start: {
                    lineNumber: 1,
                    columnNumber: 1,
                },
                end: {
                    lineNumber: 1,
                    columnNumber: 1,
                },
            };
            const state: Lexer.State = expectLexerUpdateRangeOk(
                `foo\nbar\nbaz`,
                LINE_TERMINATOR,
                "X",
                range
            );
            expect(state.lines.length).to.equal(3);
            expect(state.lines[0].lineString.text).to.equal("foo");
            expect(state.lines[1].lineString.text).to.equal("bXr");
            expect(state.lines[2].lineString.text).to.equal("baz");
        });
    });

    describe(`Lexer.updateLine`, () => {
        describe(`single line`, () => {
            it(`identifier -> identifier`, () => {
                let state = expectLexSuccess(`foo`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foo`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 0, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`identifier -> unterminated string`, () => {
                let state = expectLexSuccess(`foo`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foo`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `"`, 0, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`unterminated string -> identifier`, () => {
                let state = expectLexSuccess(`"`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 0, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });
        });

        describe(`multiple lines, no mode change`, () => {
            it(`first`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 0, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`middle`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 1, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`last`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 2, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });
        });

        describe(`multiple lines, default mode to string mode`, () => {
            it(`first`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `"`, 0, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.String, Lexer.LineMode.String, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.String, Lexer.LineMode.String, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`middle`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `"`, 1, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.String, Lexer.LineMode.String, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`last`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `"`, 2, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });
        });

        describe(`multiple lines, string mode to default mode`, () => {
            it(`first`, () => {
                let state = expectLexSuccess(`"${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.String, Lexer.LineMode.String, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.String, Lexer.LineMode.String, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 0, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`middle`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}"${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.String, Lexer.LineMode.String, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 1, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `charlie`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });

            it(`last`, () => {
                let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}"`, LINE_TERMINATOR);
                let expected: AbridgedTLexerLine = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.String, `"`],
                ];
                expectAbridgedTLexerLine(state, expected);

                state = Lexer.updateLine(state, `foobar`, 2, undefined);
                expected = [
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `alpha`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `bravo`],
                    [Lexer.LineKind.Touched, Lexer.LineMode.Default, Lexer.LineMode.Default, `foobar`],
                ];
                expectAbridgedTLexerLine(state, expected);
            });
        });
    });
});
