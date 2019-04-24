import { Lexer } from "../../lexer";

export class Tokenizer implements TokensProvider {
    constructor(private readonly lineTerminator: string) { }

    public getInitialState(): IState {
        const lexerState: Lexer.LexerState = {
            lines: [],
            lineTerminator: this.lineTerminator,
        };
        return new TokenizerState(lexerState);
    }

    public tokenize(line: string, state: IState): ILineTokens {
        let lexerState: Lexer.TLexer;

        const tokenizerState = state as TokenizerState;
        if (!tokenizerState.lexer) {
            throw new Error("invalid state");
        }

        lexerState = tokenizerState.lexer;

        let endState: Lexer.TLexer = Lexer.appendToDocument(lexerState, line + this._lineTerminator);
        endState = Lexer.remaining(endState);

        const lineTokens = Tokenizer.calculateLineTokens(lexerState, endState);

        return {
            tokens: lineTokens,
            endState: new TokenizerState(endState)
        };
    }

    private static calculateLineTokens(initial: Lexer.TLexer, end: Lexer.TLexer): IToken[] {
        let lineTokens: IToken[] = [];
        const offset: number = initial.documentIndex;

        // only consider new tokens
        const newTokens = end.tokens.slice(initial.tokens.length);
        newTokens.forEach(t => {
            lineTokens.push({
                startIndex: t.documentStartIndex - offset,
                scopes: t.kind
            })
        });

        // integrate comments
        const newComments = end.comments.slice(initial.comments.length);
        newComments.forEach(c => {
            lineTokens.push({
                startIndex: c.documentStartIndex - offset,
                scopes: c.kind
            })
        });

        // return the tokens ordered by their startIndex
        return lineTokens.sort((a, b) => a.startIndex > b.startIndex ? 1 : ((b.startIndex > a.startIndex ? -1 : 0)));
    }
}

export class TokenizerState implements IState {
    constructor(private readonly lexerState: Lexer.LexerState) { }

    public clone(): IState {
        return new TokenizerState(this.lexerState);
    }

    public equals(other: IState): boolean {
        return Lexer.equalStates(this.lexerState, (other as TokenizerState).lexerState);
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