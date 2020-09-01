// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Language } from "../../..";
import { Assert } from "../../../common";
import { Lexer } from "../../../lexer";
import { DefaultTemplates } from "../../../localization";

export class Tokenizer implements TokensProvider {
    constructor(private readonly lineTerminator: string) {}

    // tslint:disable-next-line: function-name
    public static ITokenFrom(lineToken: Language.LineToken): IToken {
        // UNSAFE MARKER
        //
        // Purpose of code block:
        //      Translate LineTokenKind to LineToken.
        //
        // Why are you trying to avoid a safer approach?
        //      A proper mapping would require a switch statement, one case per kind in LineNodeKind.
        //
        // Why is it safe?
        //      All variants of LineNodeKind are strings.
        return {
            startIndex: lineToken.positionStart,
            scopes: (lineToken.kind as unknown) as string,
        };
    }

    public getInitialState(): IState {
        const lexerState: Lexer.State = {
            lines: [],
            localizationTemplates: DefaultTemplates,
            maybeCancellationToken: undefined,
        };
        return new TokenizerState(lexerState);
    }

    public tokenize(line: string, state: IState): ILineTokens {
        const tokenizerState: TokenizerState = state as TokenizerState;
        const lexerState: Lexer.State = tokenizerState.lexerState;

        const triedLex: Lexer.TriedLex = Lexer.tryAppendLine(lexerState, line, this.lineTerminator);
        Assert.isOk(triedLex);
        const newLexerState: Lexer.State = triedLex.value;

        return {
            tokens: newLexerState.lines[newLexerState.lines.length - 1].tokens.map(Tokenizer.ITokenFrom),
            endState: new TokenizerState(newLexerState),
        };
    }
}

export class TokenizerState implements IState {
    constructor(public readonly lexerState: Lexer.State) {}

    public clone(): IState {
        return new TokenizerState(this.lexerState);
    }

    // For tokenizer state comparison, all we really care about is the line mode end value.
    // i.e. we need to know if we're ending on an unterminated comment/string as it
    // would impact tokenization for the following line.
    public equals(other: IState): boolean {
        if (!other) {
            return false;
        }

        // Check for initial state.
        const rightLexerState: Lexer.State = (other as TokenizerState).lexerState;
        if (this.lexerState.lines.length === 0) {
            return rightLexerState.lines.length === 0;
        }

        // Compare last line state.
        const leftLastLine: Lexer.TLine = this.lexerState.lines[this.lexerState.lines.length - 1];
        const rightLastLine: Lexer.TLine = rightLexerState.lines[rightLexerState.lines.length - 1];
        return leftLastLine.lineModeEnd === rightLastLine.lineModeEnd;
    }
}

// Taken from https://raw.githubusercontent.com/Microsoft/monaco-editor/master/monaco.d.ts
export interface IState {
    clone(): IState;
    equals(other: IState): boolean;
}

export interface IToken {
    startIndex: number;
    scopes: string;
}

export interface ILineTokens {
    /**
     * The list of tokens on the line.
     */
    tokens: IToken[];
    /**
     * The tokenization end state.
     * A pointer will be held to this and the object should not be modified by the tokenizer after the pointer is returned.
     */
    endState: IState;
}

export interface TokensProvider {
    /**
     * The initial state of a language. Will be the state passed in to tokenize the first line.
     */
    getInitialState(): IState;
    /**
     * Tokenize a line given the state at the beginning of the line.
     */
    tokenize(line: string, state: IState): ILineTokens;
}
