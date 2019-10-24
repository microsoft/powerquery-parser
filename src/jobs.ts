// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, Result, ResultKind } from "./common";
import { Lexer, LexerError, LexerSnapshot, TComment, TriedLexerSnapshot } from "./lexer";
import { Ast, IParser, IParserState, IParserStateUtils, NodeIdMap, ParseOk, ParserError, TriedParse } from "./parser";

export type TriedLexAndParse = Result<LexAndParseOk, LexAndParseErr>;

export type LexAndParseErr = LexerError.TLexerError | ParserError.TParserError;

export interface LexAndParseOk {
    readonly ast: Ast.TDocument;
    readonly comments: ReadonlyArray<TComment>;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export function tryLexAndParse(text: string, parser: IParser<IParserState>): TriedLexAndParse {
    const state: Lexer.State = Lexer.stateFrom(text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;
        return {
            kind: ResultKind.Err,
            error: new LexerError.LexerError(new LexerError.ErrorLineMapError(errorLineMap)),
        };
    }

    const snapshotResult: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    if (snapshotResult.kind === ResultKind.Err) {
        return snapshotResult;
    }
    const lexerSnapshot: LexerSnapshot = snapshotResult.value;

    const parserState: IParserState = IParserStateUtils.newState(lexerSnapshot);
    const parseResult: TriedParse = parser.readDocument(parserState, parser);
    if (parseResult.kind === ResultKind.Err) {
        return parseResult;
    }
    const parseOk: ParseOk = parseResult.value;

    return {
        kind: ResultKind.Ok,
        value: {
            ast: parseOk.document,
            comments: lexerSnapshot.comments,
            nodeIdMapCollection: parseOk.nodeIdMapCollection,
            leafNodeIds: parseOk.leafNodeIds,
        },
    };
}
