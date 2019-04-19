// import { Lexer } from "../../lexer";

// export class Tokenizer implements TokensProvider {
//     public getInitialState(): IState {
//         // TODO: what should initial state be?
//         return new TokenizerState(Lexer.from(""));
//     }

//     public tokenize(line: string, state: IState): ILineTokens {
//         let lexerState: Lexer.TLexer;

//         const tokenizerState = state as TokenizerState;
//         if (!tokenizerState.lexer) {
//             throw new Error("invalid state");
//         }

//         lexerState = tokenizerState.lexer;

//         // TODO: do we care about the newline characters that would be removed from the line? 
//         let endState: Lexer.TLexer = Lexer.appendToDocument(lexerState, line);
//         endState = Lexer.remaining(endState);

//         const lineTokens = Tokenizer.calculateLineTokens(lexerState, endState);

//         return {
//             tokens: lineTokens,
//             endState: new TokenizerState(endState)
//         };
//     }

//     private static calculateLineTokens(initial: Lexer.TLexer, end: Lexer.TLexer): IToken[] {
//         let lineTokens: IToken[] = [];

//         // TODO: does this work? 
//         const offset: number = initial.documentIndex;

//         // only consider new tokens
//         const newTokens = end.tokens.slice(initial.tokens.length);
//         newTokens.forEach(t => {
//             lineTokens.push({
//                 startIndex: t.documentStartIndex - offset,
//                 scopes: t.kind
//             })
//         });

//         return lineTokens;
//     }
// }

// export class TokenizerState implements IState {
//     private readonly _lexer: Lexer.TLexer;

//     constructor(lexer: Lexer.TLexer) {
//         this._lexer = lexer;
//     }

//     public get lexer(): Lexer.TLexer {
//         return this._lexer;
//     }

//     public clone(): IState {
//         // TODO: is there a better way to clone?
//         let newLexer: Lexer.TLexer = Lexer.from(this.lexer.document);
//         newLexer = Lexer.remaining(newLexer);
//         return new TokenizerState(newLexer);
//     }

//     public equals(other: IState): boolean {
//         const otherState = other as TokenizerState;
//         if (!otherState || !otherState.lexer) {
//             return false;
//         }

//         const r = this.lexer;
//         const l = otherState.lexer;

//         // TODO: do we want to compare tokens as well?
//         return r.documentIndex === l.documentIndex &&
//             r.kind === l.kind;
//     }
// }

// // Taken from https://raw.githubusercontent.com/Microsoft/monaco-editor/master/monaco.d.ts
// export interface IState {
//     clone(): IState;
//     equals(other: IState): boolean;
// }

// export interface IToken {
//     startIndex: number;
//     scopes: string;
// }

// export interface ILineTokens {
//     /**
//      * The list of tokens on the line.
//      */
//     tokens: IToken[];
//     /**
//      * The tokenization end state.
//      * A pointer will be held to this and the object should not be modified by the tokenizer after the pointer is returned.
//      */
//     endState: IState;
// }

// export interface TokensProvider {
//     /**
//      * The initial state of a language. Will be the state passed in to tokenize the first line.
//      */
//     getInitialState(): IState;
//     /**
//      * Tokenize a line given the state at the beginning of the line.
//      */
//     tokenize(line: string, state: IState): ILineTokens;
// }