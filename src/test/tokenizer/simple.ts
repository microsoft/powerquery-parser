import { expect } from "chai";
import "mocha";
import { ILineTokens, Tokenizer, TokenizerState } from "./common";

const tokenizer = new Tokenizer(`\n`);
const initialState: TokenizerState = tokenizer.getInitialState() as TokenizerState;

function tokenizeLines(query: string, expectedTokenCounts: number[]) {
    const lines = query.split(`\n`);
    let state = initialState;

    expect(lines.length).equals(expectedTokenCounts.length);

    for (let i = 0; i < lines.length; i++) {
        const r: ILineTokens = tokenizer.tokenize(lines[i], state);
        expect(!state.equals(r.endState), `state should have changed.`);
        expect(r.tokens.length).equals(expectedTokenCounts[i], `unexpected token count`);

        state = r.endState as TokenizerState;

        r.tokens.forEach(token => {
            expect(token.startIndex).is.lessThan(lines[i].length);
        });
    }
}

describe(`Tokenizer`, () => {
    it(`Initial state`, () => {
        expect(tokenizer.getInitialState(), `initial state should not be null`);
        expect(initialState, `initial state variable should not be null`);
    });

    it(`Initial state equality`, () => {
        expect(initialState.equals(initialState));
    });

    it(`Cloned state equality`, () => {
        const r: ILineTokens = tokenizer.tokenize(`let a = 1 in a`, initialState);

        const clonedState = r.endState.clone();
        expect(r.endState.equals(clonedState), `states should be equal`);
    });

    it(`Single line token count`, () => {
        tokenizeLines(`1 = 1`, [3]);
    });

    it(`Simple multiline query`, () => {
        tokenizeLines(`let\na = 1\nin a`, [1, 3, 2]);
    });

    it(`Query with comments`, () => {
        tokenizeLines(`/* block */ let\na = 1 // line comment\nin a`, [2, 4, 2]);
    });

    it(`Multiline comment block`, () => {
        tokenizeLines(`1 + /* comment\nend*/ 2`, [3, 2]);
    });

    it(`Multiline string`, () => {
        tokenizeLines(`"hello\nthere\n\n" & "append"`, [1, 1, 0, 3]);
    });

    it(`Multiline quoted identifier`, () => {
        tokenizeLines(`#"hello\nthere\n\n" & #"append"`, [1, 1, 0, 3]);
    });
});