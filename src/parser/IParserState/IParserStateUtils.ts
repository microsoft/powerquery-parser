// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext, ParseContextUtils, ParseError } from "..";
import { Assert, CommonError, ICancellationToken } from "../../common";
import { Ast, Constant, Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { SequenceKind } from "../error";
import { IParserState } from "./IParserState";

export interface FastStateBackup {
    readonly tokenIndex: number;
    readonly contextStateIdCounter: number;
    readonly maybeContextNodeId: number | undefined;
}

// ---------------------------
// ---------- State ----------
// ---------------------------

// If you have a custom parser + parser state, then you'll have to create your own factory function.
// See `benchmark.ts` for an example.
export function stateFactory(
    maybeCancellationToken: ICancellationToken | undefined,
    lexerSnapshot: LexerSnapshot,
    tokenIndex: number,
    locale: string,
): IParserState {
    const maybeCurrentToken: Token.Token | undefined = lexerSnapshot.tokens[tokenIndex];

    return {
        maybeCancellationToken,
        lexerSnapshot,
        locale,
        tokenIndex,
        maybeCurrentToken,
        maybeCurrentTokenKind: maybeCurrentToken?.kind,
        contextState: ParseContextUtils.stateFactory(),
        maybeCurrentContextNode: undefined,
    };
}

export function startContext(state: IParserState, nodeKind: Ast.NodeKind): void {
    const newContextNode: ParseContext.Node = ParseContextUtils.startContext(
        state.contextState,
        nodeKind,
        state.tokenIndex,
        state.maybeCurrentToken,
        state.maybeCurrentContextNode,
    );
    state.maybeCurrentContextNode = newContextNode;
}

export function endContext(state: IParserState, astNode: Ast.TNode): void {
    const contextNode: ParseContext.Node = Assert.asDefined(
        state.maybeCurrentContextNode,
        `can't end a context if one doesn't exist`,
    );

    const maybeParentOfContextNode: ParseContext.Node | undefined = ParseContextUtils.endContext(
        state.contextState,
        contextNode,
        astNode,
    );
    state.maybeCurrentContextNode = maybeParentOfContextNode;
}

export function deleteContext(state: IParserState, maybeNodeId: number | undefined): void {
    let nodeId: number;
    if (maybeNodeId === undefined) {
        nodeId = Assert.asDefined(state.maybeCurrentContextNode, `can't delete a context if one doesn't exist`).id;
    } else {
        nodeId = maybeNodeId;
    }

    state.maybeCurrentContextNode = ParseContextUtils.deleteContext(state.contextState, nodeId);
}

export function incrementAttributeCounter(state: IParserState): void {
    Assert.asDefined(state.maybeCurrentContextNode, `state.maybeCurrentContextNode`).attributeCounter += 1;
}

// -------------------------
// ---------- IsX ----------
// -------------------------

export function isTokenKind(state: IParserState, tokenKind: Token.TokenKind, tokenIndex: number): boolean {
    return state.lexerSnapshot.tokens[tokenIndex]?.kind === tokenKind ?? false;
}

export function isNextTokenKind(state: IParserState, tokenKind: Token.TokenKind): boolean {
    return isTokenKind(state, tokenKind, state.tokenIndex + 1);
}

export function isOnTokenKind(
    state: IParserState,
    tokenKind: Token.TokenKind,
    tokenIndex: number = state.tokenIndex,
): boolean {
    return isTokenKind(state, tokenKind, tokenIndex);
}

export function isOnConstantKind(state: IParserState, constantKind: Constant.TConstantKind): boolean {
    if (isOnTokenKind(state, Token.TokenKind.Identifier)) {
        const currentToken: Token.Token = state.lexerSnapshot.tokens[state.tokenIndex];
        if (currentToken?.data === undefined) {
            const details: {} = { currentToken };
            throw new CommonError.InvariantError(`expected data on Token`, details);
        }

        const data: string = currentToken.data;
        return data === constantKind;
    } else {
        return false;
    }
}

export function isOnGeneralizedIdentifierStart(state: IParserState, tokenIndex: number = state.tokenIndex): boolean {
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
    state: IParserState,
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

export function assertGetContextNodeMetadata(state: IParserState): ContextNodeMetadata {
    const currentContextNode: ParseContext.Node = Assert.asDefined(state.maybeCurrentContextNode);
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

export function assertGetTokenAt(state: IParserState, tokenIndex: number): Token.Token {
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
    state: IParserState,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.maybeCurrentTokenKind === Token.TokenKind.KeywordIn) {
        return new ParseError.ExpectedCsvContinuationError(
            state.locale,
            ParseError.CsvContinuationKind.LetExpression,
            maybeCurrentTokenWithColumnNumber(state),
        );
    }

    return undefined;
}

export function testCsvContinuationDanglingComma(
    state: IParserState,
    tokenKind: Token.TokenKind,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.maybeCurrentTokenKind === tokenKind) {
        return new ParseError.ExpectedCsvContinuationError(
            state.locale,
            ParseError.CsvContinuationKind.DanglingComma,
            maybeCurrentTokenWithColumnNumber(state),
        );
    } else {
        return undefined;
    }
}

// -------------------------------------
// ---------- Asserts / Tests ----------
// -------------------------------------

export function testIsOnTokenKind(
    state: IParserState,
    expectedTokenKind: Token.TokenKind,
): ParseError.ExpectedTokenKindError | undefined {
    if (expectedTokenKind !== state.maybeCurrentTokenKind) {
        const maybeToken: ParseError.TokenWithColumnNumber | undefined = maybeCurrentTokenWithColumnNumber(state);
        return new ParseError.ExpectedTokenKindError(state.locale, expectedTokenKind, maybeToken);
    } else {
        return undefined;
    }
}

export function testIsOnAnyTokenKind(
    state: IParserState,
    expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
): ParseError.ExpectedAnyTokenKindError | undefined {
    const isError: boolean =
        state.maybeCurrentTokenKind === undefined || expectedAnyTokenKinds.indexOf(state.maybeCurrentTokenKind) === -1;

    if (isError) {
        const maybeToken: ParseError.TokenWithColumnNumber | undefined = maybeCurrentTokenWithColumnNumber(state);
        return new ParseError.ExpectedAnyTokenKindError(state.locale, expectedAnyTokenKinds, maybeToken);
    } else {
        return undefined;
    }
}

export function assertNoMoreTokens(state: IParserState): void {
    if (state.tokenIndex === state.lexerSnapshot.tokens.length) {
        return;
    }

    const token: Token.Token = assertGetTokenAt(state, state.tokenIndex);
    throw new ParseError.UnusedTokensRemainError(
        state.locale,
        token,
        state.lexerSnapshot.graphemePositionStartFrom(token),
    );
}

export function assertNoOpenContext(state: IParserState): void {
    Assert.isUndefined(state.maybeCurrentContextNode, undefined, {
        contextNodeId: state.maybeCurrentContextNode?.id,
    });
}

// -------------------------------------
// ---------- Error factories ----------
// -------------------------------------

export function unterminatedBracketError(state: IParserState): ParseError.UnterminatedSequence {
    return unterminatedSequence(state, SequenceKind.Bracket);
}

export function unterminatedParenthesesError(state: IParserState): ParseError.UnterminatedSequence {
    return unterminatedSequence(state, SequenceKind.Parenthesis);
}

function unterminatedSequence(state: IParserState, sequenceKind: SequenceKind): ParseError.UnterminatedSequence {
    const token: Token.Token = assertGetTokenAt(state, state.tokenIndex);
    return new ParseError.UnterminatedSequence(
        state.locale,
        sequenceKind,
        token,
        state.lexerSnapshot.graphemePositionStartFrom(token),
    );
}

// ---------------------------------------------
// ---------- Column number factories ----------
// ---------------------------------------------

export function maybeCurrentTokenWithColumnNumber(state: IParserState): ParseError.TokenWithColumnNumber | undefined {
    return maybeTokenWithColumnNumber(state, state.tokenIndex);
}

export function maybeTokenWithColumnNumber(
    state: IParserState,
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
