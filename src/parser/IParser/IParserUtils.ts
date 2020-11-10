// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { CommonError, ResultUtils } from "../../common";
import { Ast } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { ParseSettings } from "../../settings";
import { ParseContext, ParseContextUtils } from "../context";
import { IParseState, IParseStateUtils } from "../IParseState";
import { NodeIdMap, NodeIdMapUtils } from "../nodeIdMap";
import { IParser, IParseStateCheckpoint, TriedParse } from "./IParser";

export function tryParse<S extends IParseState = IParseState>(
    parseSettings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
): TriedParse<S> {
    const maybeParserEntryPointFn: ((state: S, parser: IParser<S>) => Ast.TNode) | undefined =
        parseSettings?.maybeParserEntryPointFn;

    if (maybeParserEntryPointFn === undefined) {
        return tryParseDocument<S>(parseSettings, lexerSnapshot) as TriedParse<S>;
    }

    const parseState: S = parseSettings.parseStateFactory(lexerSnapshot, {
        maybeCancellationToken: parseSettings.maybeCancellationToken,
        locale: parseSettings.locale,
    });
    try {
        const root: Ast.TNode = maybeParserEntryPointFn(parseState, parseSettings.parser);
        IParseStateUtils.assertNoMoreTokens(parseState);
        IParseStateUtils.assertNoOpenContext(parseState);
        return ResultUtils.okFactory({
            lexerSnapshot,
            root,
            state: parseState,
        });
    } catch (error) {
        return ResultUtils.errFactory(ensureParseError(parseState, error, parseSettings.locale));
    }
}

export function tryParseDocument<S extends IParseState = IParseState>(
    parseSettings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
): TriedParse {
    let root: Ast.TNode;

    const expressionDocumentState: S = parseSettings.parseStateFactory(lexerSnapshot, {
        maybeCancellationToken: parseSettings.maybeCancellationToken,
        locale: parseSettings.locale,
    });
    try {
        root = parseSettings.parser.readExpression(expressionDocumentState, parseSettings.parser);
        IParseStateUtils.assertNoMoreTokens(expressionDocumentState);
        IParseStateUtils.assertNoOpenContext(expressionDocumentState);
        return ResultUtils.okFactory({
            lexerSnapshot,
            root,
            state: expressionDocumentState,
        });
    } catch (expressionDocumentError) {
        const sectionDocumentState: S = parseSettings.parseStateFactory(lexerSnapshot, {
            maybeCancellationToken: parseSettings.maybeCancellationToken,
            locale: parseSettings.locale,
        });
        try {
            root = parseSettings.parser.readSectionDocument(sectionDocumentState, parseSettings.parser);
            IParseStateUtils.assertNoMoreTokens(sectionDocumentState);
            IParseStateUtils.assertNoOpenContext(sectionDocumentState);
            return ResultUtils.okFactory({
                lexerSnapshot,
                root,
                state: sectionDocumentState,
            });
        } catch (sectionDocumentError) {
            let betterParsedState: S;
            let betterParsedError: Error;

            if (expressionDocumentState.tokenIndex >= sectionDocumentState.tokenIndex) {
                betterParsedState = expressionDocumentState;
                betterParsedError = expressionDocumentError;
            } else {
                betterParsedState = sectionDocumentState;
                betterParsedError = sectionDocumentError;
            }

            return ResultUtils.errFactory(ensureParseError(betterParsedState, betterParsedError, parseSettings.locale));
        }
    }
}

// Due to performance reasons the backup no longer can include a naive deep copy of the context state.
// Instead it's assumed that a backup is made immediately before a try/catch read block.
// This means the state begins in a parsing context and the backup will either be immediately consumed or dropped.
// Therefore we only care about the delta between before and after the try/catch block.
// Thanks to the invariants above and the fact the ids for nodes are an auto-incrementing integer
// we can easily just drop all delete all context nodes past the id of when the backup was created.
export function stateCheckpointFactory(state: IParseState): IParseStateCheckpoint {
    return {
        tokenIndex: state.tokenIndex,
        contextStateIdCounter: state.contextState.idCounter,
        maybeContextNodeId: state.maybeCurrentContextNode?.id,
    };
}

// See stateCheckpointFactory above for more information.
export function restoreStateCheckpoint(state: IParseState, checkpoint: IParseStateCheckpoint): void {
    state.tokenIndex = checkpoint.tokenIndex;
    state.maybeCurrentToken = state.lexerSnapshot.tokens[state.tokenIndex];
    state.maybeCurrentTokenKind = state.maybeCurrentToken?.kind;

    const contextState: ParseContext.State = state.contextState;
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const backupIdCounter: number = checkpoint.contextStateIdCounter;
    contextState.idCounter = backupIdCounter;

    const newContextNodeIds: number[] = [];
    const newAstNodeIds: number[] = [];
    for (const nodeId of nodeIdMapCollection.astNodeById.keys()) {
        if (nodeId > backupIdCounter) {
            newAstNodeIds.push(nodeId);
        }
    }
    for (const nodeId of nodeIdMapCollection.contextNodeById.keys()) {
        if (nodeId > backupIdCounter) {
            newContextNodeIds.push(nodeId);
        }
    }

    const sortByNumber: (left: number, right: number) => number = (left: number, right: number) => left - right;
    for (const nodeId of newAstNodeIds.sort(sortByNumber).reverse()) {
        const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);
        const parentWillBeDeleted: boolean = maybeParentId !== undefined && maybeParentId >= backupIdCounter;
        ParseContextUtils.deleteAst(state.contextState, nodeId, parentWillBeDeleted);
    }
    for (const nodeId of newContextNodeIds.sort(sortByNumber).reverse()) {
        ParseContextUtils.deleteContext(state.contextState, nodeId);
    }

    if (checkpoint.maybeContextNodeId) {
        state.maybeCurrentContextNode = NodeIdMapUtils.assertGetContext(
            state.contextState.nodeIdMapCollection.contextNodeById,
            checkpoint.maybeContextNodeId,
        );
    } else {
        state.maybeCurrentContextNode = undefined;
    }
}

function ensureParseError<S extends IParseState = IParseState>(
    state: S,
    error: Error,
    locale: string,
): ParseError.TParseError<S> {
    if (ParseError.isTInnerParseError(error)) {
        return new ParseError.ParseError(error, state);
    } else {
        return CommonError.ensureCommonError(locale, error);
    }
}
