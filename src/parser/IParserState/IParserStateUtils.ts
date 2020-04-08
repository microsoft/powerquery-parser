// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, ParseContext, ParseContextUtils, ParseError } from "..";
import { CommonError } from "../../common";
import { LexerSnapshot, Token, TokenKind, TokenRange } from "../../lexer";
import { ParseSettings } from "../../settings";
import { NodeIdMapUtils } from "../nodeIdMap";
import { IParserState } from "./IParserState";

export interface FastStateBackup {
    readonly tokenIndex: number;
    readonly contextStateIdCounter: number;
    readonly maybeContextNodeId: number | undefined;
}

// ---------------------------
// ---------- State ----------
// ---------------------------

// If you have a custom parser + parser state, then you'll have to create your own newState function.
// See `benchmark.ts` for an example.
export function newState<S = IParserState>(
    settings: ParseSettings<S & IParserState>,
    lexerSnapshot: LexerSnapshot,
): IParserState {
    const maybeCurrentToken: Token | undefined = lexerSnapshot.tokens[0];

    return {
        localizationTemplates: settings.localizationTemplates,
        lexerSnapshot,
        tokenIndex: 0,
        maybeCurrentToken,
        maybeCurrentTokenKind: maybeCurrentToken !== undefined ? maybeCurrentToken.kind : undefined,
        contextState: ParseContextUtils.newState(),
        maybeCurrentContextNode: undefined,
    };
}

export function applyState(originalState: IParserState, otherState: IParserState): void {
    originalState.tokenIndex = otherState.tokenIndex;
    originalState.maybeCurrentToken = otherState.maybeCurrentToken;
    originalState.maybeCurrentTokenKind = otherState.maybeCurrentTokenKind;

    originalState.contextState = otherState.contextState;
    originalState.maybeCurrentContextNode = otherState.maybeCurrentContextNode;
}

// Due to performance reasons the backup no longer can include a naive deep copy of the context state.
// Instead it's assumed that a backup is made immediately before a try/catch read block.
// This means the state begins in a parsing context and the backup will either be immediately consumed or dropped.
// Therefore we only care about the delta between before and after the try/catch block.
// Thanks to the invariants above and the fact the ids for nodes are an auto-incrementing integer
// we can easily just drop all delete all context nodes past the id of when the backup was created.
export function fastStateBackup(state: IParserState): FastStateBackup {
    return {
        tokenIndex: state.tokenIndex,
        contextStateIdCounter: state.contextState.idCounter,
        maybeContextNodeId: state.maybeCurrentContextNode !== undefined ? state.maybeCurrentContextNode.id : undefined,
    };
}

// See state.fastSnapshot for more information.
export function applyFastStateBackup(state: IParserState, backup: FastStateBackup): void {
    state.tokenIndex = backup.tokenIndex;
    state.maybeCurrentToken = state.lexerSnapshot.tokens[state.tokenIndex];
    state.maybeCurrentTokenKind = state.maybeCurrentToken !== undefined ? state.maybeCurrentToken.kind : undefined;

    const contextState: ParseContext.State = state.contextState;
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const backupIdCounter: number = backup.contextStateIdCounter;
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

    for (const nodeId of newAstNodeIds.sort().reverse()) {
        const maybeParent: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);
        const parentWillBeDeleted: boolean = maybeParent !== undefined && maybeParent >= backupIdCounter;
        ParseContextUtils.deleteAst(state.contextState, nodeId, parentWillBeDeleted);
    }
    for (const nodeId of newContextNodeIds.sort().reverse()) {
        ParseContextUtils.deleteContext(state.contextState, nodeId);
    }

    if (backup.maybeContextNodeId) {
        state.maybeCurrentContextNode = NodeIdMapUtils.expectContextNode(
            state.contextState.nodeIdMapCollection.contextNodeById,
            backup.maybeContextNodeId,
        );
    } else {
        state.maybeCurrentContextNode = undefined;
    }
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
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(
            "maybeContextNode should be truthy, can't end a context if it doesn't exist.",
        );
    }

    const maybeParentOfContextNode: ParseContext.Node | undefined = ParseContextUtils.endContext(
        state.contextState,
        state.maybeCurrentContextNode,
        astNode,
    );
    state.maybeCurrentContextNode = maybeParentOfContextNode;
}

export function deleteContext(state: IParserState, maybeNodeId: number | undefined): void {
    let nodeId: number;
    if (maybeNodeId === undefined) {
        if (state.maybeCurrentContextNode === undefined) {
            throw new CommonError.InvariantError(
                "maybeContextNode should be truthy, can't delete a context if it doesn't exist.",
            );
        } else {
            const currentContextNode: ParseContext.Node = state.maybeCurrentContextNode;
            nodeId = currentContextNode.id;
        }
    } else {
        nodeId = maybeNodeId;
    }

    state.maybeCurrentContextNode = ParseContextUtils.deleteContext(state.contextState, nodeId);
}

export function incrementAttributeCounter(state: IParserState): void {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
    }
    const currentContextNode: ParseContext.Node = state.maybeCurrentContextNode;
    currentContextNode.attributeCounter += 1;
}

// -------------------------
// ---------- IsX ----------
// -------------------------

export function isTokenKind(state: IParserState, tokenKind: TokenKind, tokenIndex: number): boolean {
    const maybeToken: Token | undefined = state.lexerSnapshot.tokens[tokenIndex];

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

export function isOnConstantKind(state: IParserState, constantKind: Ast.TConstantKind): boolean {
    if (isOnTokenKind(state, TokenKind.Identifier)) {
        const currentToken: Token = state.lexerSnapshot.tokens[state.tokenIndex];
        if (currentToken === undefined || currentToken.data === undefined) {
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
    const maybeToken: Token | undefined = state.lexerSnapshot.tokens[tokenIndex];
    if (maybeToken === undefined) {
        return false;
    }
    const tokenKind: TokenKind = maybeToken.kind;

    switch (tokenKind) {
        case TokenKind.Identifier:
        case TokenKind.KeywordAnd:
        case TokenKind.KeywordAs:
        case TokenKind.KeywordEach:
        case TokenKind.KeywordElse:
        case TokenKind.KeywordError:
        case TokenKind.KeywordFalse:
        case TokenKind.KeywordHashBinary:
        case TokenKind.KeywordHashDate:
        case TokenKind.KeywordHashDateTime:
        case TokenKind.KeywordHashDateTimeZone:
        case TokenKind.KeywordHashDuration:
        case TokenKind.KeywordHashInfinity:
        case TokenKind.KeywordHashNan:
        case TokenKind.KeywordHashSections:
        case TokenKind.KeywordHashShared:
        case TokenKind.KeywordHashTable:
        case TokenKind.KeywordHashTime:
        case TokenKind.KeywordIf:
        case TokenKind.KeywordIn:
        case TokenKind.KeywordIs:
        case TokenKind.KeywordLet:
        case TokenKind.KeywordMeta:
        case TokenKind.KeywordNot:
        case TokenKind.KeywordOr:
        case TokenKind.KeywordOtherwise:
        case TokenKind.KeywordSection:
        case TokenKind.KeywordShared:
        case TokenKind.KeywordThen:
        case TokenKind.KeywordTrue:
        case TokenKind.KeywordTry:
        case TokenKind.KeywordType:
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
        isTokenKind(state, TokenKind.LeftBrace, tokenIndexStart) ||
        // item-access-expression
        isTokenKind(state, TokenKind.LeftBracket, tokenIndexStart) ||
        // invoke-expression
        isTokenKind(state, TokenKind.LeftParenthesis, tokenIndexStart)
    );
}

// -----------------------------
// ---------- Expects ----------
// -----------------------------

export function expectContextNodeMetadata(state: IParserState): ContextNodeMetadata {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError("maybeCurrentContextNode should be truthy");
    }
    const currentContextNode: ParseContext.Node = state.maybeCurrentContextNode;

    const maybeTokenStart: Token | undefined = currentContextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        throw new CommonError.InvariantError(`maybeTokenStart should be truthy`);
    }
    const tokenStart: Token = maybeTokenStart;

    // inclusive token index
    const tokenIndexEnd: number = state.tokenIndex - 1;
    const maybeTokenEnd: Token | undefined = state.lexerSnapshot.tokens[tokenIndexEnd];
    if (maybeTokenEnd === undefined) {
        throw new CommonError.InvariantError(`maybeTokenEnd should be truthy`);
    }
    const tokenEnd: Token = maybeTokenEnd;

    const tokenRange: TokenRange = {
        tokenIndexStart: currentContextNode.tokenIndexStart,
        tokenIndexEnd,
        positionStart: tokenStart.positionStart,
        positionEnd: tokenEnd.positionEnd,
    };

    const contextNode: ParseContext.Node = state.maybeCurrentContextNode;
    return {
        id: contextNode.id,
        maybeAttributeIndex: currentContextNode.maybeAttributeIndex,
        tokenRange,
    };
}

export function expectTokenAt(state: IParserState, tokenIndex: number): Token {
    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const maybeToken: Token | undefined = lexerSnapshot.tokens[tokenIndex];

    if (maybeToken) {
        return maybeToken;
    } else {
        throw new CommonError.InvariantError(`this.tokens[${tokenIndex}] is falsey`);
    }
}

// -------------------------------
// ---------- Csv Tests ----------
// -------------------------------

// All of these tests assume you're in a given context and have just read a `,`.
// Eg. testCsvEndLetExpression assumes you're in a LetExpression context and have just read a `,`.

export function testCsvContinuationLetExpression(
    state: IParserState,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.maybeCurrentTokenKind === TokenKind.KeywordIn) {
        return new ParseError.ExpectedCsvContinuationError(
            state.localizationTemplates,
            ParseError.CsvContinuationKind.LetExpression,
            maybeCurrentTokenWithColumnNumber(state),
        );
    }

    return undefined;
}

export function testCsvContinuationDanglingComma(
    state: IParserState,
    tokenKind: TokenKind,
): ParseError.ExpectedCsvContinuationError | undefined {
    if (state.maybeCurrentTokenKind === tokenKind) {
        return new ParseError.ExpectedCsvContinuationError(
            state.localizationTemplates,
            ParseError.CsvContinuationKind.DanglingComma,
            maybeCurrentTokenWithColumnNumber(state),
        );
    } else {
        return undefined;
    }
}

// ---------------------------
// ---------- Tests ----------
// ---------------------------

export function testIsOnTokenKind(
    state: IParserState,
    expectedTokenKind: TokenKind,
): ParseError.ExpectedTokenKindError | undefined {
    if (expectedTokenKind !== state.maybeCurrentTokenKind) {
        const maybeToken: ParseError.TokenWithColumnNumber | undefined = maybeCurrentTokenWithColumnNumber(state);
        return new ParseError.ExpectedTokenKindError(state.localizationTemplates, expectedTokenKind, maybeToken);
    } else {
        return undefined;
    }
}

export function testIsOnAnyTokenKind(
    state: IParserState,
    expectedAnyTokenKinds: ReadonlyArray<TokenKind>,
): ParseError.ExpectedAnyTokenKindError | undefined {
    const isError: boolean =
        state.maybeCurrentTokenKind === undefined || expectedAnyTokenKinds.indexOf(state.maybeCurrentTokenKind) === -1;

    if (isError) {
        const maybeToken: ParseError.TokenWithColumnNumber | undefined = maybeCurrentTokenWithColumnNumber(state);
        return new ParseError.ExpectedAnyTokenKindError(state.localizationTemplates, expectedAnyTokenKinds, maybeToken);
    } else {
        return undefined;
    }
}

export function testNoMoreTokens(state: IParserState): ParseError.UnusedTokensRemainError | undefined {
    if (state.tokenIndex !== state.lexerSnapshot.tokens.length) {
        const token: Token = expectTokenAt(state, state.tokenIndex);
        return new ParseError.UnusedTokensRemainError(
            state.localizationTemplates,
            token,
            state.lexerSnapshot.graphemePositionStartFrom(token),
        );
    } else {
        return undefined;
    }
}

// -------------------------------------
// ---------- Error factories ----------
// -------------------------------------

export function unterminatedParenthesesError(state: IParserState): ParseError.UnterminatedParenthesesError {
    const token: Token = expectTokenAt(state, state.tokenIndex);
    return new ParseError.UnterminatedParenthesesError(
        state.localizationTemplates,
        token,
        state.lexerSnapshot.graphemePositionStartFrom(token),
    );
}

export function unterminatedBracketError(state: IParserState): ParseError.UnterminatedBracketError {
    const token: Token = expectTokenAt(state, state.tokenIndex);
    return new ParseError.UnterminatedBracketError(
        state.localizationTemplates,
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
    const maybeToken: Token | undefined = state.lexerSnapshot.tokens[tokenIndex];
    if (maybeToken === undefined) {
        return undefined;
    }
    const currentToken: Token = maybeToken;

    return {
        token: currentToken,
        columnNumber: state.lexerSnapshot.columnNumberStartFrom(currentToken),
    };
}

interface ContextNodeMetadata {
    readonly id: number;
    readonly maybeAttributeIndex: number | undefined;
    readonly tokenRange: TokenRange;
}
