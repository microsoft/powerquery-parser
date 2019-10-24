// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from ".";
import { CommonError, Option, Result, ResultKind } from "./common";
import { TriedInspection } from "./inspection";
import { Lexer, LexerError, LexerSnapshot, TriedLexerSnapshot } from "./lexer";
import {
    IParser,
    IParserState,
    IParserStateUtils,
    NodeIdMap,
    ParseError,
    ParseOk,
    ParserContext,
    TriedParse,
} from "./parser";

export type TriedLexParse = Result<LexAndParseOk, LexerError.TLexerError | ParseError.TParseError>;

export interface LexAndParseOk extends ParseOk {
    readonly lexerSnapshot: LexerSnapshot;
}

export function tryLex(text: string): TriedLexerSnapshot {
    const state: Lexer.State = Lexer.stateFrom(text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;
        return {
            kind: ResultKind.Err,
            error: new LexerError.LexerError(new LexerError.ErrorLineMapError(errorLineMap)),
        };
    }

    return LexerSnapshot.tryFrom(state);
}

export function tryParse(lexerSnapshot: LexerSnapshot, parser: IParser<IParserState>): TriedParse {
    const parserState: IParserState = IParserStateUtils.newState(lexerSnapshot);
    return parser.readDocument(parserState, parser);
}

export function tryInspection(triedParse: TriedParse, position: Inspection.Position): TriedInspection {
    let leafNodeIds: ReadonlyArray<number>;
    let nodeIdMapCollection: NodeIdMap.Collection;

    if (triedParse.kind === ResultKind.Err) {
        if (triedParse.error instanceof CommonError.CommonError) {
            // Returning triedParse /should/ be safe, but Typescript has a problem with it.
            // However, if I repackage the same error it satisfies the type check.
            // There's no harm in having to repackage the error, and by not casting it we can prevent
            // future regressions if TriedParse changes.
            return {
                kind: ResultKind.Err,
                error: triedParse.error,
            };
        }

        const context: ParserContext.State = triedParse.error.context;
        leafNodeIds = context.leafNodeIds;
        nodeIdMapCollection = context.nodeIdMapCollection;
    } else {
        const parseOk: ParseOk = triedParse.value;
        leafNodeIds = parseOk.leafNodeIds;
        nodeIdMapCollection = parseOk.nodeIdMapCollection;
    }

    return Inspection.tryFrom(position, nodeIdMapCollection, leafNodeIds);
}

export function tryLexParse(text: string, parser: IParser<IParserState>): TriedLexParse {
    const triedLexerSnapshot: TriedLexerSnapshot = tryLex(text);
    if (triedLexerSnapshot.kind === ResultKind.Err) {
        return triedLexerSnapshot;
    }
    const lexerSnapshot: LexerSnapshot = triedLexerSnapshot.value;

    const triedParse: TriedParse = tryParse(lexerSnapshot, parser);
    if (triedParse.kind === ResultKind.Ok) {
        return {
            kind: ResultKind.Ok,
            value: {
                ...triedParse.value,
                lexerSnapshot,
            },
        };
    } else {
        return triedParse;
    }
}
