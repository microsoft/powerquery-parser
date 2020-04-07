// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from ".";
import { CommonError, Result, ResultUtils } from "./common";
import { ActiveNode, ActiveNodeUtils } from "./inspection/activeNode";
import { Lexer, LexError, LexerSnapshot, TriedLexerSnapshot } from "./lexer";
import { IParser, IParserState, NodeIdMap, ParseContext, ParseError, ParseOk, TriedParse, TXorNode } from "./parser";
import { CommonSettings, LexSettings, ParseSettings } from "./settings";

export type TriedInspection = Result<Inspection, CommonError.CommonError | LexError.LexError | ParseError.ParseError>;

export interface Inspection {
    readonly autocomplete: Inspection.Autocomplete;
    readonly invokeExpression: Inspection.InspectedInvokeExpression;
    readonly scope: Inspection.ScopeItemByKey;
    readonly scopeType: Inspection.ScopeTypeMap;
}

export type TriedLexParse<S = IParserState> = Result<LexParseOk<S>, LexError.TLexError | ParseError.TParseError<S>>;

// export type TriedLexParseInspection<S = IParserState> = Result<
//     LexParseInspectionOk<S>,
//     LexError.TLexError | ParseError.TParseError<S>
// >;

export interface LexParseOk<S = IParserState> extends ParseOk<S> {
    readonly lexerSnapshot: LexerSnapshot;
}

// export interface LexParseInspectionOk<S = IParserState> extends Inspected {
//     readonly triedParse: TriedParse<S>;
// }

export function tryLex(settings: LexSettings, text: string): TriedLexerSnapshot {
    const state: Lexer.State = Lexer.stateFrom(settings, text);
    const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;
        return ResultUtils.errFactory(
            new LexError.LexError(new LexError.ErrorLineMapError(settings.localizationTemplates, errorLineMap)),
        );
    }

    return LexerSnapshot.tryFrom(state);
}

export function tryParse<S = IParserState>(settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot): TriedParse<S> {
    const parser: IParser<S & IParserState> = settings.parser;
    const parserState: S & IParserState = settings.newParserState(settings, lexerSnapshot);
    return parser.readDocument(parserState, parser);
}

export function tryInspection<S = IParserState>(
    settings: CommonSettings,
    triedParse: TriedParse<S>,
    position: Inspection.Position,
): TriedInspection {
    let leafNodeIds: ReadonlyArray<number>;
    let nodeIdMapCollection: NodeIdMap.Collection;
    let maybeParseError: ParseError.ParseError<S> | undefined;

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

        const context: ParseContext.State = triedParse.error.state.contextState;
        leafNodeIds = context.leafNodeIds;
        nodeIdMapCollection = context.nodeIdMapCollection;
    } else {
        const parseOk: ParseOk<S> = triedParse.value;
        leafNodeIds = parseOk.leafNodeIds;
        nodeIdMapCollection = parseOk.nodeIdMapCollection;
    }

    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (maybeActiveNode === undefined) {
        throw new CommonError.InvariantError(`${tryInspection.name}: couldn't create ActiveNode`);
    }
    const activeNode: ActiveNode = maybeActiveNode;
    const ancestry: ReadonlyArray<TXorNode> = maybeActiveNode.ancestry;

    const triedScope: Inspection.TriedScopeForRoot = Inspection.tryScopeForRoot(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        ancestry,
        undefined,
    );
    if (ResultUtils.isErr(triedScope)) {
        return triedScope;
    }
    const scope: Inspection.ScopeItemByKey = triedScope.value;

    const triedScopeType: Inspection.TriedScopeType = Inspection.tryScopeType(settings, nodeIdMapCollection, scope);
    if (ResultUtils.isErr(triedScopeType)) {
        return triedScopeType;
    }

    const triedAutocomplete: Inspection.TriedAutocomplete = Inspection.tryAutocomplete(
        settings,
        activeNode,
        nodeIdMapCollection,
        maybeParseError,
    );
    if (ResultUtils.isErr(triedAutocomplete)) {
        return triedAutocomplete;
    }

    const triedInvokeExpression: Inspection.TriedInvokeExpression = Inspection.tryInvokeExpression(
        settings,
        nodeIdMapCollection,
        activeNode,
    );
    if (ResultUtils.isErr(triedInvokeExpression)) {
        return triedInvokeExpression;
    }

    return ResultUtils.okFactory({
        autocomplete: triedAutocomplete.value,
        invokeExpression: triedInvokeExpression.value,
        scope: triedScope.value,
        scopeType: triedScopeType.value,
    });
}

export function tryLexParse<S = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): TriedLexParse<S> {
    const triedLexerSnapshot: TriedLexerSnapshot = tryLex(settings, text);
    if (ResultUtils.isErr(triedLexerSnapshot)) {
        return triedLexerSnapshot;
    }
    const lexerSnapshot: LexerSnapshot = triedLexerSnapshot.value;

    const triedParse: TriedParse<S> = tryParse(settings, lexerSnapshot);
    if (ResultUtils.isOk(triedParse)) {
        return ResultUtils.okFactory({
            ...triedParse.value,
            lexerSnapshot,
        });
    } else {
        return triedParse;
    }
}

// export function tryLexParseInspection<S = IParserState>(
//     settings: Settings<S & IParserState>,
//     text: string,
//     position: Inspection.Position,
// ): TriedLexParseInspection<S> {
//     const triedLexParse: TriedLexParse<S> = tryLexParse(settings, text);
//     if (ResultUtils.isErr(triedLexParse) && triedLexParse.error instanceof LexError.LexError) {
//         return triedLexParse;
//     }

//     // The if statement above should remove LexError from the error type in Result<T, E>
//     const casted: Result<
//         LexParseOk<S>,
//         ParseError.TParseError<S> | Exclude<LexError.TLexError, LexError.LexError>
//     > = triedLexParse as Result<
//         LexParseOk<S>,
//         ParseError.TParseError<S> | Exclude<LexError.TLexError, LexError.LexError>
//     >;
//     const triedInspection: TriedInspection = tryInspection(settings, casted, position);

//     if (ResultUtils.isErr(triedInspection)) {
//         return triedInspection;
//     }

//     return ResultUtils.okFactory({
//         ...triedInspection.value,
//         triedParse: casted,
//     });
// }
