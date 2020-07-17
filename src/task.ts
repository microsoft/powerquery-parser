// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from ".";
import { Assert, CommonError, Result, ResultUtils } from "./common";
import { StartOfDocumentKeywords } from "./inspection";
import { ActiveNode, ActiveNodeUtils } from "./inspection/activeNode";
import { Ast } from "./language";
import { Lexer, LexError, LexerSnapshot, TriedLexerSnapshot } from "./lexer";
import { getLocalizationTemplates } from "./localization";
import {
    IParser,
    IParserState,
    IParserUtils,
    NodeIdMap,
    NodeIdMapUtils,
    ParseContext,
    ParseError,
    ParseOk,
    TriedParse,
    TXorNode,
} from "./parser";
import { CommonSettings, LexSettings, ParseSettings } from "./settings";
import { Type } from "./type";

export type TriedInspection = Result<InspectionOk, CommonError.CommonError | LexError.LexError | ParseError.ParseError>;

export interface InspectionOk {
    readonly maybeActiveNode: ActiveNode | undefined;
    readonly autocomplete: Inspection.Autocomplete;
    readonly maybeInvokeExpression: Inspection.InvokeExpression | undefined;
    readonly scope: Inspection.ScopeItemByKey;
    readonly scopeType: Inspection.ScopeTypeByKey;
    readonly maybeExpectedType: Type.TType | undefined;
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
            new LexError.LexError(
                new LexError.ErrorLineMapError(getLocalizationTemplates(settings.locale), errorLineMap),
            ),
        );
    }

    return LexerSnapshot.tryFrom(state);
}

export function tryParse<S extends IParserState = IParserState>(
    settings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
): TriedParse<S> {
    const parser: IParser<S> = settings.parser;
    const state: S = settings.newParserState(settings, lexerSnapshot);
    return IParserUtils.tryRead(state, parser);
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
        nodeIdMapCollection = parseOk.state.contextState.nodeIdMapCollection;
        leafNodeIds = parseOk.state.contextState.leafNodeIds;
    }

    // We should only get an undefined for activeNode iff the document is empty
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (maybeActiveNode === undefined) {
        return ResultUtils.okFactory({
            maybeActiveNode,
            autocomplete: StartOfDocumentKeywords,
            maybeInvokeExpression: undefined,
            scope: new Map(),
            scopeType: new Map(),
            maybeExpectedType: undefined,
        });
    }
    const activeNode: ActiveNode = maybeActiveNode;
    const ancestry: ReadonlyArray<TXorNode> = maybeActiveNode.ancestry;

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
    Assert.isDefined(maybeScope, `expected nodeId in scopeById`, { nodeId: ancestry[0].node.id });
    const scope: Inspection.ScopeItemByKey = maybeScope;

    const triedScopeType: Inspection.TriedScopeType = Inspection.tryScopeType(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        ancestry[0].node.id,
        {
            scopeById,
            typeById: new Map(),
        },
    );
    if (ResultUtils.isErr(triedScopeType)) {
        return triedScopeType;
    }

    const triedExpectedType: Inspection.TriedExpectedType = Inspection.tryExpectedType(settings, activeNode);
    if (ResultUtils.isErr(triedExpectedType)) {
        return triedExpectedType;
    }

    return ResultUtils.okFactory({
        maybeActiveNode,
        autocomplete: triedAutocomplete.value,
        maybeInvokeExpression: triedInvokeExpression.value,
        scope,
        scopeType: triedScopeType.value,
        maybeExpectedType: triedExpectedType.value,
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
    const maybeTriedParse: TriedParse<S> | undefined = maybeTriedParseFromTriedLexParse(triedLexParse);
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
): TriedParse<S> | undefined {
    let root: Ast.TNode;
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
            throw Assert.isNever(triedLexParse.error);
        }
    } else {
        const lexParseOk: LexParseOk<S> = triedLexParse.value;
        root = lexParseOk.root;
        nodeIdMapCollection = lexParseOk.state.contextState.nodeIdMapCollection;
        leafNodeIds = lexParseOk.state.contextState.leafNodeIds;
        state = lexParseOk.state;
    }

    return ResultUtils.okFactory({
        root,
        leafNodeIds,
        nodeIdMapCollection,
        state,
    });
}

export function rootFromTriedLexParse<S extends IParserState = IParserState>(
    triedLexParse: TriedLexParse<S>,
): TXorNode | undefined {
    if (ResultUtils.isOk(triedLexParse)) {
        return NodeIdMapUtils.xorNodeFromAst(triedLexParse.value.root);
    }

    if (triedLexParse.error instanceof LexError.LexError) {
        return undefined;
    } else if (triedLexParse.error instanceof CommonError.CommonError) {
        return undefined;
    } else {
        const maybeContextNode: ParseContext.Node | undefined = triedLexParse.error.state.contextState.maybeRoot;
        return maybeContextNode !== undefined ? NodeIdMapUtils.xorNodeFromContext(maybeContextNode) : undefined;
    }
}

export function rootFromTriedLexParseInspect<S extends IParserState = IParserState>(
    triedLexInspectParseInspect: TriedLexParseInspect<S>,
): TXorNode | undefined {
    if (ResultUtils.isOk(triedLexInspectParseInspect)) {
        const maybeActiveNode: ActiveNode | undefined = triedLexInspectParseInspect.value.maybeActiveNode;
        return maybeActiveNode?.ancestry.length ? maybeActiveNode.ancestry[0] : undefined;
    }

    if (triedLexInspectParseInspect.error instanceof LexError.LexError) {
        return undefined;
    } else if (triedLexInspectParseInspect.error instanceof CommonError.CommonError) {
        return undefined;
    } else {
        const maybeContextNode: ParseContext.Node | undefined =
            triedLexInspectParseInspect.error.state.contextState.maybeRoot;
        return maybeContextNode !== undefined ? NodeIdMapUtils.xorNodeFromContext(maybeContextNode) : undefined;
    }
}
