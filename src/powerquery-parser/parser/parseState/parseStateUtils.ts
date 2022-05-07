// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, MapUtils } from "../../common";
import { Ast, Constant, Token } from "../../language";
import { ParseContext, ParseContextUtils, ParseError } from "..";
import { DefaultLocale } from "../../localization";
import { Disambiguation } from "../disambiguation";
import { LexerSnapshot } from "../../lexer";
import { NoOpTraceManager } from "../../common/trace";
import { ParseState } from "./parseState";
import { SequenceKind } from "../error";

export function createState(lexerSnapshot: LexerSnapshot, maybeOverrides: Partial<ParseState> | undefined): ParseState {
    const tokenIndex: number = maybeOverrides?.tokenIndex ?? 0;
    const maybeCurrentToken: Token.Token | undefined = lexerSnapshot.tokens[tokenIndex];
    const maybeCurrentTokenKind: Token.TokenKind | undefined = maybeCurrentToken?.kind;
    const contextState: ParseContext.State = maybeOverrides?.contextState ?? ParseContextUtils.createState();

    const maybeCurrentContextNodeId: number | undefined =
        contextState.nodeIdMapCollection.contextNodeById.size > 0
            ? Math.max(...contextState.nodeIdMapCollection.contextNodeById.keys())
            : undefined;

    const maybeCurrentContextNode: ParseContext.TNode | undefined =
        maybeCurrentContextNodeId !== undefined
            ? MapUtils.assertGet(contextState.nodeIdMapCollection.contextNodeById, maybeCurrentContextNodeId)
            : undefined;

    return {
        ...maybeOverrides,
        disambiguationBehavior:
            maybeOverrides?.disambiguationBehavior ?? Disambiguation.DismabiguationBehavior.Thorough,
        lexerSnapshot,
        locale: maybeOverrides?.locale ?? DefaultLocale,
        maybeCancellationToken: maybeOverrides?.maybeCancellationToken,
        traceManager: maybeOverrides?.traceManager ?? new NoOpTraceManager(),
        contextState: maybeOverrides?.contextState ?? ParseContextUtils.createState(),
        maybeCurrentToken,
        maybeCurrentContextNode,
        maybeCurrentTokenKind,
        tokenIndex,
    };
}

// If you have a custom parser + parser state, then you'll have to create your own copyState/applyState functions.
// eslint-disable-next-line require-await
export async function applyState(state: ParseState, update: ParseState): Promise<void> {
    state.tokenIndex = update.tokenIndex;
    state.maybeCurrentToken = update.maybeCurrentToken;
    state.maybeCurrentTokenKind = update.maybeCurrentTokenKind;
    state.contextState = update.contextState;
    state.maybeCurrentContextNode = update.maybeCurrentContextNode;
}

// If you have a custom parser + parser state, then you'll have to create your own copyState/applyState functions.
// eslint-disable-next-line require-await
export async function copyState(state: ParseState): Promise<ParseState> {
    return {
        ...state,
        contextState: ParseContextUtils.copyState(state.contextState),
    };
}

export function startContext<T extends Ast.TNode>(state: ParseState, nodeKind: T["kind"]): void {
    const newContextNode: ParseContext.Node<T> = ParseContextUtils.startContext(
        state.contextState,
        nodeKind,
        state.tokenIndex,
        state.maybeCurrentToken,
        state.maybeCurrentContextNode,
    );

    state.maybeCurrentContextNode = newContextNode;
}

export function endContext<T extends Ast.TNode>(state: ParseState, astNode: T): void {
    const contextNode: ParseContext.TNode = Assert.asDefined(
        state.maybeCurrentContextNode,
        `can't end a context if one doesn't exist`,
    );

    const maybeParentOfContextNode: ParseContext.TNode | undefined = ParseContextUtils.endContext(
        state.contextState,
        contextNode,
        astNode,
    );

    state.maybeCurrentContextNode = maybeParentOfContextNode;
}

export function deleteContext(state: ParseState, maybeNodeId: number | undefined): void {
    let nodeId: number;

    if (maybeNodeId === undefined) {
        nodeId = Assert.asDefined(state.maybeCurrentContextNode, `can't delete a context if one doesn't exist`).id;
    } else {
        nodeId = maybeNodeId;
    }

    state.maybeCurrentContextNode = ParseContextUtils.deleteContext(state.contextState, nodeId);
}

export function incrementAttributeCounter(state: ParseState): void {
    Assert.asDefined(state.maybeCurrentContextNode, `state.maybeCurrentContextNode`).attributeCounter += 1;
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
    const maybeTokenKind: Token.TokenKind | undefined = state.lexerSnapshot.tokens[tokenIndex]?.kind;

    if (maybeTokenKind === undefined) {
        return false;
    }

    switch (maybeTokenKind) {
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
    const currentContextNode: ParseContext.TNode = Assert.asDefined(state.maybeCurrentContextNode);
    const tokenStart: Token.Token = Assert.asDefined(currentContextNode.maybeTokenStart);

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
        maybeAttributeIndex: currentContextNode.maybeAttributeIndex,
        tokenRange,
    };
}

export function assertGetTokenAt(state: ParseState, tokenIndex: number): Token.Token {
    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const maybeToken: Token.Token | undefined = lexerSnapshot.tokens[tokenIndex];

    return Assert.asDefined(maybeToken, undefined, { tokenIndex });
}

// -------------------------------
// ---------- Csv Tests ----------
// -------------------------------

// All of these tests assume you're in a given context and have just read a `,`.
// Eg. testCsvEndLetExpression assumes you're in a LetExpression context and have just read a `,`.

export function testCsvContinuationLetExpression(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.maybeCurrentTokenKind === Token.TokenKind.KeywordIn) {
        return new ParseError.ExpectedCsvContinuationError(
            ParseError.CsvContinuationKind.LetExpression,
            maybeCurrentTokenWithColumnNumber(state),
            state.locale,
        );
    }

    return undefined;
}

export function testCsvContinuationDanglingComma(
    state: ParseState,
    tokenKind: Token.TokenKind,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.maybeCurrentTokenKind === tokenKind) {
        return new ParseError.ExpectedCsvContinuationError(
            ParseError.CsvContinuationKind.DanglingComma,
            maybeCurrentTokenWithColumnNumber(state),
            state.locale,
        );
    } else {
        return undefined;
    }
}

// -------------------------------------
// ---------- Asserts / Tests ----------
// -------------------------------------

export function testIsOnTokenKind(
    state: ParseState,
    expectedTokenKind: Token.TokenKind,
): ParseError.ExpectedTokenKindError | undefined {
    if (expectedTokenKind !== state.maybeCurrentTokenKind) {
        const maybeToken: ParseError.TokenWithColumnNumber | undefined = maybeCurrentTokenWithColumnNumber(state);

        return new ParseError.ExpectedTokenKindError(expectedTokenKind, maybeToken, state.locale);
    } else {
        return undefined;
    }
}

export function testIsOnAnyTokenKind(
    state: ParseState,
    expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
): ParseError.ExpectedAnyTokenKindError | undefined {
    const isError: boolean =
        state.maybeCurrentTokenKind === undefined || !expectedAnyTokenKinds.includes(state.maybeCurrentTokenKind);

    if (isError) {
        const maybeToken: ParseError.TokenWithColumnNumber | undefined = maybeCurrentTokenWithColumnNumber(state);

        return new ParseError.ExpectedAnyTokenKindError(expectedAnyTokenKinds, maybeToken, state.locale);
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
    Assert.isUndefined(state.maybeCurrentContextNode, undefined, {
        contextNodeId: state.maybeCurrentContextNode?.id,
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

export function maybeCurrentTokenWithColumnNumber(state: ParseState): ParseError.TokenWithColumnNumber | undefined {
    return maybeTokenWithColumnNumber(state, state.tokenIndex);
}

export function maybeTokenWithColumnNumber(
    state: ParseState,
    tokenIndex: number,
): ParseError.TokenWithColumnNumber | undefined {
    const maybeToken: Token.Token | undefined = state.lexerSnapshot.tokens[tokenIndex];

    if (maybeToken === undefined) {
        return undefined;
    }

    const currentToken: Token.Token = maybeToken;

    return {
        token: currentToken,
        columnNumber: state.lexerSnapshot.columnNumberStartFrom(currentToken),
    };
}

interface ContextNodeMetadata {
    readonly id: number;
    readonly maybeAttributeIndex: number | undefined;
    readonly tokenRange: Token.TokenRange;
}
