import { expect } from "chai";
import "mocha";
import { Tokenizer, TokenizerState, ILineTokens } from "./common";

const tokenizer = new Tokenizer();
const initialState: TokenizerState = tokenizer.getInitialState() as TokenizerState;

describe("Tokenizer", () => {
    it("Initial state", () => {
        expect(tokenizer.getInitialState(), "initial state should not be null");
        expect(initialState, "initial state variable should not be null");
    });

    it("Initial state equality", () => {
        expect(initialState.equals(initialState));
    });

    it("Single line token count", () => {
        const query = "1 = 1";
        const r: ILineTokens = tokenizer.tokenize(query, initialState);

        expect(r.tokens.length).equals(3);
        expect(!initialState.equals(r.endState), "state should have changed.");
    });

    it("Cloned state equality", () => {
        const r: ILineTokens = tokenizer.tokenize("let a = 1 in a", initialState);

        const clonedState = r.endState.clone();
        expect(r.endState.equals(clonedState), "states should be equal");
    });

    it("Multiline token count", () => {
        const query = "let\na = 1\nin a";
        const lines = query.split("\n");
        const tokenCounts = [1, 3, 2];

        let state = initialState;

        for (let i = 0; i < lines.length; i++) {
            const r: ILineTokens = tokenizer.tokenize(lines[i], state);
            expect(!state.equals(r.endState), "state should have changed.");
            expect(r.tokens.length).equals(tokenCounts[i], "unexpected token count");
        }
    });
});