// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ResultUtils } from "../../common";
import { NodeIdMap, NodeIdMapUtils } from "../nodeIdMap";
import { ParseContext, ParseContextUtils } from "../context";
import { Parser, ParseStateCheckpoint, TriedParse } from "./parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { Ast } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { ParseError } from "..";
import { ParseSettings } from "../../settings";
import { Trace } from "../../common/trace";

export async function tryParse(parseSettings: ParseSettings, lexerSnapshot: LexerSnapshot): Promise<TriedParse> {
    const trace: Trace = parseSettings.traceManager.entry(
        ParserUtilsTraceConstant.ParserUtils,
        tryParse.name,
        parseSettings.maybeInitialCorrelationId,
    );

    const maybeParserEntryPointFn:
        | ((state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) => Promise<Ast.TNode>)
        | undefined = parseSettings?.maybeParserEntryPointFn;

    if (maybeParserEntryPointFn === undefined) {
        return await tryParseDocument(parseSettings, lexerSnapshot, trace.id);
    }

    const parseState: ParseState = parseSettings.createParseState(lexerSnapshot, defaultOverrides(parseSettings));

    try {
        const root: Ast.TNode = await maybeParserEntryPointFn(parseState, parseSettings.parser, trace.id);
        ParseStateUtils.assertIsDoneParsing(parseState);

        return ResultUtils.boxOk({
            lexerSnapshot,
            root,
            state: parseState,
        });
    } catch (error) {
        Assert.isInstanceofError(error);

        return ResultUtils.boxError(ensureParseError(parseState, error, parseSettings.locale));
    }
}

export async function tryParseDocument(
    parseSettings: ParseSettings,
    lexerSnapshot: LexerSnapshot,
    maybeCorrelationId: number | undefined,
): Promise<TriedParse> {
    const trace: Trace = parseSettings.traceManager.entry(
        ParserUtilsTraceConstant.ParserUtils,
        tryParseDocument.name,
        maybeCorrelationId,
    );

    let root: Ast.TNode;

    const expressionDocumentState: ParseState = parseSettings.createParseState(
        lexerSnapshot,
        defaultOverrides(parseSettings),
    );

    try {
        root = await parseSettings.parser.readExpression(expressionDocumentState, parseSettings.parser, trace.id);
        ParseStateUtils.assertIsDoneParsing(expressionDocumentState);
        trace.exit();

        return ResultUtils.boxOk({
            lexerSnapshot,
            root,
            state: expressionDocumentState,
        });
    } catch (expressionDocumentError) {
        Assert.isInstanceofError(expressionDocumentError);

        const sectionDocumentState: ParseState = parseSettings.createParseState(
            lexerSnapshot,
            defaultOverrides(parseSettings),
        );

        try {
            root = await parseSettings.parser.readSectionDocument(sectionDocumentState, parseSettings.parser, trace.id);
            ParseStateUtils.assertIsDoneParsing(sectionDocumentState);
            trace.exit();

            return ResultUtils.boxOk({
                lexerSnapshot,
                root,
                state: sectionDocumentState,
            });
        } catch (sectionDocumentError) {
            Assert.isInstanceofError(sectionDocumentError);

            let betterParsedState: ParseState;
            let betterParsedError: Error;

            if (expressionDocumentState.tokenIndex >= sectionDocumentState.tokenIndex) {
                betterParsedState = expressionDocumentState;
                betterParsedError = expressionDocumentError;
            } else {
                betterParsedState = sectionDocumentState;
                betterParsedError = sectionDocumentError;
            }

            trace.exit();

            return ResultUtils.boxError(ensureParseError(betterParsedState, betterParsedError, parseSettings.locale));
        }
    }
}

// If you have a custom parser + parser state,
// then you'll have to create your own (create|restore)Checkpoint functions.
//
// Due to performance reasons the backup no longer can include a naive deep copy of the context state.
// Instead it's assumed that a backup is made immediately before a try/catch read block.
// This means the state begins in a parsing context and the backup will either be immediately consumed or dropped.
// Therefore we only care about the delta between before and after the try/catch block.
// Thanks to the invariants above and the fact the ids for nodes are an auto-incrementing integer
// we can easily just drop all delete all context nodes past the id of when the backup was created.
// eslint-disable-next-line require-await
export async function createCheckpoint(state: ParseState): Promise<ParseStateCheckpoint> {
    return {
        tokenIndex: state.tokenIndex,
        contextStateIdCounter: state.contextState.idCounter,
        maybeContextNodeId: state.maybeCurrentContextNode?.id,
    };
}

// If you have a custom parser + parser state,
// then you'll have to create your own (create|restore)Checkpoint functions.
// See createCheckpoint above for more information.
// eslint-disable-next-line require-await
export async function restoreCheckpoint(state: ParseState, checkpoint: ParseStateCheckpoint): Promise<void> {
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

const enum ParserUtilsTraceConstant {
    ParserUtils = "ParserUtils",
}

function ensureParseError(state: ParseState, error: Error, locale: string): ParseError.TParseError {
    if (error instanceof ParseError.ParseError) {
        return error;
    } else if (ParseError.isTInnerParseError(error)) {
        return new ParseError.ParseError(error, state);
    } else {
        return CommonError.ensureCommonError(error, locale);
    }
}

function defaultOverrides(parseSettings: ParseSettings): Partial<ParseState> {
    return {
        locale: parseSettings.locale,
        maybeCancellationToken: parseSettings.maybeCancellationToken,
        traceManager: parseSettings.traceManager,
    };
}
