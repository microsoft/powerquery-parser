import { expect } from "chai";
import "mocha";
import { Lexer } from "../../lexer";
import { expectLexSuccess } from "./common";

const LINE_TERMINATOR: string = `\n`;

type AbridgedTLexerLine = ReadonlyArray<[Lexer.LexerLineKind, Lexer.LexerLineMode, string]>;

function expectAbridgedTLexerLine(state: Lexer.LexerState, expected: AbridgedTLexerLine) {
    const actual = state.lines.map(line => [line.kind, line.lineMode, line.lineString.text]);
    expect(actual).deep.equal(expected);
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

    describe(`updateLine`, () => {
        it(`update solo line`, () => {
            let state = expectLexSuccess(`foo`, LINE_TERMINATOR);
            let expected: AbridgedTLexerLine = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `foo`],
            ];
            expectAbridgedTLexerLine(state, expected);

            state = Lexer.updateLine(state, `foobar`, 0, undefined);
            expected = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `foobar`],
            ];
            expectAbridgedTLexerLine(state, expected);
        });

        it(`update multiline - first`, () => {
            let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
            let expected: AbridgedTLexerLine = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);

            state = Lexer.updateLine(state, `foobar`, 0, undefined);
            expected = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `foobar`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);
        });

        it(`update multiline - middle`, () => {
            let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
            let expected: AbridgedTLexerLine = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);

            state = Lexer.updateLine(state, `foobar`, 1, undefined);
            expected = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `foobar`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);
        });

        it(`update multiline - last`, () => {
            let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
            let expected: AbridgedTLexerLine = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);

            state = Lexer.updateLine(state, `foobar`, 2, undefined);
            expected = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `foobar`],
            ];
            expectAbridgedTLexerLine(state, expected);
        });

        it(`update multiline - mode change - first`, () => {
            let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
            let expected: AbridgedTLexerLine = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);

            state = Lexer.updateLine(state, `"`, 0, undefined);
            expected = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.String, `"`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.String, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.String, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);
        });

        it(`update multiline - mode change - middle`, () => {
            let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
            let expected: AbridgedTLexerLine = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);

            state = Lexer.updateLine(state, `"`, 1, undefined);
            expected = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.String, `"`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.String, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);
        });

        it(`update multiline - mode change - last`, () => {
            let state = expectLexSuccess(`alpha${LINE_TERMINATOR}bravo${LINE_TERMINATOR}charlie`, LINE_TERMINATOR);
            let expected: AbridgedTLexerLine = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `charlie`],
            ];
            expectAbridgedTLexerLine(state, expected);

            state = Lexer.updateLine(state, `"`, 2, undefined);
            expected = [
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `alpha`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.Default, `bravo`],
                [Lexer.LexerLineKind.Touched, Lexer.LexerLineMode.String, `"`],
            ];
            expectAbridgedTLexerLine(state, expected);
        });
    })
});
