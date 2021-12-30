// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { ILineTokens, IState, IToken, Tokenizer, TokenizerState } from "./common";

const tokenizer: Tokenizer = new Tokenizer(`\n`);
const initialState: TokenizerState = tokenizer.getInitialState() as TokenizerState;

function tokenizeLines(query: string, expectedTokenCounts: number[]): void {
    const lines: ReadonlyArray<string> = query.split(`\n`);
    let state: TokenizerState = initialState;

    expect(lines.length).equals(expectedTokenCounts.length);

    for (let index: number = 0; index < lines.length; index += 1) {
        const r: ILineTokens = tokenizer.tokenize(lines[index], state);
        expect(!state.equals(r.endState), `state should have changed.`);
        expect(r.tokens.length).equals(expectedTokenCounts[index], `unexpected token count`);

        state = r.endState as TokenizerState;

        r.tokens.forEach((token: IToken) => {
            expect(token.startIndex).is.lessThan(lines[index].length);
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

        const clonedState: IState = r.endState.clone();
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
