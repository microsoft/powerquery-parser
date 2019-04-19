import { Result, ResultKind } from "./common";
import { Lexer, LexerError, TComment } from "./lexer";
import { Ast, Parser, ParserError } from "./parser";

export interface LexAndParseSuccess {
    readonly ast: Ast.TDocument,
    readonly comments: ReadonlyArray<TComment>,
}

export function lexAndParse(blob: string, separator: string): Result<LexAndParseSuccess, LexerError.TLexerError | ParserError.TParserError> {
    let state = Lexer.fromSplit(blob, separator);

    if (Lexer.hasError(lexer)) {
        return {
            kind: ResultKind.Err,
            error: lexer.error,
        };
    }

    const parseResult = Parser.run(Lexer.snapshot(lexer));
    if (parseResult.kind === ResultKind.Err) {
        return parseResult;
    }

    return {
        kind: ResultKind.Ok,
        value: {
            ast: parseResult.value,
            comments: lexer.comments,
        }
    }
}
