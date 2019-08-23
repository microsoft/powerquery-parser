// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, ParserContext, ParserError } from "..";
import { CommonError, Option } from "../../common";
import { LexerSnapshot, Token, TokenKind } from "../../lexer";

export interface IParserState {
    readonly lexerSnapshot: LexerSnapshot;
    tokenIndex: number;
    maybeCurrentToken: Option<Token>;
    maybeCurrentTokenKind: Option<TokenKind>;
    contextState: ParserContext.State;
    maybeCurrentContextNode: Option<ParserContext.Node>;
}

export function deepCopy(state: IParserState): IParserState {
    return {
        lexerSnapshot: state.lexerSnapshot,
        tokenIndex: state.tokenIndex,
        maybeCurrentToken: state.maybeCurrentToken,
        maybeCurrentTokenKind: state.maybeCurrentTokenKind,
        contextState: ParserContext.deepCopy(state.contextState),
        maybeCurrentContextNode:
            state.maybeCurrentContextNode !== undefined ? { ...state.maybeCurrentContextNode } : undefined,
    };
}

export function applyState(originalState: IParserState, newState: IParserState): void {
    originalState.tokenIndex = newState.tokenIndex;
    originalState.maybeCurrentToken = newState.maybeCurrentToken;
    originalState.maybeCurrentTokenKind = newState.maybeCurrentTokenKind;

    originalState.contextState = newState.contextState;
    originalState.maybeCurrentContextNode = newState.maybeCurrentContextNode;
}

export function startContext(state: IParserState, nodeKind: Ast.NodeKind): void {
    const newContextNode: ParserContext.Node = ParserContext.startContext(
        state.contextState,
        nodeKind,
        state.tokenIndex,
        state.maybeCurrentToken,
        state.maybeCurrentContextNode,
    );
    state.maybeCurrentContextNode = newContextNode;
}

export function endContext(state: IParserState, astNode: Ast.TNode): void {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(
            "maybeContextNode should be truthy, can't end a context if it doesn't exist.",
        );
    }

    const maybeParentOfContextNode: Option<ParserContext.Node> = ParserContext.endContext(
        state.contextState,
        state.maybeCurrentContextNode,
        astNode,
    );
    state.maybeCurrentContextNode = maybeParentOfContextNode;
}

export function incrementAttributeCounter(state: IParserState): void {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
    }
    const currentContextNode: ParserContext.Node = state.maybeCurrentContextNode;
    currentContextNode.attributeCounter += 1;
}

export function isTokenKind(state: IParserState, tokenKind: TokenKind, tokenIndex: number): boolean {
    const maybeToken: Option<Token> = state.lexerSnapshot.tokens[tokenIndex];

    if (maybeToken) {
        return maybeToken.kind === tokenKind;
    } else {
        return false;
    }
}

export function isNextTokenKind(state: IParserState, tokenKind: TokenKind): boolean {
    return isTokenKind(state, tokenKind, state.tokenIndex + 1);
}

export function isOnTokenKind(
    state: IParserState,
    tokenKind: TokenKind,
    tokenIndex: number = state.tokenIndex,
): boolean {
    return isTokenKind(state, tokenKind, tokenIndex);
}

export function isOnIdentifierConstant(state: IParserState, identifierConstant: Ast.IdentifierConstant): boolean {
    if (isOnTokenKind(state, TokenKind.Identifier)) {
        const currentToken: Token = state.lexerSnapshot.tokens[state.tokenIndex];
        if (currentToken === undefined || currentToken.data === undefined) {
            const details: {} = { currentToken };
            throw new CommonError.InvariantError(`expected data on Token`, details);
        }

        const data: string = currentToken.data;
        return data === identifierConstant;
    } else {
        return false;
    }
}

export function expectContextNodeMetadata(state: IParserState): ContextNodeMetadata {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError("maybeCurrentContextNode should be truthy");
    }
    const currentContextNode: ParserContext.Node = state.maybeCurrentContextNode;

    const maybeTokenStart: Option<Token> = currentContextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        throw new CommonError.InvariantError(`maybeTokenStart should be truthy`);
    }
    const tokenStart: Token = maybeTokenStart;

    // inclusive token index
    const tokenIndexEnd: number = state.tokenIndex - 1;
    const maybeTokenEnd: Option<Token> = state.lexerSnapshot.tokens[tokenIndexEnd];
    if (maybeTokenEnd === undefined) {
        throw new CommonError.InvariantError(`maybeTokenEnd should be truthy`);
    }
    const tokenEnd: Token = maybeTokenEnd;

    const tokenRange: Ast.TokenRange = {
        tokenIndexStart: currentContextNode.tokenIndexStart,
        tokenIndexEnd,
        positionStart: tokenStart.positionStart,
        positionEnd: tokenEnd.positionEnd,
    };

    const contextNode: ParserContext.Node = state.maybeCurrentContextNode;
    return {
        id: contextNode.id,
        maybeAttributeIndex: currentContextNode.maybeAttributeIndex,
        tokenRange,
    };
}

export function expectTokenAt(state: IParserState, tokenIndex: number): Token {
    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const maybeToken: Option<Token> = lexerSnapshot.tokens[tokenIndex];

    if (maybeToken) {
        return maybeToken;
    } else {
        throw new CommonError.InvariantError(`this.tokens[${tokenIndex}] is falsey`);
    }
}

export function testIsOnTokenKind(
    state: IParserState,
    expectedTokenKind: TokenKind,
): Option<ParserError.ExpectedTokenKindError> {
    if (expectedTokenKind !== state.maybeCurrentTokenKind) {
        const maybeTokenWithColumnNumber: Option<ParserError.TokenWithColumnNumber> =
            state.maybeCurrentToken !== undefined
                ? {
                      token: state.maybeCurrentToken,
                      columnNumber: state.lexerSnapshot.columnNumberStartFrom(state.maybeCurrentToken),
                  }
                : undefined;
        return new ParserError.ExpectedTokenKindError(expectedTokenKind, maybeTokenWithColumnNumber);
    } else {
        return undefined;
    }
}

export function testIsOnAnyTokenKind(
    state: IParserState,
    expectedAnyTokenKind: ReadonlyArray<TokenKind>,
): Option<ParserError.ExpectedAnyTokenKindError> {
    const isError: boolean =
        state.maybeCurrentTokenKind === undefined || expectedAnyTokenKind.indexOf(state.maybeCurrentTokenKind) === -1;

    if (isError) {
        const maybeTokenWithColumnNumber: Option<ParserError.TokenWithColumnNumber> =
            state.maybeCurrentToken !== undefined
                ? {
                      token: state.maybeCurrentToken,
                      columnNumber: state.lexerSnapshot.columnNumberStartFrom(state.maybeCurrentToken),
                  }
                : undefined;
        return new ParserError.ExpectedAnyTokenKindError(expectedAnyTokenKind, maybeTokenWithColumnNumber);
    } else {
        return undefined;
    }
}

interface ContextNodeMetadata {
    readonly id: number;
    readonly maybeAttributeIndex: Option<number>;
    readonly tokenRange: Ast.TokenRange;
}
