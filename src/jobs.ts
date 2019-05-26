// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Option, Result, ResultKind } from "./common";
import { Lexer, LexerError, LexerSnapshot, TComment } from "./lexer";
import { Ast, Parser, ParserError } from "./parser";

export type LexAndParseErr = LexerError.TLexerError | ParserError.TParserError;

export interface LexAndParseOk {
    readonly ast: Ast.TDocument;
    readonly comments: ReadonlyArray<TComment>;
}

export function lexAndParse(text: string): Result<LexAndParseOk, LexAndParseErr> {
    const state: Lexer.State = Lexer.stateFrom(text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;
        return {
            kind: ResultKind.Err,
            error: new LexerError.LexerError(new LexerError.ErrorLineMapError(errorLineMap)),
        };
    }

    const snapshotResult: Result<LexerSnapshot, LexerError.TLexerError> = LexerSnapshot.tryFrom(state);
    if (snapshotResult.kind === ResultKind.Err) {
        return snapshotResult;
    }
    const snapshot: LexerSnapshot = snapshotResult.value;

    const parseResult: Parser.TriedParse = Parser.Parser.run(snapshot);
    if (parseResult.kind === ResultKind.Err) {
        return parseResult;
    }
    const parseOk: Parser.ParseOk = parseResult.value;

    return {
        kind: ResultKind.Ok,
        value: {
            ast: parseOk.document,
            comments: snapshot.comments,
        },
    };
}
