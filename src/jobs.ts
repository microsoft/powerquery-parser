// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Option, Result, ResultKind } from "./common";
import { Lexer, LexerError, LexerSnapshot, TComment } from "./lexer";
import { Ast, ParseOk, Parser, ParserError } from "./parser";

export type LexAndParseErr = (
    | LexerError.TLexerError
    | ParserError.TParserError
);

export interface LexAndParseOk {
    readonly ast: Ast.TDocument,
    readonly comments: ReadonlyArray<TComment>,
}

export function lexAndParse(text: string): Result<LexAndParseOk, LexAndParseErr> {
    let state: Lexer.State = Lexer.stateFrom(text);

    const maybeErrorLines: Option<Lexer.TErrorLines> = Lexer.maybeErrorLines(state);
    if (maybeErrorLines) {
        const errorLines: Lexer.TErrorLines = maybeErrorLines;
        return {
            kind: ResultKind.Err,
            error: new LexerError.LexerError(new LexerError.ErrorLineError(errorLines)),
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
    const parseOk: ParseOk = parseResult.value;

    return {
        kind: ResultKind.Ok,
        value: {
            ast: parseOk.document,
            comments: snapshot.comments,
        }
    }
}
