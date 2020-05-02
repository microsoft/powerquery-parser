// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, ParseContext, ParseContextUtils, ParseError } from "..";
import { Language } from "../..";
import { CommonError } from "../../common";
import { Ast } from "../../language";
import { LexerSnapshot } from "../../lexer";
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
export function newState<S extends IParserState = IParserState>(
    settings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
): IParserState {
    const maybeCurrentToken: Language.Token | undefined = lexerSnapshot.tokens[0];

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
            `maybeContextNode should be truthy, can't end a context if it doesn't exist.`,
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
                `maybeContextNode should be truthy, can't delete a context if it doesn't exist.`,
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

export function isTokenKind(state: IParserState, tokenKind: Language.TokenKind, tokenIndex: number): boolean {
    const maybeToken: Language.Token | undefined = state.lexerSnapshot.tokens[tokenIndex];

    if (maybeToken) {
        return maybeToken.kind === tokenKind;
    } else {
        return false;
    }
}

export function isNextTokenKind(state: IParserState, tokenKind: Language.TokenKind): boolean {
    return isTokenKind(state, tokenKind, state.tokenIndex + 1);
}

export function isOnTokenKind(
    state: IParserState,
    tokenKind: Language.TokenKind,
    tokenIndex: number = state.tokenIndex,
): boolean {
    return isTokenKind(state, tokenKind, tokenIndex);
}

export function isOnConstantKind(state: IParserState, constantKind: Ast.TConstantKind): boolean {
    if (isOnTokenKind(state, Language.TokenKind.Identifier)) {
        const currentToken: Language.Token = state.lexerSnapshot.tokens[state.tokenIndex];
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
    const maybeToken: Language.Token | undefined = state.lexerSnapshot.tokens[tokenIndex];
    if (maybeToken === undefined) {
        return false;
    }
    const tokenKind: Language.TokenKind = maybeToken.kind;

    switch (tokenKind) {
        case Language.TokenKind.Identifier:
        case Language.TokenKind.KeywordAnd:
        case Language.TokenKind.KeywordAs:
        case Language.TokenKind.KeywordEach:
        case Language.TokenKind.KeywordElse:
        case Language.TokenKind.KeywordError:
        case Language.TokenKind.KeywordFalse:
        case Language.TokenKind.KeywordHashBinary:
        case Language.TokenKind.KeywordHashDate:
        case Language.TokenKind.KeywordHashDateTime:
        case Language.TokenKind.KeywordHashDateTimeZone:
        case Language.TokenKind.KeywordHashDuration:
        case Language.TokenKind.KeywordHashInfinity:
        case Language.TokenKind.KeywordHashNan:
        case Language.TokenKind.KeywordHashSections:
        case Language.TokenKind.KeywordHashShared:
        case Language.TokenKind.KeywordHashTable:
        case Language.TokenKind.KeywordHashTime:
        case Language.TokenKind.KeywordIf:
        case Language.TokenKind.KeywordIn:
        case Language.TokenKind.KeywordIs:
        case Language.TokenKind.KeywordLet:
        case Language.TokenKind.KeywordMeta:
        case Language.TokenKind.KeywordNot:
        case Language.TokenKind.KeywordOr:
        case Language.TokenKind.KeywordOtherwise:
        case Language.TokenKind.KeywordSection:
        case Language.TokenKind.KeywordShared:
        case Language.TokenKind.KeywordThen:
        case Language.TokenKind.KeywordTrue:
        case Language.TokenKind.KeywordTry:
        case Language.TokenKind.KeywordType:
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
        isTokenKind(state, Language.TokenKind.LeftBrace, tokenIndexStart) ||
        // item-access-expression
        isTokenKind(state, Language.TokenKind.LeftBracket, tokenIndexStart) ||
        // invoke-expression
        isTokenKind(state, Language.TokenKind.LeftParenthesis, tokenIndexStart)
    );
}

// -----------------------------
// ---------- Expects ----------
// -----------------------------

export function expectContextNodeMetadata(state: IParserState): ContextNodeMetadata {
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
    }
    const currentContextNode: ParseContext.Node = state.maybeCurrentContextNode;

    const maybeTokenStart: Language.Token | undefined = currentContextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        throw new CommonError.InvariantError(`maybeTokenStart should be truthy`);
    }
    const tokenStart: Language.Token = maybeTokenStart;

    // inclusive token index
    const tokenIndexEnd: number = state.tokenIndex - 1;
    const maybeTokenEnd: Language.Token | undefined = state.lexerSnapshot.tokens[tokenIndexEnd];
    if (maybeTokenEnd === undefined) {
        throw new CommonError.InvariantError(`maybeTokenEnd should be truthy`);
    }
    const tokenEnd: Language.Token = maybeTokenEnd;

    const tokenRange: Language.TokenRange = {
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

export function expectTokenAt(state: IParserState, tokenIndex: number): Language.Token {
    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const maybeToken: Language.Token | undefined = lexerSnapshot.tokens[tokenIndex];

    if (maybeToken) {
        return maybeToken;
    } else {
        throw new CommonError.InvariantError(`${expectTokenAt.name}: this.tokens[${tokenIndex}] is falsey`);
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
    if (state.maybeCurrentTokenKind === Language.TokenKind.KeywordIn) {
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
    tokenKind: Language.TokenKind,
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
    expectedTokenKind: Language.TokenKind,
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
    expectedAnyTokenKinds: ReadonlyArray<Language.TokenKind>,
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
        const token: Language.Token = expectTokenAt(state, state.tokenIndex);
        return new ParseError.UnusedTokensRemainError(
            state.localizationTemplates,
            token,
            state.lexerSnapshot.graphemePositionStartFrom(token),
        );
    } else {
        return undefined;
    }
}

export function testNoOpenContext(state: IParserState): CommonError.InvariantError | undefined {
    if (state.maybeCurrentContextNode !== undefined) {
        const details: {} = { maybeContextNode: state.maybeCurrentContextNode };
        return new CommonError.InvariantError(
            "maybeContextNode should be falsey, there shouldn't be an open context",
            details,
        );
    } else {
        return undefined;
    }
}

// -------------------------------------
// ---------- Error factories ----------
// -------------------------------------

export function unterminatedParenthesesError(state: IParserState): ParseError.UnterminatedParenthesesError {
    const token: Language.Token = expectTokenAt(state, state.tokenIndex);
    return new ParseError.UnterminatedParenthesesError(
        state.localizationTemplates,
        token,
        state.lexerSnapshot.graphemePositionStartFrom(token),
    );
}

export function unterminatedBracketError(state: IParserState): ParseError.UnterminatedBracketError {
    const token: Language.Token = expectTokenAt(state, state.tokenIndex);
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
    const maybeToken: Language.Token | undefined = state.lexerSnapshot.tokens[tokenIndex];
    if (maybeToken === undefined) {
        return undefined;
    }
    const currentToken: Language.Token = maybeToken;

    return {
        token: currentToken,
        columnNumber: state.lexerSnapshot.columnNumberStartFrom(currentToken),
    };
}

interface ContextNodeMetadata {
    readonly id: number;
    readonly maybeAttributeIndex: number | undefined;
    readonly tokenRange: Language.TokenRange;
}
