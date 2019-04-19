import { Lexer, LexerState, TComment } from "./lexer";
import { Ast } from "./parser";

export interface LexAndParseSuccess {
    readonly ast: Ast.TDocument,
    readonly comments: ReadonlyArray<TComment>,
}

export function lexAndParse(blob: string, separator: string): LexerState {
// export function lexAndParse(blob: string, separator: string): Result<LexAndParseSuccess, LexerError.TLexerError | ParserError.TParserError> {
    let state = Lexer.fromSplit(blob, separator);
    return state;

    // if (Lexer.isErrorState(state)) {
    //     return {
    //         kind: ResultKind.Err,
    //         error: state.error,
    //     };
    // }

    // const parseResult = Parser.run(Lexer.snapshot(lexer));
    // if (parseResult.kind === ResultKind.Err) {
    //     return parseResult;
    // }

    // return {
    //     kind: ResultKind.Ok,
    //     value: {
    //         ast: parseResult.value,
    //         comments: lexer.comments,
    //     }
    // }
}
