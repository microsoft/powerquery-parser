import { Lexer, LineToken } from "../../lexer";

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
        const tokenizerState: TokenizerState = state as TokenizerState;
        const lexerState = tokenizerState.lexerState;
        const newLexerState = Lexer.appendLine(lexerState, line);

        return {
            tokens: newLexerState.lines[newLexerState.lines.length - 1].tokens.map(Tokenizer.ITokenFrom),
            endState: new TokenizerState(newLexerState)
        };
    }

    static ITokenFrom(lineToken: LineToken): IToken {
        // unsafe action:
        //      cast LineTokenKind into string
        // what I'm trying to avoid:
        //      the cost of properly casting, aka one switch statement per LineTokenKind
        // why it's safe:
        //      all variants for LineTokenKind are strings
        return {
            startIndex: lineToken.positionStart.textIndex,
            scopes: lineToken.kind as unknown as string,
        }
    }
}

export class TokenizerState implements IState {
    constructor(public readonly lexerState: Lexer.LexerState) { }

    public clone(): IState {
        return new TokenizerState(this.lexerState);
    }

    public equals(other: IState): boolean {
        return other !== undefined
            ? Lexer.equalStates(this.lexerState, (other as TokenizerState).lexerState)
            : false;
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