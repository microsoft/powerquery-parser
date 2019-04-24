import { Option, Result, ResultKind } from "./common";
import { Lexer, LexerError, LexerSnapshot, TComment } from "./lexer";
import { Ast, Parser, ParserError } from "./parser";

export interface LexAndParseSuccess {
    readonly ast: Ast.TDocument,
    readonly comments: ReadonlyArray<TComment>,
}

export function lexAndParse(blob: string, separator: string): Result<LexAndParseSuccess, LexerError.TLexerError | ParserError.TParserError> {
    let state: Lexer.LexerState = Lexer.fromSplit(blob, separator);
    const maybeLineError: Option<Lexer.TLexerLine> = Lexer.maybeFirstErrorLine(state);
    if (maybeLineError) {
        const lineError: Lexer.TLexerLine = maybeLineError;
        return {
            kind: ResultKind.Err,
            error: lineError.error,
        }
    }

    let snapshotResult: Result<LexerSnapshot, LexerError.TLexerError> = LexerSnapshot.tryFrom(state);
    if (snapshotResult.kind === ResultKind.Err) {
        return snapshotResult;
    }
    const snapshot: LexerSnapshot = snapshotResult.value;

    const parseResult = Parser.run(snapshot);
    if (parseResult.kind === ResultKind.Err) {
        return parseResult;
    }

    return {
        kind: ResultKind.Ok,
        value: {
            ast: parseResult.value,
            comments: snapshot.comments,
        }
    }
}
