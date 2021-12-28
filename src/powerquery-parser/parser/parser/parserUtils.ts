// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from "..";
import { CommonError, ResultUtils } from "../../common";
import { Ast } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { ParseSettings } from "../../settings";
import { ParseContext, ParseContextUtils } from "../context";
import { NodeIdMap, NodeIdMapUtils } from "../nodeIdMap";
import { ParseState, ParseStateUtils } from "../parseState";
import { Parser, ParseStateCheckpoint, TriedParse } from "./parser";

export function tryParse(parseSettings: ParseSettings, lexerSnapshot: LexerSnapshot): TriedParse {
    const maybeParserEntryPointFn: ((state: ParseState, parser: Parser) => Ast.TNode) | undefined =
        parseSettings?.maybeParserEntryPointFn;

    if (maybeParserEntryPointFn === undefined) {
        return tryParseDocument(parseSettings, lexerSnapshot);
    }

    const parseState: ParseState = parseSettings.createParseState(lexerSnapshot, defaultOverrides(parseSettings));
    try {
        const root: Ast.TNode = maybeParserEntryPointFn(parseState, parseSettings.parser);
        ParseStateUtils.assertIsDoneParsing(parseState);
        return ResultUtils.boxOk({
            lexerSnapshot,
            root,
            state: parseState,
        });
    } catch (error) {
        return ResultUtils.boxError(ensureParseError(parseState, error, parseSettings.locale));
    }
}

export function tryParseDocument(parseSettings: ParseSettings, lexerSnapshot: LexerSnapshot): TriedParse {
    let root: Ast.TNode;

    const expressionDocumentState: ParseState = parseSettings.createParseState(
        lexerSnapshot,
        defaultOverrides(parseSettings),
    );
    try {
        root = parseSettings.parser.readExpression(expressionDocumentState, parseSettings.parser);
        ParseStateUtils.assertIsDoneParsing(expressionDocumentState);
        return ResultUtils.boxOk({
            lexerSnapshot,
            root,
            state: expressionDocumentState,
        });
    } catch (expressionDocumentError) {
        const sectionDocumentState: ParseState = parseSettings.createParseState(
            lexerSnapshot,
            defaultOverrides(parseSettings),
        );
        try {
            root = parseSettings.parser.readSectionDocument(sectionDocumentState, parseSettings.parser);
            ParseStateUtils.assertIsDoneParsing(sectionDocumentState);
            return ResultUtils.boxOk({
                lexerSnapshot,
                root,
                state: sectionDocumentState,
            });
        } catch (sectionDocumentError) {
            let betterParsedState: ParseState;
            let betterParsedError: Error;

            if (expressionDocumentState.tokenIndex >= sectionDocumentState.tokenIndex) {
                betterParsedState = expressionDocumentState;
                betterParsedError = expressionDocumentError;
            } else {
                betterParsedState = sectionDocumentState;
                betterParsedError = sectionDocumentError;
            }

            return ResultUtils.boxError(ensureParseError(betterParsedState, betterParsedError, parseSettings.locale));
        }
    }
}

// If you have a custom parser + parser state,
// then you'll have to create your own (create|restore)Checkpoint functions.
// See `benchmark.ts` for an example.
//
// Due to performance reasons the backup no longer can include a naive deep copy of the context state.
// Instead it's assumed that a backup is made immediately before a try/catch read block.
// This means the state begins in a parsing context and the backup will either be immediately consumed or dropped.
// Therefore we only care about the delta between before and after the try/catch block.
// Thanks to the invariants above and the fact the ids for nodes are an auto-incrementing integer
// we can easily just drop all delete all context nodes past the id of when the backup was created.
export function createCheckpoint(state: ParseState): ParseStateCheckpoint {
    return {
        tokenIndex: state.tokenIndex,
        contextStateIdCounter: state.contextState.idCounter,
        maybeContextNodeId: state.maybeCurrentContextNode?.id,
    };
}

// If you have a custom parser + parser state,
// then you'll have to create your own (create|restore)Checkpoint functions.
// See `benchmark.ts` for an example.
//
// See createCheckpoint above for more information.
export function restoreCheckpoint(state: ParseState, checkpoint: ParseStateCheckpoint): void {
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

    const reverseNumberSort: (left: number, right: number) => number = (left: number, right: number) => right - left;
    for (const nodeId of newAstNodeIds.sort(reverseNumberSort)) {
        const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);
        const parentWillBeDeleted: boolean = maybeParentId !== undefined && maybeParentId >= backupIdCounter;
        ParseContextUtils.deleteAst(state.contextState, nodeId, parentWillBeDeleted);
    }
    for (const nodeId of newContextNodeIds.sort(reverseNumberSort)) {
        ParseContextUtils.deleteContext(state.contextState, nodeId);
    }

    if (checkpoint.maybeContextNodeId) {
        state.maybeCurrentContextNode = NodeIdMapUtils.assertUnboxContext(
            state.contextState.nodeIdMapCollection.contextNodeById,
            checkpoint.maybeContextNodeId,
        );
    } else {
        state.maybeCurrentContextNode = undefined;
    }
}

function ensureParseError(state: ParseState, error: Error, locale: string): ParseError.TParseError {
    if (error instanceof ParseError.ParseError) {
        return error;
    } else if (ParseError.isTInnerParseError(error)) {
        return new ParseError.ParseError(error, state);
    } else {
        return CommonError.ensureCommonError(locale, error);
    }
}

function defaultOverrides(parseSettings: ParseSettings): Partial<ParseState> {
    return {
        locale: parseSettings.locale,
        maybeCancellationToken: parseSettings.maybeCancellationToken,
        traceManager: parseSettings.traceManager,
    };
}
