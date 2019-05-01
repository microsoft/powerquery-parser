import { expect } from "chai";
import "mocha";
import { Tokenizer, ILineTokens, IToken, IState } from "./common";

const tokenizer = new Tokenizer("\n");

const OriginalQuery = `shared Query1 =
let
   source = Csv.Document(binaryContent),
   count = Table.RowCount(source),
   string = "text",
   numbers = 123 + 456
in
   count + 3;`;

// TODO: Only supports single line edits - should support insertion of new lines.
class MockDocument {
    public readonly tokenizer: Tokenizer = new Tokenizer("\n");
    public lines: string[];
    public lineEndStates: IState[];
    public lineTokens: IToken[][];

    constructor(initialText: string) {
        this.lines = initialText.split("\n");
        this.lineEndStates = new Array(this.lines.length);
        this.lineTokens = new Array(this.lines.length);

        this.startTokenize(0);
    }

    public applyChangeAndTokenize(newText: string, index: number): number {
        this.lines[index] = newText;
        return this.startTokenize(index);
    }

    // returns number of lines that were tokenized.
    // will always tokenize at least 1 line.
    private startTokenize(startingIndex: number = 0): number {
        expect(startingIndex).is.lessThan(this.lines.length);

        let tokenizedLineCount: number = 0;

        // Get the state for the previous line
        let state: IState;
        if (startingIndex == 0 || this.lineEndStates[startingIndex - 1] == null) {
            state = this.tokenizer.getInitialState();
        } else {
            state = this.lineEndStates[startingIndex - 1];
        }

        for (let i = startingIndex; i < this.lines.length; i++) {
            const result: ILineTokens = tokenizer.tokenize(this.lines[i], state);
            this.lineTokens[i] = result.tokens;
            tokenizedLineCount++;

            // If the new end state matches the previous state, we can stop tokenizing
            if (result.endState.equals(this.lineEndStates[i])) {
                break;
            }

            // Update line end state and pass on new state value
            state = result.endState.clone();
            this.lineEndStates[i] = state;
        }

        return tokenizedLineCount;
    }
}


describe("Incremental updates", () => {
    it("Reparse with no change", () => {
        const document = new MockDocument(OriginalQuery);
        const originalLine = document.lines[2];
        const count = document.applyChangeAndTokenize(originalLine, 2);
        expect(count).equals(1, "we should not have tokenized more than one line");
    });

    it("Reparse with simple change", () => {
        const document = new MockDocument(OriginalQuery);
        const modified = document.lines[2].replace("source", "source123");
        const count = document.applyChangeAndTokenize(modified, 2);
        expect(count).equals(1, "we should not have tokenized more than one line");
    });

    // TODO: tokenizer needs to support multiline strings
    xit("Reparse with unterminated string", () => {
        const document = new MockDocument(OriginalQuery);
        const modified = document.lines[4].replace(`"text",`, `"text`);
        const count = document.applyChangeAndTokenize(modified, 4);
        expect(count).equals(document.lines.length - 4, "remaining lines should have been tokenized");

        // TODO: check that tokens were all changed to string
    });

    // TODO: tokenizer needs to support multiline comments
    xit("Reparse with unterminated block comment", () => {
        const document = new MockDocument(OriginalQuery);
        const modified = document.lines[3].replace(`rce),`, `rce), /* my open comment`);
        const count = document.applyChangeAndTokenize(modified, 3);
        expect(count).equals(document.lines.length - 3, "remaining lines should have been tokenized");

        // TODO: check that tokens were all changed to comment
    });

    // TODO: add tests that insert newlines into the original query
});