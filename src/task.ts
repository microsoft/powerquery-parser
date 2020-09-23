// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from ".";
import { Lexer } from ".";
import { Assert, CommonError, Result, ResultUtils } from "./common";
import { InspectionOk, TriedInspection } from "./inspection";
import { ActiveNode } from "./inspection/activeNode";
import { Ast } from "./language";
import { LexError } from "./lexer";
import { LocalizationUtils } from "./localization";
import {
    IParser,
    IParserState,
    IParserUtils,
    NodeIdMap,
    ParseContext,
    ParseError,
    ParseOk,
    TriedParse,
    TXorNode,
    XorNodeUtils,
} from "./parser";
import { CommonSettings, LexSettings, ParseSettings } from "./settings/settings";

export type TriedLexParse<S extends IParserState = IParserState> = Result<
    LexParseOk<S>,
    LexError.TLexError | ParseError.TParseError<S>
>;

export type TriedLexParseInspect<S extends IParserState = IParserState> = Result<
    LexParseInspectOk<S>,
    CommonError.CommonError | LexError.LexError | ParseError.ParseError
>;

export interface LexParseOk<S extends IParserState = IParserState> extends ParseOk<S> {
    readonly lexerSnapshot: Lexer.LexerSnapshot;
}

export interface LexParseInspectOk<S extends IParserState = IParserState> extends InspectionOk {
    readonly triedParse: TriedParse<S>;
}

export function tryLex(settings: LexSettings, text: string): Lexer.TriedLexerSnapshot {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    if (ResultUtils.isErr(triedLex)) {
        return triedLex;
    }
    const state: Lexer.State = triedLex.value;

    const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;
        return ResultUtils.errFactory(
            new LexError.LexError(
                new LexError.ErrorLineMapError(
                    LocalizationUtils.getLocalizationTemplates(settings.locale),
                    errorLineMap,
                ),
            ),
        );
    }

    return Lexer.trySnapshot(state);
}

export function tryParse<S extends IParserState = IParserState>(state: S, parser: IParser<S>): TriedParse<S> {
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
        if (CommonError.isCommonError(triedParse.error)) {
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

    return Inspection.tryInspection(settings, nodeIdMapCollection, leafNodeIds, maybeParseError, position);
}

export function tryLexParse<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: Lexer.LexerSnapshot) => S,
): TriedLexParse<S> {
    const triedLexerSnapshot: Lexer.TriedLexerSnapshot = tryLex(settings, text);
    if (ResultUtils.isErr(triedLexerSnapshot)) {
        return triedLexerSnapshot;
    }
    const lexerSnapshot: Lexer.LexerSnapshot = triedLexerSnapshot.value;

    const state: S = stateFactoryFn(settings, lexerSnapshot);
    const triedParse: TriedParse<S> = tryParse<S>(state, settings.parser);
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
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: Lexer.LexerSnapshot) => S,
): TriedLexParseInspect<S> {
    const triedLexParse: TriedLexParse<S> = tryLexParse(settings, text, stateFactoryFn);
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
        if (LexError.isTLexError(triedLexParse.error)) {
            return undefined;
        } else if (ParseError.isParseError(triedLexParse.error)) {
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
        return XorNodeUtils.astFactory(triedLexParse.value.root);
    } else if (ParseError.isParseError(triedLexParse.error)) {
        const maybeContextNode: ParseContext.Node | undefined = triedLexParse.error.state.contextState.maybeRoot;
        return maybeContextNode !== undefined ? XorNodeUtils.contextFactory(maybeContextNode) : undefined;
    } else {
        return undefined;
    }
}

export function rootFromTriedLexParseInspect<S extends IParserState = IParserState>(
    triedLexInspectParseInspect: TriedLexParseInspect<S>,
): TXorNode | undefined {
    if (ResultUtils.isOk(triedLexInspectParseInspect)) {
        const maybeActiveNode: ActiveNode | undefined = triedLexInspectParseInspect.value.maybeActiveNode;
        return maybeActiveNode?.ancestry.length ? maybeActiveNode.ancestry[0] : undefined;
    } else if (ParseError.isParseError(triedLexInspectParseInspect.error)) {
        const maybeContextNode: ParseContext.Node | undefined =
            triedLexInspectParseInspect.error.state.contextState.maybeRoot;
        return maybeContextNode !== undefined ? XorNodeUtils.contextFactory(maybeContextNode) : undefined;
    } else {
        return undefined;
    }
}
