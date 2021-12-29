// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, DefaultSettings, Lexer } from "../../..";
import { ILineTokens, IState, IToken, Tokenizer } from "./common";

const tokenizer: Tokenizer = new Tokenizer("\n");

const ORIGINAL_QUERY: string = `shared Query1 =
let
   source = Csv.Document(binaryContent),
   count = Table.RowCount(source),
   string = "text",
   numbers = 123 + 456
in
   count + 3;`;

class MockDocument2 {
    private lexerState: Lexer.State;

    constructor(initialText: string) {
        const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, initialText);
        Assert.isOk(triedLex);
        this.lexerState = triedLex.value;
    }

    public applyChange(text: string, range: Lexer.Range): void {
        const triedLexerUpdate: Lexer.TriedLex = Lexer.tryUpdateRange(this.lexerState, range, text);
        Assert.isOk(triedLexerUpdate);
        this.lexerState = triedLexerUpdate.value;
    }

    public getText(): string {
        const triedLexerSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(this.lexerState);
        Assert.isOk(triedLexerSnapshot);

        return triedLexerSnapshot.value.text;
    }
}

// TODO: Replace with MockDocument2 to use built-in incremental updates
class MockDocument {
    public readonly tokenizer: Tokenizer = new Tokenizer("\n");

    constructor(
        initialText: string,
        public lines: string[] = initialText.split("\n"),
        public lineEndStates: IState[] = [],
        public lineTokens: IToken[][] = [],
    ) {
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
        if (startingIndex === 0 || this.lineEndStates[startingIndex - 1] === undefined) {
            state = this.tokenizer.getInitialState();
        } else {
            state = this.lineEndStates[startingIndex - 1];
        }

        for (let index: number = startingIndex; index < this.lines.length; index += 1) {
            const result: ILineTokens = tokenizer.tokenize(this.lines[index], state);
            this.lineTokens[index] = result.tokens;
            tokenizedLineCount += 1;

            // If the new end state matches the previous state, we can stop tokenizing
            if (result.endState.equals(this.lineEndStates[index])) {
                break;
            }

            // Update line end state and pass on new state value
            state = result.endState.clone();
            this.lineEndStates[index] = state;
        }

        return tokenizedLineCount;
    }
}

describe("MockDocument validation", () => {
    it("No change", () => {
        const document: MockDocument2 = new MockDocument2(ORIGINAL_QUERY);
        expect(document.getText()).equals(ORIGINAL_QUERY, "unexpected changed text");
    });

    it("Insert at beginning", () => {
        const document: MockDocument2 = new MockDocument2(ORIGINAL_QUERY);
        const changeToMake: string = "    ";
        document.applyChange(changeToMake, {
            start: { lineNumber: 0, lineCodeUnit: 0 },
            end: { lineNumber: 0, lineCodeUnit: 0 },
        });

        const changedDocumentText: string = document.getText();
        expect(changedDocumentText).equals(changeToMake + ORIGINAL_QUERY, "unexpected changed text");
    });

    it("Change first line", () => {
        const document: MockDocument2 = new MockDocument2(ORIGINAL_QUERY);

        document.applyChange("Query2", {
            start: { lineNumber: 0, lineCodeUnit: 7 },
            end: { lineNumber: 0, lineCodeUnit: 13 },
        });

        const originalWithChange: string = ORIGINAL_QUERY.replace("Query1", "Query2");
        const changedDocumentText: string = document.getText();
        expect(changedDocumentText).equals(originalWithChange, "unexpected changed text");
    });

    it("Change middle of document", () => {
        const document: MockDocument2 = new MockDocument2(ORIGINAL_QUERY);

        document.applyChange("numbers123", {
            start: { lineNumber: 5, lineCodeUnit: 3 },
            end: { lineNumber: 5, lineCodeUnit: 10 },
        });

        const originalWithChange: string = ORIGINAL_QUERY.replace("numbers", "numbers123");
        const changedDocumentText: string = document.getText();
        expect(changedDocumentText).equals(originalWithChange, "unexpected changed text");
    });

    it("Delete most of the document", () => {
        const document: MockDocument2 = new MockDocument2(ORIGINAL_QUERY);

        document.applyChange("", {
            start: { lineNumber: 1, lineCodeUnit: 0 },
            end: { lineNumber: 7, lineCodeUnit: 10 },
        });

        const originalWithChange: string = "shared Query1 =\n 3;";
        const changedDocumentText: string = document.getText();
        expect(changedDocumentText).equals(originalWithChange, "unexpected changed text");
    });
});

describe("Incremental updates", () => {
    it("Re-parse with no change", () => {
        const document: MockDocument = new MockDocument(ORIGINAL_QUERY);
        const originalLine: string = document.lines[2];
        const count: number = document.applyChangeAndTokenize(originalLine, 2);
        expect(count).equals(1, "we should not have tokenized more than one line");
    });

    it("Re-parse with simple change", () => {
        const document: MockDocument = new MockDocument(ORIGINAL_QUERY);
        const modified: string = document.lines[2].replace("source", "source123");
        const count: number = document.applyChangeAndTokenize(modified, 2);
        expect(count).equals(1, "we should not have tokenized more than one line");
    });

    it("Re-parse with unterminated string", () => {
        const lineNumber: number = 4;
        const document: MockDocument = new MockDocument(ORIGINAL_QUERY);
        const modified: string = document.lines[lineNumber].replace(`"text",`, `"text`);
        const count: number = document.applyChangeAndTokenize(modified, lineNumber);
        expect(count).equals(document.lines.length - lineNumber, "remaining lines should have been tokenized");

        for (let index: number = lineNumber + 1; index < document.lineTokens.length; index += 1) {
            const lineTokens: ReadonlyArray<IToken> = document.lineTokens[index];
            lineTokens.forEach((token: IToken) => {
                expect(token.scopes).equals("TextContent", "expecting remaining tokens to be strings");
            });
        }
    });

    it("Re-parse with unterminated block comment", () => {
        const lineNumber: number = 3;
        const document: MockDocument = new MockDocument(ORIGINAL_QUERY);
        const modified: string = document.lines[lineNumber].replace(`rce),`, `rce), /* my open comment`);
        const count: number = document.applyChangeAndTokenize(modified, lineNumber);
        expect(count).equals(document.lines.length - lineNumber, "remaining lines should have been tokenized");

        for (let index: number = lineNumber + 1; index < document.lineTokens.length; index += 1) {
            const lineTokens: ReadonlyArray<IToken> = document.lineTokens[index];
            lineTokens.forEach((token: IToken) => {
                expect(token.scopes).equals("MultilineCommentContent", "expecting remaining tokens to be comments");
            });
        }
    });

    // TODO: add tests that insert newlines into the original query
});
