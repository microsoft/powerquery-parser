// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../../common";
import { NodeIdMap, NodeIdMapUtils } from "../nodeIdMap";
import { ParseContext, ParseContextUtils } from "../context";
import { ParseError, ParseSettings } from "..";
import { ParseOk, Parser, ParseStateCheckpoint, TriedParse } from "./parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { Ast } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { ParseBehavior } from "../parseBehavior";
import { Trace } from "../../common/trace";

export async function tryParse(parseSettings: ParseSettings, lexerSnapshot: LexerSnapshot): Promise<TriedParse> {
    const trace: Trace = parseSettings.traceManager.entry(
        ParserUtilsTraceConstant.ParserUtils,
        tryParse.name,
        parseSettings.initialCorrelationId,
    );

    const updatedSettings: ParseSettings = {
        ...parseSettings,
        initialCorrelationId: trace.id,
    };

    const result: TriedParse = updatedSettings.parserEntryPoint
        ? await tryParseEntryPoint(updatedSettings.parserEntryPoint, updatedSettings, lexerSnapshot)
        : await tryParseDocument(updatedSettings, lexerSnapshot);

    trace.exit();

    return result;
}

// If you have a custom parser + parser state,
// then you'll have to create your own checkpoint/restoreCheckpoint functions.
//
// Due to performance reasons the backup no longer can include a naive deep copy of the context state.
// Instead it's assumed that a backup is made immediately before a try/catch read block.
// This means the state begins in a parsing context and the backup will either be immediately consumed or dropped.
// Therefore we only care about the delta between before and after the try/catch block.
// Thanks to the invariants above and the fact the ids for nodes are an auto-incrementing integer
// we can easily delete all context nodes past the id of when the backup was created.
// eslint-disable-next-line require-await
export async function checkpoint(state: ParseState): Promise<ParseStateCheckpoint> {
    return {
        tokenIndex: state.tokenIndex,
        contextStateIdCounter: state.contextState.idCounter,
        contextNodeId: state.currentContextNode?.id,
    };
}

// If you have a custom parser + parser state,
// then you'll have to create your own (create|restore)Checkpoint functions.
// See createCheckpoint above for more information.
// eslint-disable-next-line require-await
export async function restoreCheckpoint(state: ParseState, checkpoint: ParseStateCheckpoint): Promise<void> {
    state.tokenIndex = checkpoint.tokenIndex;
    state.currentToken = state.lexerSnapshot.tokens[state.tokenIndex];
    state.currentTokenKind = state.currentToken?.kind;

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
        const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);
        const parentWillBeDeleted: boolean = parentId !== undefined && parentId >= backupIdCounter;
        ParseContextUtils.deleteAst(state.contextState, nodeId, parentWillBeDeleted);
    }

    for (const nodeId of newContextNodeIds.sort(reverseNumberSort)) {
        ParseContextUtils.deleteContext(state.contextState, nodeId);
    }

    if (checkpoint.contextNodeId) {
        state.currentContextNode = NodeIdMapUtils.assertContext(
            state.contextState.nodeIdMapCollection,
            checkpoint.contextNodeId,
        );
    } else {
        state.currentContextNode = undefined;
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
        cancellationToken: parseSettings.cancellationToken,
        traceManager: parseSettings.traceManager,
        parseBehavior: parseSettings.parseBehavior,
    };
}

async function tryParseEntryPoint(
    parserEntryPoint: (state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<Ast.TNode>,
    parseSettings: ParseSettings,
    lexerSnapshot: LexerSnapshot,
): Promise<TriedParse> {
    const trace: Trace = parseSettings.traceManager.entry(
        ParserUtilsTraceConstant.ParserUtils,
        tryParseEntryPoint.name,
        parseSettings.initialCorrelationId,
    );

    const parseState: ParseState = parseSettings.newParseState(lexerSnapshot, defaultOverrides(parseSettings));

    try {
        const root: Ast.TNode = await parserEntryPoint(parseState, parseSettings.parser, trace.id);
        ParseStateUtils.assertIsDoneParsing(parseState);

        trace.exit();

        return ResultUtils.ok({
            lexerSnapshot,
            root,
            state: parseState,
        });
    } catch (caught: unknown) {
        Assert.isInstanceofError(caught);
        CommonError.throwIfCancellationError(caught);

        const result: TriedParse = ResultUtils.error(ensureParseError(parseState, caught, parseSettings.locale));

        trace.exit();

        return result;
    }
}

// Attempts to parse the document both as an expression and section document.
// Whichever attempt consumed the most tokens is the one returned. Ties go to expression documents.
async function tryParseDocument(parseSettings: ParseSettings, lexerSnapshot: LexerSnapshot): Promise<TriedParse> {
    switch (parseSettings.parseBehavior) {
        case ParseBehavior.ParseEitherExpressionOrSection:
            return await tryParseExpressionDocumentOrSectionDocument(parseSettings, lexerSnapshot);

        case ParseBehavior.ParseExpression: {
            const expressionParseResult: InternalTriedParse = await tryParseExpressionDocument(
                parseSettings,
                lexerSnapshot,
            );

            return ResultUtils.isOk(expressionParseResult)
                ? expressionParseResult
                : ResultUtils.error(expressionParseResult.error.innerError);
        }

        case ParseBehavior.ParseSection: {
            const sectionParseResult: InternalTriedParse = await tryParseSectionDocument(parseSettings, lexerSnapshot);

            return ResultUtils.isOk(sectionParseResult)
                ? sectionParseResult
                : ResultUtils.error(sectionParseResult.error.innerError);
        }

        default:
            Assert.isNever(parseSettings.parseBehavior);
    }
}

async function tryParseExpressionDocumentOrSectionDocument(
    parseSettings: ParseSettings,
    lexerSnapshot: LexerSnapshot,
): Promise<TriedParse> {
    const trace: Trace = parseSettings.traceManager.entry(
        ParserUtilsTraceConstant.ParserUtils,
        tryParseExpressionDocumentOrSectionDocument.name,
        parseSettings.initialCorrelationId,
    );

    const parseExpressionResult: InternalTriedParse = await tryParseExpressionDocument(parseSettings, lexerSnapshot);

    if (ResultUtils.isOk(parseExpressionResult)) {
        trace.exit();

        return parseExpressionResult;
    }

    // If the expression parse failed, try parsing as a section document.
    const parseSectionResult: InternalTriedParse = await tryParseSectionDocument(parseSettings, lexerSnapshot);

    if (ResultUtils.isOk(parseSectionResult)) {
        trace.exit();

        return parseSectionResult;
    }

    // If both parse attempts fail then return the instance with the most tokens consumed.
    // On ties fallback to the expression parse attempt.
    const errorResult: TriedParse = ResultUtils.error(
        parseExpressionResult.error.tokensConsumed >= parseSectionResult.error.tokensConsumed
            ? parseExpressionResult.error.innerError
            : parseSectionResult.error.innerError,
    );

    trace.exit();

    return errorResult;
}

async function tryParseExpressionDocument(
    parseSettings: ParseSettings,
    lexerSnapshot: LexerSnapshot,
): Promise<InternalTriedParse> {
    const trace: Trace = parseSettings.traceManager.entry(
        ParserUtilsTraceConstant.ParserUtils,
        tryParseExpressionDocument.name,
        parseSettings.initialCorrelationId,
    );

    const parseState: ParseState = parseSettings.newParseState(lexerSnapshot, defaultOverrides(parseSettings));

    try {
        const root: Ast.TExpression = await parseSettings.parser.readExpression(
            parseState,
            parseSettings.parser,
            trace.id,
        );

        ParseStateUtils.assertIsDoneParsing(parseState);
        trace.exit();

        return ResultUtils.ok({
            lexerSnapshot,
            root,
            state: parseState,
        });
    } catch (error: unknown) {
        Assert.isInstanceofError(error);
        CommonError.throwIfCancellationError(error);

        const result: InternalTriedParse = ResultUtils.error({
            innerError: ensureParseError(parseState, error, parseSettings.locale),
            tokensConsumed: parseState.tokenIndex,
        });

        trace.exit();

        return result;
    }
}

async function tryParseSectionDocument(
    parseSettings: ParseSettings,
    lexerSnapshot: LexerSnapshot,
): Promise<InternalTriedParse> {
    const trace: Trace = parseSettings.traceManager.entry(
        ParserUtilsTraceConstant.ParserUtils,
        tryParseSectionDocument.name,
        parseSettings.initialCorrelationId,
    );

    const parseState: ParseState = parseSettings.newParseState(lexerSnapshot, defaultOverrides(parseSettings));

    try {
        const root: Ast.Section = await parseSettings.parser.readSectionDocument(
            parseState,
            parseSettings.parser,
            trace.id,
        );

        ParseStateUtils.assertIsDoneParsing(parseState);
        trace.exit();

        return ResultUtils.ok({
            lexerSnapshot,
            root,
            state: parseState,
        });
    } catch (error: unknown) {
        Assert.isInstanceofError(error);
        CommonError.throwIfCancellationError(error);

        const result: InternalTriedParse = ResultUtils.error({
            innerError: ensureParseError(parseState, error, parseSettings.locale),
            tokensConsumed: parseState.tokenIndex,
        });

        trace.exit();

        return result;
    }
}

// Note: Internal type
// Used specifically for comparing parse attempts when both an expression and section document are attempted.
// Not a general extension of TriedParse; do not use outside this context.
// Adds `tokensConsumed` to the TriedParse type to help determine which parse attempt should be returned.
type InternalTriedParse = Result<ParseOk, InternalTriedParseError>;

interface InternalTriedParseError {
    readonly innerError: ParseError.TParseError;
    readonly tokensConsumed: number;
}
