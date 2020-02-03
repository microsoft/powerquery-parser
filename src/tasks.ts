// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from ".";
import { CommonError, Option, Result, ResultUtils } from "./common";
import { Inspected, TriedInspection } from "./inspection";
import { Lexer, LexError, LexerSnapshot, TriedLexerSnapshot } from "./lexer";
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
import { Settings } from "./settings";

export type TriedLexParse = Result<LexParseOk, LexError.TLexError | ParseError.TParseError>;

export type TriedLexParseInspection = Result<LexParseInspectionOk, LexError.TLexError | ParseError.TParseError>;

export interface LexParseOk extends ParseOk {
    readonly lexerSnapshot: LexerSnapshot;
}

export interface LexParseInspectionOk extends Inspected {
    readonly triedParse: TriedParse;
}

export function tryLex(settings: Settings, text: string): TriedLexerSnapshot {
    const state: Lexer.State = Lexer.stateFrom(settings, text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;
        return ResultUtils.errFactory(
            new LexError.LexError(new LexError.ErrorLineMapError(settings.localizationTemplates, errorLineMap)),
        );
    }

    return LexerSnapshot.tryFrom(state);
}

export function tryParse(settings: Settings, lexerSnapshot: LexerSnapshot, parser: IParser<IParserState>): TriedParse {
    const parserState: IParserState = IParserStateUtils.newState(settings, lexerSnapshot);
    return parser.readDocument(parserState, parser);
}

export function tryInspection(triedParse: TriedParse, position: Inspection.Position): TriedInspection {
    let leafNodeIds: ReadonlyArray<number>;
    let nodeIdMapCollection: NodeIdMap.Collection;
    let maybeParseError: Option<ParseError.ParseError>;

    if (ResultUtils.isErr(triedParse)) {
        if (triedParse.error instanceof CommonError.CommonError) {
            // Returning triedParse /should/ be safe, but Typescript has a problem with it.
            // However, if I repackage the same error it satisfies the type check.
            // There's no harm in having to repackage the error, and by not casting it we can prevent
            // future regressions if TriedParse changes.
            return ResultUtils.errFactory(triedParse.error);
        } else {
            maybeParseError = triedParse.error;
        }

        const context: ParserContext.State = triedParse.error.context;
        leafNodeIds = context.leafNodeIds;
        nodeIdMapCollection = context.nodeIdMapCollection;
    } else {
        const parseOk: ParseOk = triedParse.value;
        leafNodeIds = parseOk.leafNodeIds;
        nodeIdMapCollection = parseOk.nodeIdMapCollection;
    }

    return Inspection.tryFrom(position, nodeIdMapCollection, leafNodeIds, maybeParseError);
}

export function tryLexParse(settings: Settings, text: string, parser: IParser<IParserState>): TriedLexParse {
    const triedLexerSnapshot: TriedLexerSnapshot = tryLex(settings, text);
    if (ResultUtils.isErr(triedLexerSnapshot)) {
        return triedLexerSnapshot;
    }
    const lexerSnapshot: LexerSnapshot = triedLexerSnapshot.value;

    const triedParse: TriedParse = tryParse(settings, lexerSnapshot, parser);
    if (ResultUtils.isOk(triedParse)) {
        return ResultUtils.okFactory({
            ...triedParse.value,
            lexerSnapshot,
        });
    } else {
        return triedParse;
    }
}

export function tryLexParseInspection(
    settings: Settings,
    text: string,
    parser: IParser<IParserState>,
    position: Inspection.Position,
): TriedLexParseInspection {
    const triedLexParse: TriedLexParse = tryLexParse(settings, text, parser);
    if (ResultUtils.isErr(triedLexParse) && triedLexParse.error instanceof LexError.LexError) {
        return triedLexParse;
    }

    // The if statement above should remove LexError from the error type in Result<T, E>
    const casted: Result<
        LexParseOk,
        ParseError.TParseError | Exclude<LexError.TLexError, LexError.LexError>
    > = triedLexParse as Result<LexParseOk, ParseError.TParseError | Exclude<LexError.TLexError, LexError.LexError>>;
    const triedInspection: TriedInspection = tryInspection(casted, position);

    if (ResultUtils.isErr(triedInspection)) {
        return triedInspection;
    }

    return ResultUtils.okFactory({
        ...triedInspection.value,
        triedParse: casted,
    });
}
