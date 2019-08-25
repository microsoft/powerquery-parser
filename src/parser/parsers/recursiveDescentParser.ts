// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, ParserContext, ParserError } from "..";
import { CommonError, isNever, Option, Result, ResultKind, TypeUtils } from "../../common";
import { LexerSnapshot, Token, TokenKind } from "../../lexer";
import {
    maybeReadIdentifierConstantAsConstant,
    readIdentifierConstantAsConstant,
    readToken,
    readTokenKind,
} from "./common";
import { BracketDisambiguation, IParser, ParenthesisDisambiguation } from "./IParser";
import {
    applyState,
    deepCopy,
    deleteContext,
    endContext,
    expectContextNodeMetadata,
    expectTokenAt,
    incrementAttributeCounter,
    IParserState,
    isNextTokenKind,
    isOnGeneralizedIdentifierToken,
    isOnIdentifierConstant,
    isOnTokenKind,
    isTokenKind,
    startContext,
    testIsOnAnyTokenKind,
    testIsOnTokenKind,
    unterminatedBracketError,
    unterminatedParenthesesError,
} from "./IParserState";

function notYetImplemented(_state: IParserState): any {
    throw new Error("NYI");
}

export const RecursiveDescentParser: IParser<IParserState> = {
    // 12.1.6 Identifiers
    readIdentifier,
    readGeneralizedIdentifier,
    readKeyword,

    // 12.2.1 Documents
    readDocument: notYetImplemented,

    // 12.2.2 Section Documents
    readSectionDocument: notYetImplemented,
    readSectionMembers: notYetImplemented,
    readSectionMember: notYetImplemented,

    // 12.2.3.1 Expressions
    readExpression: notYetImplemented,

    // 12.2.3.2 Logical expressions
    readLogicalExpression: notYetImplemented,

    // 12.2.3.3 Is expression
    readIsExpression: notYetImplemented,
    readNullablePrimitiveType: notYetImplemented,

    // 12.2.3.4 As expression
    readAsExpression: notYetImplemented,

    // 12.2.3.5 Equality expression
    readEqualityExpression: notYetImplemented,

    // 12.2.3.6 Relational expression
    readRelationalExpression: notYetImplemented,

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: notYetImplemented,

    // 12.2.3.8 Metadata expression
    readMetadataExpression: notYetImplemented,

    // 12.2.3.9 Unary expression
    readUnaryExpression: notYetImplemented,

    // 12.2.3.10 Primary expression
    readPrimaryExpression,
    readRecursivePrimaryExpression,

    // 12.2.3.11 Literal expression
    readLiteralExpression,

    // 12.2.3.12 Identifier expression
    readIdentifierExpression,

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression,

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression,

    // 12.2.3.16 Invoke expression
    readInvokeExpression,

    // 12.2.3.17 List expression
    readListExpression,
    readListItem,

    // 12.2.3.18 Record expression
    readRecordExpression,

    // 12.2.3.19 Item access expression
    readItemAccessExpression,

    // 12.2.3.20 Field access expression
    readFieldSelection,
    readFieldProjection,
    readFieldSelector,

    // 12.2.3.21 Function expression
    readFunctionExpression,
    readParameterList,
    readAsType,

    // 12.2.3.22 Each expression
    readEachExpression,

    // 12.2.3.23 Let expression
    readLetExpression,

    // 12.2.3.24 If expression
    readIfExpression,

    // 12.2.3.25 Type expression
    readTypeExpression,
    readType,
    readPrimaryType,
    readRecordType,
    readTableType,
    readFieldSpecificationList,
    readListType,
    readFunctionType,
    readParameterSpecificationList,
    readNullableType,

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression,

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression,

    // 12.2.4 Literal Attributes
    readRecordLiteral,
    readFieldNamePairedAnyLiterals,
    readListLiteral,
    readAnyLiteral,
    readPrimitiveType,

    // Disambiguation
    disambiguateBracket,
    disambiguateParenthesis,

    // key-value pairs
    readIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpression,
    readIdentifierPairedExpression,
};

type TriedReadPrimaryType = Result<
    Ast.TPrimaryType,
    ParserError.ExpectedAnyTokenKindError | ParserError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

type TriedReadPrimitiveType = Result<
    Ast.PrimitiveType,
    ParserError.ExpectedAnyTokenKindError | ParserError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

interface WrappedRead<Kind, Content> extends Ast.IWrapped<Kind, Content> {
    readonly maybeOptionalConstant: Option<Ast.Constant>;
}

function readIdentifier(state: IParserState): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    startContext(state, nodeKind);

    const literal: string = readTokenKind(state, TokenKind.Identifier);

    const astNode: Ast.Identifier = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    endContext(state, astNode);
    return astNode;
}

function readGeneralizedIdentifier(state: IParserState): Ast.GeneralizedIdentifier {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
    startContext(state, nodeKind);

    let literal: string;
    let astNode: Ast.GeneralizedIdentifier;

    // Edge case where GeneralizedIdentifier is only decmal numbers.
    // The logic should be more robust as it should technically support the following:
    // `1.a`
    // `෬` - non ASCII character from Unicode class Nd (U+0DEC SINHALA LITH DIGIT SIX)
    if (
        state.maybeCurrentToken !== undefined &&
        state.maybeCurrentToken.kind === TokenKind.NumericLiteral &&
        state.maybeCurrentToken.data.match("^\\d+$")
    ) {
        literal = readToken(state);
        astNode = {
            ...expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            literal,
        };
        endContext(state, astNode);
        return astNode;
    }

    const tokenRangeStartIndex: number = state.tokenIndex;
    let tokenRangeEndIndex: number = tokenRangeStartIndex;
    while (isOnGeneralizedIdentifierToken(state)) {
        readToken(state);
        tokenRangeEndIndex = state.tokenIndex;
    }

    if (tokenRangeStartIndex === tokenRangeEndIndex) {
        throw new CommonError.InvariantError(
            `readGeneralizedIdentifier has tokenRangeStartIndex === tokenRangeEndIndex`,
        );
    }

    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const tokens: ReadonlyArray<Token> = lexerSnapshot.tokens;
    const contiguousIdentifierStartIndex: number = tokens[tokenRangeStartIndex].positionStart.codeUnit;
    const contiguousIdentifierEndIndex: number = tokens[tokenRangeEndIndex - 1].positionEnd.codeUnit;
    literal = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);

    astNode = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    endContext(state, astNode);
    return astNode;
}

function readKeyword(state: IParserState): Ast.IdentifierExpression {
    const identifierExpressionNodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    startContext(state, identifierExpressionNodeKind);

    // Keywords can't have a "@" prefix constant
    incrementAttributeCounter(state);

    const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    startContext(state, identifierNodeKind);

    const literal: string = readToken(state);
    const identifier: Ast.Identifier = {
        ...expectContextNodeMetadata(state),
        kind: identifierNodeKind,
        isLeaf: true,
        literal,
    };
    endContext(state, identifier);

    const identifierExpression: Ast.IdentifierExpression = {
        ...expectContextNodeMetadata(state),
        kind: identifierExpressionNodeKind,
        isLeaf: false,
        maybeInclusiveConstant: undefined,
        identifier,
    };
    endContext(state, identifierExpression);
    return identifierExpression;
}

// ------------------------------------------
// ----------  // 12.2.1 Documents ----------
// ------------------------------------------

// ----------------------------------------------
// ---------- 12.2.2 Section Documents ----------
// ----------------------------------------------

// ------------------------------------------
// ---------- 12.2.3.1 Expressions ----------
// ------------------------------------------

// --------------------------------------------
// ---------- 12.2.3.3 Is expression ----------
// --------------------------------------------

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

// --------------------------------------------------
// ---------- 12.2.3.5 Equality expression ----------
// --------------------------------------------------

// ----------------------------------------------------
// ---------- 12.2.3.6 Relational expression ----------
// ---------------------------------------------=------

// -----------------------------------------------------
// ---------- 12.2.3.7 Arithmetic expressions ----------
// -----------------------------------------------------

// --------------------------------------------------
// ---------- 12.2.3.8 Metadata expression ----------
// --------------------------------------------------

// -----------------------------------------------
// ---------- 12.2.3.9 Unary expression ----------
// -----------------------------------------------

// --------------------------------------------------
// ---------- 12.2.3.10 Primary expression ----------
// --------------------------------------------------

function readPrimaryExpression(state: IParserState): Ast.TPrimaryExpression {
    let primaryExpression: Option<Ast.TPrimaryExpression>;
    const maybeCurrentTokenKind: Option<TokenKind> = state.maybeCurrentTokenKind;
    const isIdentifierExpressionNext: boolean =
        maybeCurrentTokenKind === TokenKind.AtSign || maybeCurrentTokenKind === TokenKind.Identifier;

    if (isIdentifierExpressionNext) {
        primaryExpression = RecursiveDescentParser.readIdentifierExpression(state);
    } else {
        switch (maybeCurrentTokenKind) {
            case TokenKind.LeftParenthesis:
                primaryExpression = RecursiveDescentParser.readParenthesizedExpression(state);
                break;

            case TokenKind.LeftBracket:
                const triedDisambiguation: Result<
                    BracketDisambiguation,
                    ParserError.UnterminatedBracketError
                > = RecursiveDescentParser.disambiguateBracket(state);
                if (triedDisambiguation.kind === ResultKind.Err) {
                    throw triedDisambiguation.error;
                }
                const disambiguation: BracketDisambiguation = triedDisambiguation.value;

                switch (disambiguation) {
                    case BracketDisambiguation.FieldProjection:
                        primaryExpression = RecursiveDescentParser.readFieldProjection(state);
                        break;

                    case BracketDisambiguation.FieldSelection:
                        primaryExpression = RecursiveDescentParser.readFieldSelection(state);
                        break;

                    case BracketDisambiguation.Record:
                        primaryExpression = RecursiveDescentParser.readRecordExpression(state);
                        break;

                    default:
                        throw isNever(disambiguation);
                }
                break;

            case TokenKind.LeftBrace:
                primaryExpression = RecursiveDescentParser.readListExpression(state);
                break;

            case TokenKind.Ellipsis:
                primaryExpression = RecursiveDescentParser.readNotImplementedExpression(state);
                break;

            case TokenKind.KeywordHashSections:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashShared:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashBinary:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashDate:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashDateTime:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashDateTimeZone:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashDuration:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashTable:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            case TokenKind.KeywordHashTime:
                primaryExpression = RecursiveDescentParser.readKeyword(state);
                break;

            default:
                primaryExpression = RecursiveDescentParser.readLiteralExpression(state);
        }
    }

    const isRecursivePrimaryExpression: boolean =
        // section-access-expression
        // this.isOnTokenKind(TokenKind.Bang)
        // field-access-expression
        isOnTokenKind(state, TokenKind.LeftBrace) ||
        // item-access-expression
        isOnTokenKind(state, TokenKind.LeftBracket) ||
        // invoke-expression
        isOnTokenKind(state, TokenKind.LeftParenthesis);
    if (isRecursivePrimaryExpression) {
        return RecursiveDescentParser.readRecursivePrimaryExpression(state, primaryExpression);
    } else {
        return primaryExpression;
    }
}

function readRecursivePrimaryExpression(
    state: IParserState,
    head: Ast.TPrimaryExpression,
): Ast.RecursivePrimaryExpression {
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
    startContext(state, nodeKind);

    // The head of the recursive primary expression is created before the recursive primrary expression,
    // meaning the parent/child mapping for contexts are in reverse order.
    // The clean up for that happens here.
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
    }
    const currentContextNode: ParserContext.Node = state.maybeCurrentContextNode;

    const maybeHeadParentId: Option<number> = nodeIdMapCollection.parentIdById.get(head.id);
    if (maybeHeadParentId === undefined) {
        const details: {} = { nodeId: head.id };
        throw new CommonError.InvariantError(`head's nodeId isn't in parentIdById`, details);
    }
    const headParentId: number = maybeHeadParentId;

    // Remove head as a child of its current parent.
    const parentChildIds: ReadonlyArray<number> = NodeIdMap.expectChildIds(
        nodeIdMapCollection.childIdsById,
        headParentId,
    );
    const replacementIndex: number = parentChildIds.indexOf(head.id);
    if (replacementIndex === -1) {
        const details: {} = {
            parentNodeId: headParentId,
            childNodeId: head.id,
        };
        throw new CommonError.InvariantError(`node isn't a child of parentNode`, details);
    }

    nodeIdMapCollection.childIdsById.set(headParentId, [
        ...parentChildIds.slice(0, replacementIndex),
        ...parentChildIds.slice(replacementIndex + 1),
    ]);

    // Update mappings for head.
    nodeIdMapCollection.astNodeById.set(head.id, head);
    nodeIdMapCollection.parentIdById.set(head.id, currentContextNode.id);

    // Mark head as a child of the recursive primary expression context (currentContextNode).
    nodeIdMapCollection.childIdsById.set(currentContextNode.id, [head.id]);

    // Update start positions for recursive primary expression context
    const recursiveTokenIndexStart: number = head.tokenRange.tokenIndexStart;
    const mutableContext: TypeUtils.StripReadonly<ParserContext.Node> = currentContextNode;
    // UNSAFE MARKER
    //
    // Purpose of code block:
    //      Shift the start of ParserContext from the default location (which doesn't include head),
    //      to the left so that head is also included.
    //
    // Why are you trying to avoid a safer approach?
    //      There isn't one? At least not without refactoring in ways which will make things messier.
    //
    // Why is it safe?
    //      I'm only mutating start location in the recursive expression to one already parsed , the head.
    mutableContext.maybeTokenStart = state.lexerSnapshot.tokens[recursiveTokenIndexStart];
    mutableContext.tokenIndexStart = recursiveTokenIndexStart;

    // Begin normal parsing behavior.
    const recursiveExpressions: Ast.TRecursivePrimaryExpression[] = [];
    const recursiveArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    startContext(state, recursiveArrayNodeKind);
    let continueReadingValues: boolean = true;

    while (continueReadingValues) {
        const maybeCurrentTokenKind: Option<TokenKind> = state.maybeCurrentTokenKind;

        if (maybeCurrentTokenKind === TokenKind.LeftParenthesis) {
            recursiveExpressions.push(RecursiveDescentParser.readInvokeExpression(state));
        } else if (maybeCurrentTokenKind === TokenKind.LeftBrace) {
            recursiveExpressions.push(RecursiveDescentParser.readItemAccessExpression(state));
        } else if (maybeCurrentTokenKind === TokenKind.LeftBracket) {
            const triedDisambiguation: Result<
                BracketDisambiguation,
                ParserError.UnterminatedBracketError
            > = RecursiveDescentParser.disambiguateBracket(state);
            if (triedDisambiguation.kind === ResultKind.Err) {
                throw triedDisambiguation.error;
            }
            const disambiguation: BracketDisambiguation = triedDisambiguation.value;

            switch (disambiguation) {
                case BracketDisambiguation.FieldProjection:
                    recursiveExpressions.push(RecursiveDescentParser.readFieldProjection(state));
                    break;

                case BracketDisambiguation.FieldSelection:
                    recursiveExpressions.push(RecursiveDescentParser.readFieldSelection(state));
                    break;

                default:
                    throw new CommonError.InvariantError(
                        `grammer doesn't allow remaining BracketDisambiguation: ${disambiguation}`,
                    );
            }
        } else {
            continueReadingValues = false;
        }
    }

    const recursiveArray: Ast.IArrayWrapper<Ast.TRecursivePrimaryExpression> = {
        ...expectContextNodeMetadata(state),
        kind: recursiveArrayNodeKind,
        isLeaf: false,
        elements: recursiveExpressions,
    };
    endContext(state, recursiveArray);

    const astNode: Ast.RecursivePrimaryExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        head,
        recursiveExpressions: recursiveArray,
    };
    endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------
// ---------- 12.2.3.11 Literal expression ----------
// --------------------------------------------------

function readLiteralExpression(state: IParserState): Ast.LiteralExpression {
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;
    startContext(state, nodeKind);

    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.HexLiteral,
        TokenKind.KeywordFalse,
        TokenKind.KeywordTrue,
        TokenKind.NumericLiteral,
        TokenKind.NullLiteral,
        TokenKind.StringLiteral,
    ];
    const maybeErr: Option<ParserError.ExpectedAnyTokenKindError> = testIsOnAnyTokenKind(state, expectedTokenKinds);
    if (maybeErr) {
        throw maybeErr;
    }

    const maybeLiteralKind: Option<Ast.LiteralKind> = Ast.literalKindFrom(state.maybeCurrentTokenKind);
    if (maybeLiteralKind === undefined) {
        throw new CommonError.InvariantError(
            `couldn't convert TokenKind=${state.maybeCurrentTokenKind} into LiteralKind`,
        );
    }

    const literal: string = readToken(state);
    const astNode: Ast.LiteralExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal: literal,
        literalKind: maybeLiteralKind,
    };
    endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------------------------
// ---------- 12.2.3.16 12.2.3.12 Identifier expression ----------
// ---------------------------------------------------------------

function readIdentifierExpression(state: IParserState): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    startContext(state, nodeKind);

    const maybeInclusiveConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.AtSign);
    const identifier: Ast.Identifier = RecursiveDescentParser.readIdentifier(state);

    const astNode: Ast.IdentifierExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeInclusiveConstant,
        identifier,
    };
    endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------------
// ---------- 12.2.3.14 Parenthesized expression ----------
// --------------------------------------------------------

function readParenthesizedExpression(state: IParserState): Ast.ParenthesizedExpression {
    return readWrapped<Ast.NodeKind.ParenthesizedExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.ParenthesizedExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftParenthesis),
        () => RecursiveDescentParser.readExpression(state),
        () => readTokenKindAsConstant(state, TokenKind.RightParenthesis),
        false,
    );
}

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

function readNotImplementedExpression(state: IParserState): Ast.NotImplementedExpression {
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;
    startContext(state, nodeKind);

    const ellipsisConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.Ellipsis);

    const astNode: Ast.NotImplementedExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ellipsisConstant,
    };
    endContext(state, astNode);
    return astNode;
}

// -------------------------------------------------
// ---------- 12.2.3.16 Invoke expression ----------
// -------------------------------------------------

function readInvokeExpression(state: IParserState): Ast.InvokeExpression {
    const continueReadingValues: boolean = !isNextTokenKind(state, TokenKind.RightParenthesis);
    return readWrapped<Ast.NodeKind.InvokeExpression, Ast.ICsvArray<Ast.TExpression>>(
        state,
        Ast.NodeKind.InvokeExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftParenthesis),
        () => readCsvArray(state, () => RecursiveDescentParser.readExpression(state), continueReadingValues),
        () => readTokenKindAsConstant(state, TokenKind.RightParenthesis),
        false,
    );
}

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

function readListExpression(state: IParserState): Ast.ListExpression {
    const continueReadingValues: boolean = !isNextTokenKind(state, TokenKind.RightBrace);
    return readWrapped<Ast.NodeKind.ListExpression, Ast.ICsvArray<Ast.TListItem>>(
        state,
        Ast.NodeKind.ListExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () => readCsvArray(state, () => RecursiveDescentParser.readListItem(state), continueReadingValues),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        false,
    );
}

function readListItem(state: IParserState): Ast.TListItem {
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;
    startContext(state, nodeKind);

    const left: Ast.TExpression = RecursiveDescentParser.readExpression(state);
    if (isOnTokenKind(state, TokenKind.DotDot)) {
        const rangeConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.DotDot);
        const right: Ast.TExpression = RecursiveDescentParser.readExpression(state);
        const astNode: Ast.RangeExpression = {
            ...expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            rangeConstant,
            right,
        };

        endContext(state, astNode);
        return astNode;
    } else {
        deleteContext(state, undefined);
        return left;
    }
}

// -----------------------------------------------------------
// ---------- 12.2.3.18 12.2.3.18 Record expression ----------
// -----------------------------------------------------------

function readRecordExpression(state: IParserState): Ast.RecordExpression {
    const continueReadingValues: boolean = !isNextTokenKind(state, TokenKind.RightBracket);
    return readWrapped<Ast.NodeKind.RecordExpression, Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>>(
        state,
        Ast.NodeKind.RecordExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () => RecursiveDescentParser.readGeneralizedIdentifierPairedExpressions(state, continueReadingValues),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        false,
    );
}

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

function readItemAccessExpression(state: IParserState): Ast.ItemAccessExpression {
    return readWrapped<Ast.NodeKind.ItemAccessExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.ItemAccessExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () => RecursiveDescentParser.readExpression(state),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        true,
    );
}

// -------------------------------------------------------
// ---------- 12.2.3.20 Field access expression ----------
// -------------------------------------------------------

function readFieldSelection(state: IParserState): Ast.FieldSelector {
    return readFieldSelector(state, true);
}

function readFieldProjection(state: IParserState): Ast.FieldProjection {
    return readWrapped<Ast.NodeKind.FieldProjection, Ast.ICsvArray<Ast.FieldSelector>>(
        state,
        Ast.NodeKind.FieldProjection,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () => readCsvArray(state, () => RecursiveDescentParser.readFieldSelector(state, false), true),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        true,
    );
}

function readFieldSelector(state: IParserState, allowOptional: boolean): Ast.FieldSelector {
    return readWrapped<Ast.NodeKind.FieldSelector, Ast.GeneralizedIdentifier>(
        state,
        Ast.NodeKind.FieldSelector,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () => RecursiveDescentParser.readGeneralizedIdentifier(state),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        allowOptional,
    );
}

// ---------------------------------------------------
// ---------- 12.2.3.21 Function expression ----------
// ---------------------------------------------------

function readFunctionExpression(state: IParserState): Ast.FunctionExpression {
    const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;
    startContext(state, nodeKind);

    const parameters: Ast.IParameterList<
        Option<Ast.AsNullablePrimitiveType>
    > = RecursiveDescentParser.readParameterList(state);
    const maybeFunctionReturnType: Option<Ast.AsNullablePrimitiveType> = maybeReadAsNullablePrimitiveType(state);
    const fatArrowConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.FatArrow);
    const expression: Ast.TExpression = RecursiveDescentParser.readExpression(state);

    const astNode: Ast.FunctionExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        parameters,
        maybeFunctionReturnType,
        fatArrowConstant,
        expression,
    };
    endContext(state, astNode);
    return astNode;
}

function readParameterList(state: IParserState): Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>> {
    return genericReadParameterList(state, () => maybeReadAsNullablePrimitiveType(state));
}

function maybeReadAsNullablePrimitiveType(state: IParserState): Option<Ast.AsNullablePrimitiveType> {
    return maybeReadPairedConstant<Ast.NodeKind.AsNullablePrimitiveType, Ast.TNullablePrimitiveType>(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => isOnTokenKind(state, TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs),
        () => RecursiveDescentParser.readNullablePrimitiveType(state),
    );
}

function readAsType(state: IParserState): Ast.AsType {
    return readPairedConstant<Ast.NodeKind.AsType, Ast.TType>(
        state,
        Ast.NodeKind.AsType,
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs),
        () => RecursiveDescentParser.readType(state),
    );
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

function readEachExpression(state: IParserState): Ast.EachExpression {
    return readPairedConstant<Ast.NodeKind.EachExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.EachExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordEach),
        () => RecursiveDescentParser.readExpression(state),
    );
}

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

function readLetExpression(state: IParserState): Ast.LetExpression {
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;
    startContext(state, nodeKind);

    const letConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordLet);
    const identifierExpressionPairedExpressions: Ast.ICsvArray<
        Ast.IdentifierPairedExpression
    > = RecursiveDescentParser.readIdentifierPairedExpressions(state, true);
    const inConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordIn);
    const expression: Ast.TExpression = RecursiveDescentParser.readExpression(state);

    const astNode: Ast.LetExpression = {
        ...expectContextNodeMetadata(state),
        kind: Ast.NodeKind.LetExpression,
        isLeaf: false,
        letConstant,
        variableList: identifierExpressionPairedExpressions,
        inConstant,
        expression,
    };
    endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------
// ---------- 12.2.3.24 If expression ----------
// ---------------------------------------------

function readIfExpression(state: IParserState): Ast.IfExpression {
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;
    startContext(state, nodeKind);

    const ifConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordIf);
    const condition: Ast.TExpression = RecursiveDescentParser.readExpression(state);

    const thenConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordThen);
    const trueExpression: Ast.TExpression = RecursiveDescentParser.readExpression(state);

    const elseConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordElse);
    const falseExpression: Ast.TExpression = RecursiveDescentParser.readExpression(state);

    const astNode: Ast.IfExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ifConstant,
        condition,
        thenConstant,
        trueExpression,
        elseConstant,
        falseExpression,
    };
    endContext(state, astNode);
    return astNode;
}

// -----------------------------------------------
// ---------- 12.2.3.25 Type expression ----------
// -----------------------------------------------

function readTypeExpression(state: IParserState): Ast.TTypeExpression {
    if (isOnTokenKind(state, TokenKind.KeywordType)) {
        return readPairedConstant<Ast.NodeKind.TypePrimaryType, Ast.TPrimaryType>(
            state,
            Ast.NodeKind.TypePrimaryType,
            () => readTokenKindAsConstant(state, TokenKind.KeywordType),
            () => RecursiveDescentParser.readPrimaryType(state),
        );
    } else {
        return RecursiveDescentParser.readPrimaryExpression(state);
    }
}

function readType(state: IParserState): Ast.TType {
    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state);

    if (triedReadPrimaryType.kind === ResultKind.Ok) {
        return triedReadPrimaryType.value;
    } else {
        return RecursiveDescentParser.readPrimaryExpression(state);
    }
}

function readPrimaryType(state: IParserState): Ast.TPrimaryType {
    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state);

    if (triedReadPrimaryType.kind === ResultKind.Ok) {
        return triedReadPrimaryType.value;
    } else {
        throw triedReadPrimaryType.error;
    }
}

function readRecordType(state: IParserState): Ast.RecordType {
    const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;
    startContext(state, nodeKind);

    const fields: Ast.FieldSpecificationList = RecursiveDescentParser.readFieldSpecificationList(state, true);

    const astNode: Ast.RecordType = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        fields,
    };
    endContext(state, astNode);
    return astNode;
}

function readTableType(state: IParserState): Ast.TableType {
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;
    startContext(state, nodeKind);

    const tableConstant: Ast.Constant = readIdentifierConstantAsConstant(state, Ast.IdentifierConstant.Table);
    const maybeCurrentTokenKind: Option<TokenKind> = state.maybeCurrentTokenKind;
    const isPrimaryExpressionExpected: boolean =
        maybeCurrentTokenKind === TokenKind.AtSign ||
        maybeCurrentTokenKind === TokenKind.Identifier ||
        maybeCurrentTokenKind === TokenKind.LeftParenthesis;

    let rowType: Ast.FieldSpecificationList | Ast.TPrimaryExpression;
    if (isPrimaryExpressionExpected) {
        rowType = RecursiveDescentParser.readPrimaryExpression(state);
    } else {
        rowType = RecursiveDescentParser.readFieldSpecificationList(state, false);
    }

    const astNode: Ast.TableType = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tableConstant,
        rowType,
    };
    endContext(state, astNode);
    return astNode;
}

function readFieldSpecificationList(state: IParserState, allowOpenMarker: boolean): Ast.FieldSpecificationList {
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;
    startContext(state, nodeKind);

    const leftBracketConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.LeftBracket);
    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = true;
    let maybeOpenRecordMarkerConstant: Option<Ast.Constant> = undefined;

    const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    startContext(state, fieldArrayNodeKind);

    while (continueReadingValues) {
        if (isOnTokenKind(state, TokenKind.Ellipsis)) {
            if (allowOpenMarker) {
                if (maybeOpenRecordMarkerConstant) {
                    throw fieldSpecificationListReadError(state, false);
                } else {
                    maybeOpenRecordMarkerConstant = readTokenKindAsConstant(state, TokenKind.Ellipsis);
                    continueReadingValues = false;
                }
            } else {
                throw fieldSpecificationListReadError(state, allowOpenMarker);
            }
        } else if (isOnGeneralizedIdentifierToken(state)) {
            const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
            startContext(state, csvNodeKind);

            const fieldSpecificationNodeKind: Ast.NodeKind.FieldSpecification = Ast.NodeKind.FieldSpecification;
            startContext(state, fieldSpecificationNodeKind);

            const maybeOptionalConstant: Option<Ast.Constant> = maybeReadIdentifierConstantAsConstant(
                state,
                Ast.IdentifierConstant.Optional,
            );

            const name: Ast.GeneralizedIdentifier = RecursiveDescentParser.readGeneralizedIdentifier(state);

            const maybeFieldTypeSpeification: Option<Ast.FieldTypeSpecification> = maybeReadFieldTypeSpecification(
                state,
            );

            const maybeCommaConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            const field: Ast.FieldSpecification = {
                ...expectContextNodeMetadata(state),
                kind: fieldSpecificationNodeKind,
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeFieldTypeSpeification,
            };
            endContext(state, field);

            const csv: Ast.ICsv<Ast.FieldSpecification> = {
                ...expectContextNodeMetadata(state),
                kind: csvNodeKind,
                isLeaf: false,
                node: field,
                maybeCommaConstant,
            };
            endContext(state, csv);
            fields.push(csv);
        } else {
            throw fieldSpecificationListReadError(state, allowOpenMarker);
        }
    }

    const fieldArray: Ast.ICsvArray<Ast.FieldSpecification> = {
        ...expectContextNodeMetadata(state),
        kind: fieldArrayNodeKind,
        elements: fields,
        isLeaf: false,
    };
    endContext(state, fieldArray);

    const rightBracketConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.RightBracket);

    const astNode: Ast.FieldSpecificationList = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftBracketConstant,
        content: fieldArray,
        maybeOpenRecordMarkerConstant,
        closeWrapperConstant: rightBracketConstant,
    };
    endContext(state, astNode);
    return astNode;
}

function maybeReadFieldTypeSpecification(state: IParserState): Option<Ast.FieldTypeSpecification> {
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;
    startContext(state, nodeKind);

    const maybeEqualConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Equal);
    if (maybeEqualConstant) {
        const fieldType: Ast.TType = RecursiveDescentParser.readType(state);

        const astNode: Ast.FieldTypeSpecification = {
            ...expectContextNodeMetadata(state),
            kind: Ast.NodeKind.FieldTypeSpecification,
            isLeaf: false,
            equalConstant: maybeEqualConstant,
            fieldType,
        };
        endContext(state, astNode);
        return astNode;
    } else {
        incrementAttributeCounter(state);
        deleteContext(state, undefined);
        return undefined;
    }
}

function fieldSpecificationListReadError(state: IParserState, allowOpenMarker: boolean): Option<Error> {
    if (allowOpenMarker) {
        const expectedTokenKinds: ReadonlyArray<TokenKind> = [TokenKind.Identifier, TokenKind.Ellipsis];
        return testIsOnAnyTokenKind(state, expectedTokenKinds);
    } else {
        return testIsOnTokenKind(state, TokenKind.Identifier);
    }
}

function readListType(state: IParserState): Ast.ListType {
    return readWrapped<Ast.NodeKind.ListType, Ast.TType>(
        state,
        Ast.NodeKind.ListType,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () => RecursiveDescentParser.readType(state),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        false,
    );
}

function readFunctionType(state: IParserState): Ast.FunctionType {
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
    startContext(state, nodeKind);

    const functionConstant: Ast.Constant = readIdentifierConstantAsConstant(state, Ast.IdentifierConstant.Function);
    const parameters: Ast.IParameterList<Ast.AsType> = RecursiveDescentParser.readParameterSpecificationList(state);
    const functionReturnType: Ast.AsType = RecursiveDescentParser.readAsType(state);

    const astNode: Ast.FunctionType = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        functionConstant,
        parameters,
        functionReturnType,
    };
    endContext(state, astNode);
    return astNode;
}

function tryReadPrimaryType(state: IParserState): TriedReadPrimaryType {
    const backup: IParserState = deepCopy(state);

    const isTableTypeNext: boolean =
        isOnIdentifierConstant(state, Ast.IdentifierConstant.Table) &&
        (isNextTokenKind(state, TokenKind.LeftBracket) ||
            isNextTokenKind(state, TokenKind.LeftParenthesis) ||
            isNextTokenKind(state, TokenKind.AtSign) ||
            isNextTokenKind(state, TokenKind.Identifier));
    const isFunctionTypeNext: boolean =
        isOnIdentifierConstant(state, Ast.IdentifierConstant.Function) &&
        isNextTokenKind(state, TokenKind.LeftParenthesis);

    if (isOnTokenKind(state, TokenKind.LeftBracket)) {
        return {
            kind: ResultKind.Ok,
            value: RecursiveDescentParser.readRecordType(state),
        };
    } else if (isOnTokenKind(state, TokenKind.LeftBrace)) {
        return {
            kind: ResultKind.Ok,
            value: RecursiveDescentParser.readListType(state),
        };
    } else if (isTableTypeNext) {
        return {
            kind: ResultKind.Ok,
            value: RecursiveDescentParser.readTableType(state),
        };
    } else if (isFunctionTypeNext) {
        return {
            kind: ResultKind.Ok,
            value: RecursiveDescentParser.readFunctionType(state),
        };
    } else if (isOnIdentifierConstant(state, Ast.IdentifierConstant.Nullable)) {
        return {
            kind: ResultKind.Ok,
            value: RecursiveDescentParser.readNullableType(state),
        };
    } else {
        const triedReadPrimitiveType: TriedReadPrimaryType = tryReadPrimitiveType(state);

        if (triedReadPrimitiveType.kind === ResultKind.Err) {
            applyState(state, backup);
        }
        return triedReadPrimitiveType;
    }
}

function readParameterSpecificationList(state: IParserState): Ast.IParameterList<Ast.AsType> {
    return genericReadParameterList(state, () => RecursiveDescentParser.readAsType(state));
}

function readNullableType(state: IParserState): Ast.NullableType {
    return readPairedConstant<Ast.NodeKind.NullableType, Ast.TType>(
        state,
        Ast.NodeKind.NullableType,
        () => readIdentifierConstantAsConstant(state, Ast.IdentifierConstant.Nullable),
        () => RecursiveDescentParser.readType(state),
    );
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

function readErrorRaisingExpression(state: IParserState): Ast.ErrorRaisingExpression {
    return readPairedConstant<Ast.NodeKind.ErrorRaisingExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordError),
        () => RecursiveDescentParser.readExpression(state),
    );
}

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

function readErrorHandlingExpression(state: IParserState): Ast.ErrorHandlingExpression {
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
    startContext(state, nodeKind);

    const tryConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordTry);
    const protectedExpression: Ast.TExpression = RecursiveDescentParser.readExpression(state);

    const otherwiseExpressionNodeKind: Ast.NodeKind.OtherwiseExpression = Ast.NodeKind.OtherwiseExpression;
    const maybeOtherwiseExpression: Option<Ast.OtherwiseExpression> = maybeReadPairedConstant<
        Ast.NodeKind.OtherwiseExpression,
        Ast.TExpression
    >(
        state,
        otherwiseExpressionNodeKind,
        () => isOnTokenKind(state, TokenKind.KeywordOtherwise),
        () => readTokenKindAsConstant(state, TokenKind.KeywordOtherwise),
        () => RecursiveDescentParser.readExpression(state),
    );

    const astNode: Ast.ErrorHandlingExpression = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tryConstant,
        protectedExpression,
        maybeOtherwiseExpression,
    };
    endContext(state, astNode);
    return astNode;
}

// -----------------------------------------------
// ---------- 12.2.4 Literal Attributes ----------
// -----------------------------------------------

function readRecordLiteral(state: IParserState): Ast.RecordLiteral {
    const continueReadingValues: boolean = !isNextTokenKind(state, TokenKind.RightBracket);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.RecordLiteral,
        Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>
    > = readWrapped<Ast.NodeKind.RecordLiteral, Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>>(
        state,
        Ast.NodeKind.RecordLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () => RecursiveDescentParser.readFieldNamePairedAnyLiterals(state, continueReadingValues),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.Record,
        ...wrappedRead,
    };
}

function readFieldNamePairedAnyLiterals(
    state: IParserState,
    continueReadingValues: boolean,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> {
    return readCsvArray(
        state,
        () =>
            readKeyValuePair<
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                Ast.GeneralizedIdentifier,
                Ast.TAnyLiteral
            >(
                state,
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                () => RecursiveDescentParser.readGeneralizedIdentifier(state),
                () => RecursiveDescentParser.readAnyLiteral(state),
            ),
        continueReadingValues,
    );
}

function readListLiteral(state: IParserState): Ast.ListLiteral {
    const continueReadingValues: boolean = !isNextTokenKind(state, TokenKind.RightBrace);
    const wrappedRead: Ast.IWrapped<Ast.NodeKind.ListLiteral, Ast.ICsvArray<Ast.TAnyLiteral>> = readWrapped<
        Ast.NodeKind.ListLiteral,
        Ast.ICsvArray<Ast.TAnyLiteral>
    >(
        state,
        Ast.NodeKind.ListLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () => readCsvArray(state, () => RecursiveDescentParser.readAnyLiteral(state), continueReadingValues),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.List,
        ...wrappedRead,
    };
}

function readAnyLiteral(state: IParserState): Ast.TAnyLiteral {
    if (isOnTokenKind(state, TokenKind.LeftBracket)) {
        return RecursiveDescentParser.readRecordLiteral(state);
    } else if (isOnTokenKind(state, TokenKind.LeftBrace)) {
        return RecursiveDescentParser.readListLiteral(state);
    } else {
        return RecursiveDescentParser.readLiteralExpression(state);
    }
}

function readPrimitiveType(state: IParserState): Ast.PrimitiveType {
    const triedReadPrimitiveType: TriedReadPrimitiveType = tryReadPrimitiveType(state);
    if (triedReadPrimitiveType.kind === ResultKind.Ok) {
        return triedReadPrimitiveType.value;
    } else {
        throw triedReadPrimitiveType.error;
    }
}

function tryReadPrimitiveType(state: IParserState): TriedReadPrimitiveType {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
    startContext(state, nodeKind);

    const backup: IParserState = deepCopy(state);
    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.Identifier,
        TokenKind.KeywordType,
        TokenKind.NullLiteral,
    ];
    const maybeErr: Option<ParserError.ExpectedAnyTokenKindError> = testIsOnAnyTokenKind(state, expectedTokenKinds);
    if (maybeErr) {
        const error: ParserError.ExpectedAnyTokenKindError = maybeErr;
        return {
            kind: ResultKind.Err,
            error,
        };
    }

    let primitiveType: Ast.Constant;
    if (isOnTokenKind(state, TokenKind.Identifier)) {
        const currentTokenData: string = state.lexerSnapshot.tokens[state.tokenIndex].data;
        switch (currentTokenData) {
            case Ast.IdentifierConstant.Action:
            case Ast.IdentifierConstant.Any:
            case Ast.IdentifierConstant.AnyNonNull:
            case Ast.IdentifierConstant.Binary:
            case Ast.IdentifierConstant.Date:
            case Ast.IdentifierConstant.DateTime:
            case Ast.IdentifierConstant.DateTimeZone:
            case Ast.IdentifierConstant.Duration:
            case Ast.IdentifierConstant.Function:
            case Ast.IdentifierConstant.List:
            case Ast.IdentifierConstant.Logical:
            case Ast.IdentifierConstant.None:
            case Ast.IdentifierConstant.Number:
            case Ast.IdentifierConstant.Record:
            case Ast.IdentifierConstant.Table:
            case Ast.IdentifierConstant.Text:
            case Ast.IdentifierConstant.Time:
                primitiveType = readIdentifierConstantAsConstant(state, currentTokenData);
                break;

            default:
                const token: Token = expectTokenAt(state, state.tokenIndex);
                applyState(state, backup);
                return {
                    kind: ResultKind.Err,
                    error: new ParserError.InvalidPrimitiveTypeError(
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                    ),
                };
        }
    } else if (isOnTokenKind(state, TokenKind.KeywordType)) {
        primitiveType = readTokenKindAsConstant(state, TokenKind.KeywordType);
    } else if (isOnTokenKind(state, TokenKind.NullLiteral)) {
        primitiveType = readTokenKindAsConstant(state, TokenKind.NullLiteral);
    } else {
        const details: {} = { tokenKind: state.maybeCurrentTokenKind };
        applyState(state, backup);
        return {
            kind: ResultKind.Err,
            error: new CommonError.InvariantError(
                `unknown currentTokenKind, not found in [${expectedTokenKinds}]`,
                details,
            ),
        };
    }

    const astNode: Ast.PrimitiveType = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        primitiveType,
    };
    endContext(state, astNode);
    return {
        kind: ResultKind.Ok,
        value: astNode,
    };
}

// ------------------------------------
// ---------- Disambiguation ----------
// ------------------------------------

function disambiguateParenthesis(
    state: IParserState,
): Result<ParenthesisDisambiguation, ParserError.UnterminatedParenthesesError> {
    const initialTokenIndex: number = state.tokenIndex;
    const tokens: ReadonlyArray<Token> = state.lexerSnapshot.tokens;
    const totalTokens: number = tokens.length;
    let nestedDepth: number = 1;
    let offsetTokenIndex: number = initialTokenIndex + 1;

    while (offsetTokenIndex < totalTokens) {
        const offsetTokenKind: TokenKind = tokens[offsetTokenIndex].kind;

        if (offsetTokenKind === TokenKind.LeftParenthesis) {
            nestedDepth += 1;
        } else if (offsetTokenKind === TokenKind.RightParenthesis) {
            nestedDepth -= 1;
        }

        if (nestedDepth === 0) {
            // (as X) could either be either case,
            // so we need to consume type X and see if it's followed by a FatArrow.
            //
            // It's important we backup and eventually restore the original Parser state.
            if (isTokenKind(state, TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                const stateBackup: IParserState = deepCopy(state);
                unsafeMoveTo(state, offsetTokenIndex + 2);

                try {
                    RecursiveDescentParser.readNullablePrimitiveType(state);
                } catch {
                    applyState(state, stateBackup);
                    if (isOnTokenKind(state, TokenKind.FatArrow)) {
                        return {
                            kind: ResultKind.Ok,
                            value: ParenthesisDisambiguation.FunctionExpression,
                        };
                    } else {
                        return {
                            kind: ResultKind.Ok,
                            value: ParenthesisDisambiguation.ParenthesizedExpression,
                        };
                    }
                }

                let disambiguation: ParenthesisDisambiguation;
                if (isOnTokenKind(state, TokenKind.FatArrow)) {
                    disambiguation = ParenthesisDisambiguation.FunctionExpression;
                } else {
                    disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
                }

                applyState(state, stateBackup);
                return {
                    kind: ResultKind.Ok,
                    value: disambiguation,
                };
            } else {
                if (isTokenKind(state, TokenKind.FatArrow, offsetTokenIndex + 1)) {
                    return {
                        kind: ResultKind.Ok,
                        value: ParenthesisDisambiguation.FunctionExpression,
                    };
                } else {
                    return {
                        kind: ResultKind.Ok,
                        value: ParenthesisDisambiguation.ParenthesizedExpression,
                    };
                }
            }
        }

        offsetTokenIndex += 1;
    }

    return {
        kind: ResultKind.Err,
        error: unterminatedParenthesesError(state),
    };
}

// WARNING: Only updates tokenIndex and currentTokenKind,
//          Manual management of TokenRangeStack is assumed.
//          Best used in conjunction with backup/restore using ParserState.
function unsafeMoveTo(state: IParserState, tokenIndex: number): void {
    const tokens: ReadonlyArray<Token> = state.lexerSnapshot.tokens;
    state.tokenIndex = tokenIndex;

    if (tokenIndex < tokens.length) {
        state.maybeCurrentToken = tokens[tokenIndex];
        state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
    } else {
        state.maybeCurrentToken = undefined;
        state.maybeCurrentTokenKind = undefined;
    }
}

function disambiguateBracket(state: IParserState): Result<BracketDisambiguation, ParserError.UnterminatedBracketError> {
    const tokens: ReadonlyArray<Token> = state.lexerSnapshot.tokens;
    let offsetTokenIndex: number = state.tokenIndex + 1;
    const offsetToken: Token = tokens[offsetTokenIndex];

    if (!offsetToken) {
        return {
            kind: ResultKind.Err,
            error: unterminatedBracketError(state),
        };
    }

    let offsetTokenKind: TokenKind = offsetToken.kind;
    if (offsetTokenKind === TokenKind.LeftBracket) {
        return {
            kind: ResultKind.Ok,
            value: BracketDisambiguation.FieldProjection,
        };
    } else if (offsetTokenKind === TokenKind.RightBracket) {
        return {
            kind: ResultKind.Ok,
            value: BracketDisambiguation.Record,
        };
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;
        while (offsetTokenIndex < totalTokens) {
            offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === TokenKind.Equal) {
                return {
                    kind: ResultKind.Ok,
                    value: BracketDisambiguation.Record,
                };
            } else if (offsetTokenKind === TokenKind.RightBracket) {
                return {
                    kind: ResultKind.Ok,
                    value: BracketDisambiguation.FieldProjection,
                };
            }

            offsetTokenIndex += 1;
        }

        return {
            kind: ResultKind.Err,
            error: unterminatedBracketError(state),
        };
    }
}

// -------------------------------------
// ---------- key-value pairs ----------
// -------------------------------------

function readIdentifierPairedExpressions(
    state: IParserState,
    continueReadingValues: boolean,
): Ast.ICsvArray<Ast.IdentifierPairedExpression> {
    return readCsvArray(
        state,
        () => RecursiveDescentParser.readIdentifierPairedExpression(state),
        continueReadingValues,
    );
}

function readGeneralizedIdentifierPairedExpressions(
    state: IParserState,
    continueReadingValues: boolean,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> {
    return readCsvArray(
        state,
        () => RecursiveDescentParser.readGeneralizedIdentifierPairedExpression(state),
        continueReadingValues,
    );
}

function readGeneralizedIdentifierPairedExpression(state: IParserState): Ast.GeneralizedIdentifierPairedExpression {
    return readKeyValuePair<
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.GeneralizedIdentifier,
        Ast.TExpression
    >(
        state,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        () => RecursiveDescentParser.readGeneralizedIdentifier(state),
        () => RecursiveDescentParser.readExpression(state),
    );
}

function readIdentifierPairedExpression(state: IParserState): Ast.IdentifierPairedExpression {
    return readKeyValuePair<Ast.NodeKind.IdentifierPairedExpression, Ast.Identifier, Ast.TExpression>(
        state,
        Ast.NodeKind.IdentifierPairedExpression,
        () => RecursiveDescentParser.readIdentifier(state),
        () => RecursiveDescentParser.readExpression(state),
    );
}

// ---------------------------------------------------------------
// ---------- Helper functions (generic read functions) ----------
// ---------------------------------------------------------------

function readCsvArray<T>(
    state: IParserState,
    valueReader: () => T & Ast.TCsvType,
    continueReadingValues: boolean,
): Ast.TCsvArray & Ast.ICsvArray<T & Ast.TCsvType> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    startContext(state, nodeKind);

    const elements: Ast.ICsv<T & Ast.TCsvType>[] = [];

    while (continueReadingValues) {
        const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
        startContext(state, csvNodeKind);

        const node: T & Ast.TCsvType = valueReader();
        const maybeCommaConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Comma);
        continueReadingValues = maybeCommaConstant !== undefined;

        const element: Ast.TCsv & Ast.ICsv<T & Ast.TCsvType> = {
            ...expectContextNodeMetadata(state),
            kind: csvNodeKind,
            isLeaf: false,
            node,
            maybeCommaConstant,
        };
        elements.push(element);
        endContext(state, element);
    }

    const astNode: Ast.ICsvArray<T & Ast.TCsvType> = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements,
    };
    endContext(state, astNode);
    return astNode;
}

function readKeyValuePair<Kind, Key, Value>(
    state: IParserState,
    nodeKind: Kind & Ast.TKeyValuePairNodeKind,
    keyReader: () => Key,
    valueReader: () => Value,
): Ast.IKeyValuePair<Kind, Key, Value> {
    startContext(state, nodeKind);

    const key: Key = keyReader();
    const equalConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.Equal);
    const value: Value = valueReader();

    const keyValuePair: Ast.IKeyValuePair<Kind, Key, Value> = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        key,
        equalConstant,
        value,
    };
    endContext(state, (keyValuePair as unknown) as Ast.TKeyValuePair);
    return keyValuePair;
}

function readPairedConstant<Kind, Paired>(
    state: IParserState,
    nodeKind: Kind & Ast.TPairedConstantNodeKind,
    constantReader: () => Ast.Constant,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, Paired> {
    startContext(state, nodeKind);

    const constant: Ast.Constant = constantReader();
    const paired: Paired = pairedReader();

    const pairedConstant: Ast.IPairedConstant<Kind, Paired> = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        constant,
        paired,
    };

    endContext(state, (pairedConstant as unknown) as Ast.TPairedConstant);

    return pairedConstant;
}

function maybeReadPairedConstant<Kind, Paired>(
    state: IParserState,
    nodeKind: Kind & Ast.TPairedConstantNodeKind,
    condition: () => boolean,
    constantReader: () => Ast.Constant,
    pairedReader: () => Paired,
): Option<Ast.IPairedConstant<Kind, Paired>> {
    if (condition()) {
        return readPairedConstant<Kind, Paired>(state, nodeKind, constantReader, pairedReader);
    } else {
        incrementAttributeCounter(state);
        return undefined;
    }
}

function genericReadParameterList<T>(
    state: IParserState,
    typeReader: () => T & Ast.TParameterType,
): Ast.IParameterList<T> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;
    startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.LeftParenthesis);
    let continueReadingValues: boolean = !isOnTokenKind(state, TokenKind.RightParenthesis);
    let reachedOptionalParameter: boolean = false;

    const paramaterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    startContext(state, paramaterArrayNodeKind);

    const parameters: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>>[] = [];
    while (continueReadingValues) {
        startContext(state, Ast.NodeKind.Csv);
        startContext(state, Ast.NodeKind.Parameter);

        const maybeOptionalConstant: Option<Ast.Constant> = maybeReadIdentifierConstantAsConstant(
            state,
            Ast.IdentifierConstant.Optional,
        );

        if (reachedOptionalParameter && !maybeOptionalConstant) {
            const token: Token = expectTokenAt(state, state.tokenIndex);
            throw new ParserError.RequiredParameterAfterOptionalParameterError(
                token,
                state.lexerSnapshot.graphemePositionStartFrom(token),
            );
        } else if (maybeOptionalConstant) {
            reachedOptionalParameter = true;
        }

        const name: Ast.Identifier = RecursiveDescentParser.readIdentifier(state);
        const maybeParameterType: T & Ast.TParameterType = typeReader();

        const parameter: Ast.IParameter<T & Ast.TParameterType> = {
            ...expectContextNodeMetadata(state),
            kind: Ast.NodeKind.Parameter,
            isLeaf: false,
            maybeOptionalConstant,
            name,
            maybeParameterType,
        };
        endContext(state, parameter);

        const maybeCommaConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Comma);
        continueReadingValues = maybeCommaConstant !== undefined;

        const csv: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>> = {
            ...expectContextNodeMetadata(state),
            kind: Ast.NodeKind.Csv,
            isLeaf: false,
            node: parameter,
            maybeCommaConstant,
        };
        endContext(state, csv);

        parameters.push(csv);
    }

    const parameterArray: Ast.ICsvArray<Ast.IParameter<T & Ast.TParameterType>> = {
        ...expectContextNodeMetadata(state),
        kind: paramaterArrayNodeKind,
        elements: parameters,
        isLeaf: false,
    };
    endContext(state, parameterArray);

    const rightParenthesisConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.RightParenthesis);

    const astNode: Ast.IParameterList<T & Ast.TParameterType> = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftParenthesisConstant,
        content: parameterArray,
        closeWrapperConstant: rightParenthesisConstant,
    };
    endContext(state, astNode);
    return astNode;
}

function readWrapped<Kind, Content>(
    state: IParserState,
    nodeKind: Kind & Ast.TWrappedNodeKind,
    openConstantReader: () => Ast.Constant,
    contentReader: () => Content,
    closeConstantReader: () => Ast.Constant,
    allowOptionalConstant: boolean,
): WrappedRead<Kind, Content> {
    startContext(state, nodeKind);

    const openWrapperConstant: Ast.Constant = openConstantReader();
    const content: Content = contentReader();
    const closeWrapperConstant: Ast.Constant = closeConstantReader();

    let maybeOptionalConstant: Option<Ast.Constant>;
    if (allowOptionalConstant) {
        maybeOptionalConstant = maybeReadTokenKindAsConstant(state, TokenKind.QuestionMark);
    }

    const wrapped: WrappedRead<Kind, Content> = {
        ...expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant,
        content,
        closeWrapperConstant,
        maybeOptionalConstant,
    };
    endContext(state, (wrapped as unknown) as Ast.TWrapped);
    return wrapped;
}

// -------------------------------------------------------
// ---------- Helper functions (read functions) ----------
// -------------------------------------------------------

function readTokenKindAsConstant(state: IParserState, tokenKind: TokenKind): Ast.Constant {
    const maybeConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, tokenKind);
    if (maybeConstant === undefined) {
        const maybeErr: Option<ParserError.ExpectedTokenKindError> = testIsOnTokenKind(state, tokenKind);
        if (maybeErr) {
            throw maybeErr;
        } else {
            const details: {} = {
                expectedTokenKind: tokenKind,
                actualTokenKind: state.maybeCurrentTokenKind,
            };

            throw new CommonError.InvariantError(
                `failures from ${maybeReadTokenKindAsConstant.name} should be reportable by ${testIsOnTokenKind.name}`,
                details,
            );
        }
    }

    return maybeConstant;
}

function maybeReadTokenKindAsConstant(state: IParserState, tokenKind: TokenKind): Option<Ast.Constant> {
    if (isOnTokenKind(state, tokenKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        startContext(state, nodeKind);

        const literal: string = readToken(state);
        const astNode: Ast.Constant = {
            ...expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            literal,
        };
        endContext(state, astNode);

        return astNode;
    } else {
        incrementAttributeCounter(state);
        return undefined;
    }
}
