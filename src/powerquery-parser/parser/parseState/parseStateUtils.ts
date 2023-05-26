// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils } from "../../common";
import { Ast, Constant, Token } from "../../language";
import { NodeIdMap, NodeIdMapUtils, ParseContext, ParseContextUtils, ParseError, TXorNode, XorNodeUtils } from "..";
import { NoOpTraceManagerInstance, Trace } from "../../common/trace";
import { DefaultLocale } from "../../localization";
import { Disambiguation } from "../disambiguation";
import { LexerSnapshot } from "../../lexer";
import { ParseState } from "./parseState";
import { SequenceKind } from "../error";

export function newState(lexerSnapshot: LexerSnapshot, overrides: Partial<ParseState> | undefined): ParseState {
    const tokenIndex: number = overrides?.tokenIndex ?? 0;
    const currentToken: Token.Token | undefined = lexerSnapshot.tokens[tokenIndex];
    const currentTokenKind: Token.TokenKind | undefined = currentToken?.kind;
    const contextState: ParseContext.State = overrides?.contextState ?? ParseContextUtils.newState();
    const nodeIdMapCollection: NodeIdMap.Collection = contextState.nodeIdMapCollection;

    const currentContextNodeId: number | undefined =
        nodeIdMapCollection.contextNodeById.size > 0
            ? Math.max(...nodeIdMapCollection.contextNodeById.keys())
            : undefined;

    const currentContextNode: ParseContext.TNode | undefined =
        currentContextNodeId !== undefined
            ? MapUtils.assertGet(nodeIdMapCollection.contextNodeById, currentContextNodeId)
            : undefined;

    return {
        ...overrides,
        disambiguationBehavior: overrides?.disambiguationBehavior ?? Disambiguation.DismabiguationBehavior.Thorough,
        lexerSnapshot,
        locale: overrides?.locale ?? DefaultLocale,
        cancellationToken: overrides?.cancellationToken,
        traceManager: overrides?.traceManager ?? NoOpTraceManagerInstance,
        contextState: overrides?.contextState ?? ParseContextUtils.newState(),
        currentToken,
        currentContextNode,
        currentTokenKind,
        tokenIndex,
    };
}

// If you have a custom parser + parser state, then you'll have to create your own copyState/applyState functions.
// eslint-disable-next-line require-await
export async function applyState(state: ParseState, update: ParseState): Promise<void> {
    state.tokenIndex = update.tokenIndex;
    state.currentToken = update.currentToken;
    state.currentTokenKind = update.currentTokenKind;
    state.contextState = update.contextState;
    state.currentContextNode = update.currentContextNode;
}

// If you have a custom parser + parser state, then you'll have to create your own copyState/applyState functions.
// eslint-disable-next-line require-await
export async function copyState(state: ParseState): Promise<ParseState> {
    return {
        ...state,
        contextState: ParseContextUtils.copyState(state.contextState),
    };
}

export function startContext<T extends Ast.TNode>(state: ParseState, nodeKind: T["kind"]): ParseContext.Node<T> {
    const newContextNode: ParseContext.Node<T> = ParseContextUtils.startContext(
        state.contextState,
        nodeKind,
        state.tokenIndex,
        state.currentToken,
        state.currentContextNode,
    );

    state.currentContextNode = newContextNode;

    return newContextNode;
}

// Inserts a new context as the parent of an existing node.
// Requires a re-calculation of all nodeIds associated with or under the inserted context.
export function startContextAsParent<T extends Ast.TNode>(
    state: ParseState,
    nodeKind: T["kind"],
    existingNodeId: number,
    correlationId: number | undefined,
): ParseContext.Node<T> {
    const trace: Trace = state.traceManager.entry(
        ParseStateUtilsTraceConstant.ParseStateUtils,
        startContextAsParent.name,
        correlationId,
        { existingNodeId },
    );

    // We need to find the starting token for the existing node as it'll be the starting token for the new context.
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const existingNode: TXorNode = NodeIdMapUtils.assertXor(nodeIdMapCollection, existingNodeId);

    const tokenStart: Token.Token | undefined = XorNodeUtils.isAst(existingNode)
        ? ArrayUtils.assertGet(state.lexerSnapshot.tokens, existingNode.node.tokenRange.tokenIndexStart)
        : existingNode.node.tokenStart;

    const insertedContext: ParseContext.Node<T> = ParseContextUtils.startContextAsParent(
        state.contextState,
        nodeKind,
        existingNodeId,
        tokenStart,
    );

    NodeIdMapUtils.recalculateAndUpdateIds(nodeIdMapCollection, insertedContext.id, state.traceManager, trace.id);

    trace.exit();

    return insertedContext;
}

export function endContext<T extends Ast.TNode>(state: ParseState, astNode: T): void {
    const contextNode: ParseContext.TNode = Assert.asDefined(
        state.currentContextNode,
        `can't end a context if one doesn't exist`,
    );

    const parentOfContextNode: ParseContext.TNode | undefined = ParseContextUtils.endContext(
        state.contextState,
        contextNode,
        astNode,
    );

    state.currentContextNode = parentOfContextNode;
}

export function deleteContext(state: ParseState, nodeId?: number): void {
    if (nodeId === undefined) {
        nodeId = Assert.asDefined(state.currentContextNode, `can't delete a context if one doesn't exist`).id;
    }

    state.currentContextNode = ParseContextUtils.deleteContext(state.contextState, nodeId);
}

export function incrementAttributeCounter(state: ParseState): void {
    Assert.asDefined(state.currentContextNode, `state.currentContextNode`).attributeCounter += 1;
}

// -------------------------
// ---------- IsX ----------
// -------------------------

export function isTokenKind(state: ParseState, tokenKind: Token.TokenKind, tokenIndex: number): boolean {
    return state.lexerSnapshot.tokens[tokenIndex]?.kind === tokenKind ?? false;
}

export function isNextTokenKind(state: ParseState, tokenKind: Token.TokenKind): boolean {
    return isTokenKind(state, tokenKind, state.tokenIndex + 1);
}

export function isOnTokenKind(
    state: ParseState,
    tokenKind: Token.TokenKind,
    tokenIndex: number = state.tokenIndex,
): boolean {
    return isTokenKind(state, tokenKind, tokenIndex);
}

export function isOnConstantKind(state: ParseState, constantKind: Constant.TConstant): boolean {
    if (isOnTokenKind(state, Token.TokenKind.Identifier)) {
        const currentToken: Token.Token = state.lexerSnapshot.tokens[state.tokenIndex];

        if (currentToken?.data === undefined) {
            const details: { currentToken: Token.Token } = { currentToken };
            throw new CommonError.InvariantError(`expected data on Token`, details);
        }

        const data: string = currentToken.data;

        return data === constantKind;
    } else {
        return false;
    }
}

export function isOnGeneralizedIdentifierStart(state: ParseState, tokenIndex: number = state.tokenIndex): boolean {
    const tokenKind: Token.TokenKind | undefined = state.lexerSnapshot.tokens[tokenIndex]?.kind;

    if (tokenKind === undefined) {
        return false;
    }

    switch (tokenKind) {
        case Token.TokenKind.Identifier:
        case Token.TokenKind.KeywordAnd:
        case Token.TokenKind.KeywordAs:
        case Token.TokenKind.KeywordEach:
        case Token.TokenKind.KeywordElse:
        case Token.TokenKind.KeywordError:
        case Token.TokenKind.KeywordFalse:
        case Token.TokenKind.KeywordHashBinary:
        case Token.TokenKind.KeywordHashDate:
        case Token.TokenKind.KeywordHashDateTime:
        case Token.TokenKind.KeywordHashDateTimeZone:
        case Token.TokenKind.KeywordHashDuration:
        case Token.TokenKind.KeywordHashInfinity:
        case Token.TokenKind.KeywordHashNan:
        case Token.TokenKind.KeywordHashSections:
        case Token.TokenKind.KeywordHashShared:
        case Token.TokenKind.KeywordHashTable:
        case Token.TokenKind.KeywordHashTime:
        case Token.TokenKind.KeywordIf:
        case Token.TokenKind.KeywordIn:
        case Token.TokenKind.KeywordIs:
        case Token.TokenKind.KeywordLet:
        case Token.TokenKind.KeywordMeta:
        case Token.TokenKind.KeywordNot:
        case Token.TokenKind.KeywordOr:
        case Token.TokenKind.KeywordOtherwise:
        case Token.TokenKind.KeywordSection:
        case Token.TokenKind.KeywordShared:
        case Token.TokenKind.KeywordThen:
        case Token.TokenKind.KeywordTrue:
        case Token.TokenKind.KeywordTry:
        case Token.TokenKind.KeywordType:
            return true;

        default:
            return false;
    }
}

// Assumes a call to readPrimaryExpression has already happened.
export function isRecursivePrimaryExpressionNext(
    state: ParseState,
    tokenIndexStart: number = state.tokenIndex,
): boolean {
    return (
        // section-access-expression
        // this.isOnTokenKind(TokenKind.Bang)
        // field-access-expression
        isTokenKind(state, Token.TokenKind.LeftBrace, tokenIndexStart) ||
        // item-access-expression
        isTokenKind(state, Token.TokenKind.LeftBracket, tokenIndexStart) ||
        // invoke-expression
        isTokenKind(state, Token.TokenKind.LeftParenthesis, tokenIndexStart)
    );
}

// -----------------------------
// ---------- Asserts ----------
// -----------------------------

export function assertGetContextNodeMetadata(state: ParseState): ContextNodeMetadata {
    const currentContextNode: ParseContext.TNode = Assert.asDefined(state.currentContextNode);
    const tokenStart: Token.Token = Assert.asDefined(currentContextNode.tokenStart);

    // inclusive token index
    const tokenIndexEnd: number = state.tokenIndex - 1;
    const tokenEnd: Token.Token = Assert.asDefined(state.lexerSnapshot.tokens[tokenIndexEnd]);

    const tokenRange: Token.TokenRange = {
        tokenIndexStart: currentContextNode.tokenIndexStart,
        tokenIndexEnd,
        positionStart: tokenStart.positionStart,
        positionEnd: tokenEnd.positionEnd,
    };

    return {
        id: currentContextNode.id,
        attributeIndex: currentContextNode.attributeIndex,
        tokenRange,
    };
}

export function assertGetTokenAt(state: ParseState, tokenIndex: number): Token.Token {
    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const token: Token.Token | undefined = lexerSnapshot.tokens[tokenIndex];

    return Assert.asDefined(token, undefined, { tokenIndex });
}

// -------------------------------
// ---------- Csv Tests ----------
// -------------------------------

// All of these tests assume you're in a given context and have just read a `,`.
// Eg. testCsvEndLetExpression assumes you're in a LetExpression context and have just read a `,`.

export function testCsvContinuationLetExpression(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.currentTokenKind === Token.TokenKind.KeywordIn) {
        return new ParseError.ExpectedCsvContinuationError(
            ParseError.CsvContinuationKind.LetExpression,
            currentTokenWithColumnNumber(state),
            state.locale,
        );
    }

    return undefined;
}

export function testCsvContinuationDanglingComma(
    state: ParseState,
    tokenKind: Token.TokenKind,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.currentTokenKind === tokenKind) {
        return new ParseError.ExpectedCsvContinuationError(
            ParseError.CsvContinuationKind.DanglingComma,
            currentTokenWithColumnNumber(state),
            state.locale,
        );
    } else {
        return undefined;
    }
}

// -------------------------------------
// ---------- Asserts / Tests ----------
// -------------------------------------

// This test is run after seeing no additional commas in a CsvArray,
// when a closing terminator is expected.
export function testClosingTokenKind(
    state: ParseState,
    expectedTokenKind: Token.TokenKind,
): ParseError.ExpectedClosingTokenKind | undefined {
    if (isOnTokenKind(state, expectedTokenKind)) {
        return undefined;
    }

    return new ParseError.ExpectedClosingTokenKind(
        expectedTokenKind,
        currentTokenWithColumnNumber(state),
        state.locale,
    );
}

export function testIsOnTokenKind(
    state: ParseState,
    expectedTokenKind: Token.TokenKind,
): ParseError.ExpectedTokenKindError | undefined {
    if (expectedTokenKind !== state.currentTokenKind) {
        const token: ParseError.TokenWithColumnNumber | undefined = currentTokenWithColumnNumber(state);

        return new ParseError.ExpectedTokenKindError(expectedTokenKind, token, state.locale);
    } else {
        return undefined;
    }
}

export function testIsOnAnyTokenKind(
    state: ParseState,
    expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
): ParseError.ExpectedAnyTokenKindError | undefined {
    const isError: boolean =
        state.currentTokenKind === undefined || !expectedAnyTokenKinds.includes(state.currentTokenKind);

    if (isError) {
        const token: ParseError.TokenWithColumnNumber | undefined = currentTokenWithColumnNumber(state);

        return new ParseError.ExpectedAnyTokenKindError(expectedAnyTokenKinds, token, state.locale);
    } else {
        return undefined;
    }
}

export function assertNoMoreTokens(state: ParseState): void {
    if (state.tokenIndex === state.lexerSnapshot.tokens.length) {
        return;
    }

    const token: Token.Token = assertGetTokenAt(state, state.tokenIndex);
    throw new ParseError.UnusedTokensRemainError(
        token,
        state.lexerSnapshot.graphemePositionStartFrom(token),
        state.locale,
    );
}

export function assertNoOpenContext(state: ParseState): void {
    Assert.isUndefined(state.currentContextNode, undefined, {
        contextNodeId: state.currentContextNode?.id,
    });
}

export function assertIsDoneParsing(state: ParseState): void {
    assertNoMoreTokens(state);
    assertNoOpenContext(state);
}

// -------------------------------------
// ---------- Error factories ----------
// -------------------------------------

export function unterminatedBracketError(state: ParseState): ParseError.UnterminatedSequence {
    return unterminatedSequence(state, SequenceKind.Bracket);
}

export function unterminatedParenthesesError(state: ParseState): ParseError.UnterminatedSequence {
    return unterminatedSequence(state, SequenceKind.Parenthesis);
}

function unterminatedSequence(state: ParseState, sequenceKind: SequenceKind): ParseError.UnterminatedSequence {
    const token: Token.Token = assertGetTokenAt(state, state.tokenIndex);

    return new ParseError.UnterminatedSequence(
        sequenceKind,
        token,
        state.lexerSnapshot.graphemePositionStartFrom(token),
        state.locale,
    );
}

// ---------------------------------------------
// ---------- Column number factories ----------
// ---------------------------------------------

export function currentTokenWithColumnNumber(state: ParseState): ParseError.TokenWithColumnNumber | undefined {
    return tokenWithColumnNumber(state, state.tokenIndex);
}

export function tokenWithColumnNumber(
    state: ParseState,
    tokenIndex: number,
): ParseError.TokenWithColumnNumber | undefined {
    const token: Token.Token | undefined = state.lexerSnapshot.tokens[tokenIndex];

    if (!token) {
        return undefined;
    }

    const currentToken: Token.Token = token;

    return {
        token: currentToken,
        columnNumber: state.lexerSnapshot.columnNumberStartFrom(currentToken),
    };
}

const enum ParseStateUtilsTraceConstant {
    ParseStateUtils = "ParseStateUtils",
}

interface ContextNodeMetadata {
    readonly id: number;
    readonly attributeIndex: number | undefined;
    readonly tokenRange: Token.TokenRange;
}
