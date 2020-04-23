// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from ".";
import { CommonError, isNever, Result, ResultUtils } from "./common";
import { StartOfDoctumentKeywords } from "./inspection";
import { ActiveNode, ActiveNodeUtils } from "./inspection/activeNode";
import { Ast } from "./language";
import { Lexer, LexError, LexerSnapshot, TriedLexerSnapshot } from "./lexer";
import { IParser, IParserState, NodeIdMap, ParseContext, ParseError, ParseOk, TriedParse, TXorNode } from "./parser";
import { CommonSettings, LexSettings, ParseSettings } from "./settings";

export type TriedInspection = Result<InspectionOk, CommonError.CommonError | LexError.LexError | ParseError.ParseError>;

export interface InspectionOk {
    readonly maybeActiveNode: undefined | ActiveNode;
    readonly autocomplete: Inspection.Autocomplete;
    readonly maybeInvokeExpression: undefined | Inspection.InvokeExpression;
    readonly scope: Inspection.ScopeItemByKey;
    readonly scopeType: Inspection.ScopeTypeByKey;
}

export type TriedLexParse<S extends IParserState = IParserState> = Result<
    LexParseOk<S>,
    LexError.TLexError | ParseError.TParseError<S>
>;

export type TriedLexParseInspect<S extends IParserState = IParserState> = Result<
    LexParseInspectOk<S>,
    CommonError.CommonError | LexError.LexError | ParseError.ParseError
>;

export interface LexParseOk<S extends IParserState = IParserState> extends ParseOk<S> {
    readonly lexerSnapshot: LexerSnapshot;
}

export interface LexParseInspectOk<S extends IParserState = IParserState> extends InspectionOk {
    readonly triedParse: TriedParse<S>;
}

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

export function tryParse<S extends IParserState = IParserState>(
    settings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
): TriedParse<S> {
    const parser: IParser<S> = settings.parser;
    const parserState: S = settings.newParserState(settings, lexerSnapshot);
    return parser.readDocument(parserState, parser);
}

export function tryInspection<S extends IParserState = IParserState>(
    settings: CommonSettings,
    triedParse: TriedParse<S>,
    position: Inspection.Position,
): TriedInspection {
    let nodeIdMapCollection: NodeIdMap.Collection;
    let leafNodeIds: ReadonlyArray<number>;
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
        nodeIdMapCollection = context.nodeIdMapCollection;
        leafNodeIds = context.leafNodeIds;
    } else {
        const parseOk: ParseOk<S> = triedParse.value;
        nodeIdMapCollection = parseOk.nodeIdMapCollection;
        leafNodeIds = parseOk.leafNodeIds;
    }

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (maybeActiveNode === undefined) {
        return ResultUtils.okFactory({
            maybeActiveNode,
            autocomplete: StartOfDoctumentKeywords,
            maybeInvokeExpression: undefined,
            scope: new Map(),
            scopeType: new Map(),
        });
    }
    const activeNode: ActiveNode = maybeActiveNode;
    const ancestry: ReadonlyArray<TXorNode> = maybeActiveNode.ancestry;

    const triedScope: Inspection.TriedScope = Inspection.tryScope(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        ancestry,
        undefined,
    );
    if (ResultUtils.isErr(triedScope)) {
        return triedScope;
    }
    const scopeById: Inspection.ScopeById = triedScope.value;
    const maybeScope: Inspection.ScopeItemByKey | undefined = scopeById.get(ancestry[0].node.id);
    if (maybeScope === undefined) {
        const details: {} = { nodeId: ancestry[0].node.id };
        throw new CommonError.InvariantError(`expected nodeId in scopeById`, details);
    }
    const scope: Inspection.ScopeItemByKey = maybeScope;

    const triedScopeType: Inspection.TriedScopeType = Inspection.tryScopeTypeForRoot(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        scopeById,
        ancestry,
        undefined,
    );
    if (ResultUtils.isErr(triedScopeType)) {
        return triedScopeType;
    }

    const triedAutocomplete: Inspection.TriedAutocomplete = Inspection.tryAutocomplete(
        settings,
        nodeIdMapCollection,
        activeNode,
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
        maybeActiveNode,
        autocomplete: triedAutocomplete.value,
        maybeInvokeExpression: triedInvokeExpression.value,
        scope,
        scopeType: triedScopeType.value,
    });
}

export function tryLexParse<S extends IParserState = IParserState>(
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

export function tryLexParseInspection<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Inspection.Position,
): TriedLexParseInspect<S> {
    const triedLexParse: TriedLexParse<S> = tryLexParse(settings, text);
    const maybeTriedParse: undefined | TriedParse<S> = maybeTriedParseFromTriedLexParse(triedLexParse);
    // maybeTriedParse is undefined iff maybeLexParse is Err<CommonError | LexError>
    // Err<CommonError | LexError> is a subset of TriedLexParse
    if (maybeTriedParse == undefined) {
        return triedLexParse as TriedLexParseInspect<S>;
    }
    const triedParse: TriedParse<S> = maybeTriedParse;
    const triedInspection: TriedInspection = tryInspection(settings, triedParse, position);

    if (ResultUtils.isErr(triedInspection)) {
        return triedInspection;
    }

    return ResultUtils.okFactory({
        ...triedInspection.value,
        triedParse,
    });
}

export function maybeTriedParseFromTriedLexParse<S extends IParserState>(
    triedLexParse: TriedLexParse<S>,
): undefined | TriedParse<S> {
    let ast: Ast.TDocument;
    let leafNodeIds: ReadonlyArray<number>;
    let nodeIdMapCollection: NodeIdMap.Collection;
    let state: S;

    if (ResultUtils.isErr(triedLexParse)) {
        if (
            triedLexParse.error instanceof CommonError.CommonError ||
            triedLexParse.error instanceof LexError.LexError
        ) {
            return undefined;
        } else if (triedLexParse.error instanceof ParseError.ParseError) {
            return triedLexParse as TriedParse<S>;
        } else {
            throw isNever(triedLexParse.error);
        }
    } else {
        const lexParseOk: LexParseOk<S> = triedLexParse.value;
        ast = lexParseOk.ast;
        nodeIdMapCollection = lexParseOk.nodeIdMapCollection;
        leafNodeIds = lexParseOk.leafNodeIds;
        state = lexParseOk.state;
    }

    return ResultUtils.okFactory({
        ast,
        leafNodeIds,
        nodeIdMapCollection,
        state,
    });
}
