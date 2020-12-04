// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Inspection } from ".";
import { Lexer } from ".";
import { Assert, CommonError, Result, ResultUtils } from "./powerquery-parser/common";
import { ActiveNodeUtils, TMaybeActiveNode } from "./powerquery-parser/inspection/activeNode";
import { Ast } from "./powerquery-parser/language";
import { LexError, LexerSnapshot } from "./powerquery-parser/lexer";
import {
    IParserUtils,
    IParseState,
    NodeIdMap,
    ParseContext,
    ParseError,
    ParseOk,
    TriedParse,
    TXorNode,
    XorNodeUtils,
} from "./powerquery-parser/parser";
import { LexSettings, ParseSettings } from "./powerquery-parser/settings/settings";

export type TriedLexParse<S extends IParseState = IParseState> = Result<
    LexParseOk<S>,
    LexError.TLexError | ParseError.TParseError<S>
>;

export type TriedLexParseInspect<S extends IParseState = IParseState> = Result<
    LexParseInspectOk<S>,
    CommonError.CommonError | LexError.LexError | ParseError.ParseError
>;

export interface LexParseOk<S extends IParseState = IParseState> extends ParseOk<S> {
    readonly lexerSnapshot: Lexer.LexerSnapshot;
}

export interface LexParseInspectOk<S extends IParseState = IParseState> extends Inspection.Inspection {
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
            new LexError.LexError(new LexError.ErrorLineMapError(settings.locale, errorLineMap)),
        );
    }

    return Lexer.trySnapshot(state);
}

export function tryParse<S extends IParseState = IParseState>(
    parseSettings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
): TriedParse<S> {
    return IParserUtils.tryParse<S>(parseSettings, lexerSnapshot) as TriedParse<S>;
}

export function tryInspection<S extends IParseState = IParseState>(
    parseSettings: ParseSettings<S>,
    triedParse: TriedParse<S>,
    position: Inspection.Position,
): Inspection.TriedInspection {
    let parseState: S;
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

        parseState = triedParse.error.state;
    } else {
        parseState = triedParse.value.state;
    }

    return ResultUtils.okFactory(Inspection.inspection(parseSettings, parseState, maybeParseError, position));
}

export function tryLexParse<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): TriedLexParse<S> {
    const triedLexerSnapshot: Lexer.TriedLexerSnapshot = tryLex(settings, text);
    if (ResultUtils.isErr(triedLexerSnapshot)) {
        return triedLexerSnapshot;
    }
    const lexerSnapshot: Lexer.LexerSnapshot = triedLexerSnapshot.value;

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

export function tryLexParseInspection<S extends IParseState = IParseState>(
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
    const triedInspection: Inspection.TriedInspection = tryInspection(settings, triedParse, position);

    if (ResultUtils.isErr(triedInspection)) {
        return triedInspection;
    }

    return ResultUtils.okFactory({
        ...triedInspection.value,
        triedParse,
    });
}

export function maybeTriedParseFromTriedLexParse<S extends IParseState>(
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

export function rootFromTriedLexParse<S extends IParseState = IParseState>(
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

export function rootFromTriedLexParseInspect<S extends IParseState = IParseState>(
    triedLexInspectParseInspect: TriedLexParseInspect<S>,
): TXorNode | undefined {
    if (ResultUtils.isOk(triedLexInspectParseInspect)) {
        const maybeActiveNode: TMaybeActiveNode = triedLexInspectParseInspect.value.maybeActiveNode;
        return ActiveNodeUtils.isPositionInBounds(maybeActiveNode) ? maybeActiveNode.ancestry[0] : undefined;
    } else if (ParseError.isParseError(triedLexInspectParseInspect.error)) {
        const maybeContextNode: ParseContext.Node | undefined =
            triedLexInspectParseInspect.error.state.contextState.maybeRoot;
        return maybeContextNode !== undefined ? XorNodeUtils.contextFactory(maybeContextNode) : undefined;
    } else {
        return undefined;
    }
}
