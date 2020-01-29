// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, ParseError, ParserContext } from "..";
import { CommonError, isNever, Option, Result, ResultUtils, TypeUtils } from "../../common";
import { LexerSnapshot, Token, TokenKind } from "../../lexer";
import { BracketDisambiguation, IParser, ParenthesisDisambiguation, TriedParse } from "../IParser";
import { IParserState } from "../IParserState";
import * as IParserStateUtils from "../IParserState/IParserStateUtils";
import { maybeReadTokenKindAsConstant, readBracketDisambiguation, readToken, readTokenKindAsConstant } from "./common";

type TriedReadPrimaryType = Result<
    Ast.TPrimaryType,
    ParseError.ExpectedAnyTokenKindError | ParseError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

type TriedReadPrimitiveType = Result<
    Ast.PrimitiveType,
    ParseError.ExpectedAnyTokenKindError | ParseError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

interface WrappedRead<Kind, Content> extends Ast.IWrapped<Kind, Content> {
    readonly maybeOptionalConstant: Option<Ast.Constant>;
}

const InvalidGeneralizedIdentifierTokenKinds: ReadonlyArray<TokenKind> = [
    TokenKind.Comma,
    TokenKind.Equal,
    TokenKind.RightBracket,
];

// -------------------------------------------
// ---------- // 12.1.6 Identifiers ----------
// -------------------------------------------

export function readIdentifier(state: IParserState, _parser: IParser<IParserState>): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    IParserStateUtils.startContext(state, nodeKind);

    const literal: string = readTokenKind(state, TokenKind.Identifier);

    const astNode: Ast.Identifier = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// This behavior matches the C# parser and not the language specification.
export function readGeneralizedIdentifier(
    state: IParserState,
    _parser: IParser<IParserState>,
): Ast.GeneralizedIdentifier {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
    IParserStateUtils.startContext(state, nodeKind);

    let literal: string;
    let astNode: Ast.GeneralizedIdentifier;

    const tokenRangeStartIndex: number = state.tokenIndex;
    let tokenRangeEndIndex: number = tokenRangeStartIndex;
    while (
        state.maybeCurrentTokenKind &&
        InvalidGeneralizedIdentifierTokenKinds.indexOf(state.maybeCurrentTokenKind) === -1
    ) {
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
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readKeyword(state: IParserState, _parser: IParser<IParserState>): Ast.IdentifierExpression {
    const identifierExpressionNodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    IParserStateUtils.startContext(state, identifierExpressionNodeKind);

    // Keywords can't have a "@" prefix constant
    IParserStateUtils.incrementAttributeCounter(state);

    const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    IParserStateUtils.startContext(state, identifierNodeKind);

    const literal: string = readToken(state);
    const identifier: Ast.Identifier = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: identifierNodeKind,
        isLeaf: true,
        literal,
    };
    IParserStateUtils.endContext(state, identifier);

    const identifierExpression: Ast.IdentifierExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: identifierExpressionNodeKind,
        isLeaf: false,
        maybeInclusiveConstant: undefined,
        identifier,
    };
    IParserStateUtils.endContext(state, identifierExpression);
    return identifierExpression;
}

// --------------------------------------
// ---------- 12.2.1 Documents ----------
// --------------------------------------

export function readDocument(state: IParserState, parser: IParser<IParserState>): TriedParse {
    let triedReadDocument: Result<Ast.TDocument, Error>;

    // Try parsing as an Expression document first.
    // If Expression document fails (including UnusedTokensRemainError) then try parsing a SectionDocument.
    // If both fail then return the error which parsed more tokens.
    try {
        triedReadDocument = ResultUtils.okFactory(parser.readExpression(state, parser));
        const maybeErr: Option<ParseError.UnusedTokensRemainError> = IParserStateUtils.testNoMoreTokens(state);
        if (maybeErr) {
            throw maybeErr;
        }
    } catch (expressionError) {
        // Fast backup deletes context state, but we want to preserve it for the case
        // where both parsing an expression and section document error out.
        const expressionErrorStateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
        const expressionErrorContextState: ParserContext.State = state.contextState;

        // Reset the parser's state.
        state.tokenIndex = 0;
        state.contextState = ParserContext.newState();
        state.maybeCurrentContextNode = undefined;

        if (state.lexerSnapshot.tokens.length) {
            state.maybeCurrentToken = state.lexerSnapshot.tokens[0];
            state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
        }

        try {
            triedReadDocument = ResultUtils.okFactory(readSectionDocument(state, parser));
            const maybeErr: Option<ParseError.UnusedTokensRemainError> = IParserStateUtils.testNoMoreTokens(state);
            if (maybeErr) {
                throw maybeErr;
            }
        } catch (sectionError) {
            let triedError: Error;
            if (expressionErrorStateBackup.tokenIndex > /* sectionErrorState */ state.tokenIndex) {
                triedError = expressionError;
                IParserStateUtils.applyFastStateBackup(state, expressionError);
                state.contextState = expressionErrorContextState;
            } else {
                triedError = sectionError;
            }

            triedReadDocument = ResultUtils.errFactory(triedError);
        }
    }

    if (ResultUtils.isErr(triedReadDocument)) {
        const currentError: Error = triedReadDocument.error;
        let convertedError: ParseError.TParseError;
        if (ParseError.isTInnerParseError(currentError)) {
            convertedError = new ParseError.ParseError(currentError, state.contextState);
        } else {
            convertedError = CommonError.ensureCommonError(currentError);
        }

        return ResultUtils.errFactory(convertedError);
    }
    const document: Ast.TDocument = triedReadDocument.value;

    if (state.maybeCurrentContextNode !== undefined) {
        const details: {} = { maybeContextNode: state.maybeCurrentContextNode };
        throw new CommonError.InvariantError(
            "maybeContextNode should be falsey, there shouldn't be an open context",
            details,
        );
    }

    const contextState: ParserContext.State = state.contextState;
    return ResultUtils.okFactory({
        ast: document,
        nodeIdMapCollection: contextState.nodeIdMapCollection,
        leafNodeIds: contextState.leafNodeIds,
    });
}

// ----------------------------------------------
// ---------- 12.2.2 Section Documents ----------
// ----------------------------------------------

export function readSectionDocument(state: IParserState, parser: IParser<IParserState>): Ast.Section {
    const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Option<Ast.RecordLiteral> = maybeReadLiteralAttributes(state, parser);
    const sectionConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordSection);

    let maybeName: Option<Ast.Identifier>;
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.Identifier)) {
        maybeName = parser.readIdentifier(state, parser);
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
    }

    const semicolonConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.Semicolon);
    const sectionMembers: Ast.IArrayWrapper<Ast.SectionMember> = parser.readSectionMembers(state, parser);

    const astNode: Ast.Section = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeLiteralAttributes,
        sectionConstant,
        maybeName,
        semicolonConstant,
        sectionMembers,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readSectionMembers(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.IArrayWrapper<Ast.SectionMember> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, nodeKind);

    const totalTokens: number = state.lexerSnapshot.tokens.length;
    const sectionMembers: Ast.SectionMember[] = [];
    while (state.tokenIndex < totalTokens) {
        sectionMembers.push(parser.readSectionMember(state, parser));
    }

    const astNode: Ast.IArrayWrapper<Ast.SectionMember> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements: sectionMembers,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readSectionMember(state: IParserState, parser: IParser<IParserState>): Ast.SectionMember {
    const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Option<Ast.RecordLiteral> = maybeReadLiteralAttributes(state, parser);
    const maybeSharedConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.KeywordShared);
    const namePairedExpression: Ast.IdentifierPairedExpression = parser.readIdentifierPairedExpression(state, parser);
    const semicolonConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.Semicolon);

    const astNode: Ast.SectionMember = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeLiteralAttributes,
        maybeSharedConstant,
        namePairedExpression,
        semicolonConstant,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// ------------------------------------------
// ---------- 12.2.3.1 Expressions ----------
// ------------------------------------------

export function readExpression(state: IParserState, parser: IParser<IParserState>): Ast.TExpression {
    switch (state.maybeCurrentTokenKind) {
        case TokenKind.KeywordEach:
            return parser.readEachExpression(state, parser);

        case TokenKind.KeywordLet:
            return parser.readLetExpression(state, parser);

        case TokenKind.KeywordIf:
            return parser.readIfExpression(state, parser);

        case TokenKind.KeywordError:
            return parser.readErrorRaisingExpression(state, parser);

        case TokenKind.KeywordTry:
            return parser.readErrorHandlingExpression(state, parser);

        case TokenKind.LeftParenthesis:
            const triedDisambiguation: Result<
                ParenthesisDisambiguation,
                ParseError.UnterminatedParenthesesError
            > = parser.disambiguateParenthesis(state, parser);
            if (ResultUtils.isErr(triedDisambiguation)) {
                throw triedDisambiguation.error;
            }
            const disambiguation: ParenthesisDisambiguation = triedDisambiguation.value;

            switch (disambiguation) {
                case ParenthesisDisambiguation.FunctionExpression:
                    return parser.readFunctionExpression(state, parser);

                case ParenthesisDisambiguation.ParenthesizedExpression:
                    return parser.readLogicalExpression(state, parser);

                default:
                    throw isNever(disambiguation);
            }

        default:
            return parser.readLogicalExpression(state, parser);
    }
}

// --------------------------------------------------
// ---------- 12.2.3.2 Logical expressions ----------
// --------------------------------------------------

export function readLogicalExpression(state: IParserState, parser: IParser<IParserState>): Ast.TLogicalExpression {
    return recursiveReadBinOpExpression<
        Ast.NodeKind.LogicalExpression,
        Ast.TLogicalExpression,
        Ast.LogicalOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.LogicalExpression,
        () => parser.readIsExpression(state, parser),
        maybeCurrentTokenKind => Ast.logicalOperatorFrom(maybeCurrentTokenKind),
        () => parser.readIsExpression(state, parser),
    );
}

// --------------------------------------------
// ---------- 12.2.3.3 Is expression ----------
// --------------------------------------------

export function readIsExpression(state: IParserState, parser: IParser<IParserState>): Ast.TIsExpression {
    return recursiveReadBinOpExpression<
        Ast.NodeKind.IsExpression,
        Ast.TAsExpression,
        Ast.ConstantKind.Is,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.IsExpression,
        () => parser.readAsExpression(state, parser),
        maybeCurrentTokenKind => (maybeCurrentTokenKind === TokenKind.KeywordIs ? Ast.ConstantKind.Is : undefined),
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

// sub-item of 12.2.3.3 Is expression
export function readNullablePrimitiveType(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.TNullablePrimitiveType {
    if (IParserStateUtils.isOnIdentifierConstant(state, Ast.IdentifierConstant.Nullable)) {
        return readPairedConstant<Ast.NodeKind.NullablePrimitiveType, Ast.PrimitiveType>(
            state,
            Ast.NodeKind.NullablePrimitiveType,
            () => readIdentifierConstantAsConstant(state, Ast.IdentifierConstant.Nullable),
            () => parser.readPrimitiveType(state, parser),
        );
    } else {
        return parser.readPrimitiveType(state, parser);
    }
}

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

export function readAsExpression(state: IParserState, parser: IParser<IParserState>): Ast.TAsExpression {
    return recursiveReadBinOpExpression<
        Ast.NodeKind.AsExpression,
        Ast.TEqualityExpression,
        Ast.ConstantKind.As,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.AsExpression,
        () => parser.readEqualityExpression(state, parser),
        maybeCurrentTokenKind => (maybeCurrentTokenKind === TokenKind.KeywordAs ? Ast.ConstantKind.As : undefined),
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

// --------------------------------------------------
// ---------- 12.2.3.5 Equality expression ----------
// --------------------------------------------------

export function readEqualityExpression(state: IParserState, parser: IParser<IParserState>): Ast.TEqualityExpression {
    return recursiveReadBinOpExpression<
        Ast.NodeKind.EqualityExpression,
        Ast.TEqualityExpression,
        Ast.EqualityOperator,
        Ast.TEqualityExpression
    >(
        state,
        Ast.NodeKind.EqualityExpression,
        () => parser.readRelationalExpression(state, parser),
        maybeCurrentTokenKind => Ast.equalityOperatorFrom(maybeCurrentTokenKind),
        () => parser.readRelationalExpression(state, parser),
    );
}

// ----------------------------------------------------
// ---------- 12.2.3.6 Relational expression ----------
// ----------------------------------------------------

export function readRelationalExpression(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.TRelationalExpression {
    return recursiveReadBinOpExpression<
        Ast.NodeKind.RelationalExpression,
        Ast.TArithmeticExpression,
        Ast.RelationalOperator,
        Ast.TArithmeticExpression
    >(
        state,
        Ast.NodeKind.RelationalExpression,
        () => parser.readArithmeticExpression(state, parser),
        maybeCurrentTokenKind => Ast.relationalOperatorFrom(maybeCurrentTokenKind),
        () => parser.readArithmeticExpression(state, parser),
    );
}

// -----------------------------------------------------
// ---------- 12.2.3.7 Arithmetic expressions ----------
// -----------------------------------------------------

export function readArithmeticExpression(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.TArithmeticExpression {
    return recursiveReadBinOpExpression<
        Ast.NodeKind.ArithmeticExpression,
        Ast.TMetadataExpression,
        Ast.ArithmeticOperator,
        Ast.TMetadataExpression
    >(
        state,
        Ast.NodeKind.ArithmeticExpression,
        () => parser.readMetadataExpression(state, parser),
        maybeCurrentTokenKind => Ast.arithmeticOperatorFrom(maybeCurrentTokenKind),
        () => parser.readMetadataExpression(state, parser),
    );
}

// --------------------------------------------------
// ---------- 12.2.3.8 Metadata expression ----------
// --------------------------------------------------

export function readMetadataExpression(state: IParserState, parser: IParser<IParserState>): Ast.TMetadataExpression {
    const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const left: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);
    const maybeMetaConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.KeywordMeta);

    if (maybeMetaConstant !== undefined) {
        const operatorConstant: Ast.Constant = maybeMetaConstant;
        const right: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);

        const astNode: Ast.MetadataExpression = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            operator: Ast.ConstantKind.Meta,
            operatorConstant,
            right,
        };

        IParserStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParserStateUtils.deleteContext(state, undefined);
        return left;
    }
}

// -----------------------------------------------
// ---------- 12.2.3.9 Unary expression ----------
// -----------------------------------------------

export function readUnaryExpression(state: IParserState, parser: IParser<IParserState>): Ast.TUnaryExpression {
    let maybeOperator: Option<Ast.UnaryOperator> = Ast.unaryOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        return parser.readTypeExpression(state, parser);
    }

    const unaryNodeKind: Ast.NodeKind.UnaryExpression = Ast.NodeKind.UnaryExpression;
    IParserStateUtils.startContext(state, unaryNodeKind);

    const arrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, arrayNodeKind);

    const operatorConstants: Ast.Constant[] = [];
    while (maybeOperator) {
        operatorConstants.push(readTokenKindAsConstant(state, state.maybeCurrentTokenKind as TokenKind));
        maybeOperator = Ast.unaryOperatorFrom(state.maybeCurrentTokenKind);
    }
    const operators: Ast.IArrayWrapper<Ast.Constant> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: arrayNodeKind,
        isLeaf: false,
        elements: operatorConstants,
    };
    IParserStateUtils.endContext(state, operators);

    const typeExpression: Ast.TTypeExpression = parser.readTypeExpression(state, parser);

    const astNode: Ast.UnaryExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: unaryNodeKind,
        isLeaf: false,
        operators,
        typeExpression,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------
// ---------- 12.2.3.10 Primary expression ----------
// --------------------------------------------------

export function readPrimaryExpression(state: IParserState, parser: IParser<IParserState>): Ast.TPrimaryExpression {
    let primaryExpression: Option<Ast.TPrimaryExpression>;
    const maybeCurrentTokenKind: Option<TokenKind> = state.maybeCurrentTokenKind;
    const isIdentifierExpressionNext: boolean =
        maybeCurrentTokenKind === TokenKind.AtSign || maybeCurrentTokenKind === TokenKind.Identifier;

    if (isIdentifierExpressionNext) {
        primaryExpression = parser.readIdentifierExpression(state, parser);
    } else {
        switch (maybeCurrentTokenKind) {
            case TokenKind.LeftParenthesis:
                primaryExpression = parser.readParenthesizedExpression(state, parser);
                break;

            case TokenKind.LeftBracket:
                primaryExpression = readBracketDisambiguation(state, parser, [
                    BracketDisambiguation.FieldProjection,
                    BracketDisambiguation.FieldSelection,
                    BracketDisambiguation.Record,
                ]);
                break;

            case TokenKind.LeftBrace:
                primaryExpression = parser.readListExpression(state, parser);
                break;

            case TokenKind.Ellipsis:
                primaryExpression = parser.readNotImplementedExpression(state, parser);
                break;

            case TokenKind.KeywordHashSections:
            case TokenKind.KeywordHashShared:
            case TokenKind.KeywordHashBinary:
            case TokenKind.KeywordHashDate:
            case TokenKind.KeywordHashDateTime:
            case TokenKind.KeywordHashDateTimeZone:
            case TokenKind.KeywordHashDuration:
            case TokenKind.KeywordHashTable:
            case TokenKind.KeywordHashTime:
                primaryExpression = parser.readKeyword(state, parser);
                break;

            default:
                primaryExpression = parser.readLiteralExpression(state, parser);
        }
    }

    if (IParserStateUtils.isRecursivePrimaryExpressionNext(state)) {
        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
    } else {
        return primaryExpression;
    }
}

export function readRecursivePrimaryExpression(
    state: IParserState,
    parser: IParser<IParserState>,
    head: Ast.TPrimaryExpression,
): Ast.RecursivePrimaryExpression {
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
    IParserStateUtils.startContext(state, nodeKind);

    // The head of the recursive primary expression is created before the recursive primrary expression,
    // meaning the parent/child mapping for contexts are in reverse order.
    // The clean up for that happens here.
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
    }
    const currentContextNode: ParserContext.Node = state.maybeCurrentContextNode;

    const maybeHeadParentId: Option<number> = nodeIdMapCollection.parentIdById.get(head.id);
    if (maybeHeadParentId !== undefined) {
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
    }

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
    //      I'm only mutating start location in the recursive expression to one already parsed, the head.
    mutableContext.maybeTokenStart = state.lexerSnapshot.tokens[recursiveTokenIndexStart];
    mutableContext.tokenIndexStart = recursiveTokenIndexStart;

    // Update attribute index for the head Ast.TNode
    const mutableHead: TypeUtils.StripReadonly<Ast.TPrimaryExpression> = head;
    // UNSAFE MARKER
    //
    // Purpose of code block:
    //      The head might not have `maybeAttributeIndex === 0` set.
    //
    // Why are you trying to avoid a safer approach?
    //      Prevent the cost of a shallow copy.
    //
    // Why is it safe?
    //      It's a shallow copy, plus one attribute change.
    mutableHead.maybeAttributeIndex = 0;

    // Begin normal parsing behavior.
    const recursiveArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, recursiveArrayNodeKind);

    const recursiveExpressions: Ast.TRecursivePrimaryExpression[] = [];
    let continueReadingValues: boolean = true;
    while (continueReadingValues) {
        const maybeCurrentTokenKind: Option<TokenKind> = state.maybeCurrentTokenKind;

        if (maybeCurrentTokenKind === TokenKind.LeftParenthesis) {
            recursiveExpressions.push(parser.readInvokeExpression(state, parser));
        } else if (maybeCurrentTokenKind === TokenKind.LeftBrace) {
            recursiveExpressions.push(parser.readItemAccessExpression(state, parser));
        } else if (maybeCurrentTokenKind === TokenKind.LeftBracket) {
            const bracketExpression: Ast.TRecursivePrimaryExpression = readBracketDisambiguation(state, parser, [
                BracketDisambiguation.FieldProjection,
                BracketDisambiguation.FieldSelection,
            ]) as Ast.TRecursivePrimaryExpression;
            recursiveExpressions.push(bracketExpression);
        } else {
            continueReadingValues = false;
        }
    }

    const recursiveArray: Ast.IArrayWrapper<Ast.TRecursivePrimaryExpression> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: recursiveArrayNodeKind,
        isLeaf: false,
        elements: recursiveExpressions,
    };
    IParserStateUtils.endContext(state, recursiveArray);

    const astNode: Ast.RecursivePrimaryExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        head,
        recursiveExpressions: recursiveArray,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------
// ---------- 12.2.3.11 Literal expression ----------
// --------------------------------------------------

export function readLiteralExpression(state: IParserState, _parser: IParser<IParserState>): Ast.LiteralExpression {
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.HexLiteral,
        TokenKind.KeywordFalse,
        TokenKind.KeywordHashNan,
        TokenKind.KeywordTrue,
        TokenKind.NumericLiteral,
        TokenKind.NullLiteral,
        TokenKind.StringLiteral,
    ];
    const maybeErr: Option<ParseError.ExpectedAnyTokenKindError> = IParserStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
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
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal: literal,
        literalKind: maybeLiteralKind,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------------------------
// ---------- 12.2.3.16 12.2.3.12 Identifier expression ----------
// ---------------------------------------------------------------

export function readIdentifierExpression(state: IParserState, parser: IParser<IParserState>): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeInclusiveConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.AtSign);
    const identifier: Ast.Identifier = parser.readIdentifier(state, parser);

    const astNode: Ast.IdentifierExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeInclusiveConstant,
        identifier,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------------
// ---------- 12.2.3.14 Parenthesized expression ----------
// --------------------------------------------------------

export function readParenthesizedExpression(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.ParenthesizedExpression {
    return readWrapped<Ast.NodeKind.ParenthesizedExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.ParenthesizedExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftParenthesis),
        () => parser.readExpression(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightParenthesis),
        false,
    );
}

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

export function readNotImplementedExpression(
    state: IParserState,
    _parser: IParser<IParserState>,
): Ast.NotImplementedExpression {
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const ellipsisConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.Ellipsis);

    const astNode: Ast.NotImplementedExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ellipsisConstant,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// -------------------------------------------------
// ---------- 12.2.3.16 Invoke expression ----------
// -------------------------------------------------

export function readInvokeExpression(state: IParserState, parser: IParser<IParserState>): Ast.InvokeExpression {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightParenthesis);
    return readWrapped<Ast.NodeKind.InvokeExpression, Ast.ICsvArray<Ast.TExpression>>(
        state,
        Ast.NodeKind.InvokeExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftParenthesis),
        () =>
            readCsvArray(
                state,
                () => parser.readExpression(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForParenthesis,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightParenthesis),
        false,
    );
}

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

export function readListExpression(state: IParserState, parser: IParser<IParserState>): Ast.ListExpression {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBrace);
    return readWrapped<Ast.NodeKind.ListExpression, Ast.ICsvArray<Ast.TListItem>>(
        state,
        Ast.NodeKind.ListExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () =>
            readCsvArray(
                state,
                () => parser.readListItem(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        false,
    );
}

export function readListItem(state: IParserState, parser: IParser<IParserState>): Ast.TListItem {
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const left: Ast.TExpression = parser.readExpression(state, parser);
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.DotDot)) {
        const rangeConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.DotDot);
        const right: Ast.TExpression = parser.readExpression(state, parser);
        const astNode: Ast.RangeExpression = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            rangeConstant,
            right,
        };

        IParserStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParserStateUtils.deleteContext(state, undefined);
        return left;
    }
}

// -----------------------------------------------------------
// ---------- 12.2.3.18 12.2.3.18 Record expression ----------
// -----------------------------------------------------------

export function readRecordExpression(state: IParserState, parser: IParser<IParserState>): Ast.RecordExpression {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBracket);
    return readWrapped<Ast.NodeKind.RecordExpression, Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>>(
        state,
        Ast.NodeKind.RecordExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () =>
            parser.readGeneralizedIdentifierPairedExpressions(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        false,
    );
}

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

export function readItemAccessExpression(state: IParserState, parser: IParser<IParserState>): Ast.ItemAccessExpression {
    return readWrapped<Ast.NodeKind.ItemAccessExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.ItemAccessExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () => parser.readExpression(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        true,
    );
}

// -------------------------------------------------------
// ---------- 12.2.3.20 Field access expression ----------
// -------------------------------------------------------

export function readFieldSelection(state: IParserState, parser: IParser<IParserState>): Ast.FieldSelector {
    return readFieldSelector(state, parser, true);
}

export function readFieldProjection(state: IParserState, parser: IParser<IParserState>): Ast.FieldProjection {
    return readWrapped<Ast.NodeKind.FieldProjection, Ast.ICsvArray<Ast.FieldSelector>>(
        state,
        Ast.NodeKind.FieldProjection,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () =>
            readCsvArray(
                state,
                () => parser.readFieldSelector(state, parser, false),
                true,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        true,
    );
}

export function readFieldSelector(
    state: IParserState,
    parser: IParser<IParserState>,
    allowOptional: boolean,
): Ast.FieldSelector {
    return readWrapped<Ast.NodeKind.FieldSelector, Ast.GeneralizedIdentifier>(
        state,
        Ast.NodeKind.FieldSelector,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () => parser.readGeneralizedIdentifier(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        allowOptional,
    );
}

// ---------------------------------------------------
// ---------- 12.2.3.21 Function expression ----------
// ---------------------------------------------------

export function readFunctionExpression(state: IParserState, parser: IParser<IParserState>): Ast.FunctionExpression {
    const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const parameters: Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>> = parser.readParameterList(state, parser);
    const maybeFunctionReturnType: Option<Ast.AsNullablePrimitiveType> = maybeReadAsNullablePrimitiveType(
        state,
        parser,
    );
    const fatArrowConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.FatArrow);
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.FunctionExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        parameters,
        maybeFunctionReturnType,
        fatArrowConstant,
        expression,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readParameterList(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>> {
    return genericReadParameterList(state, parser, () => maybeReadAsNullablePrimitiveType(state, parser));
}

function maybeReadAsNullablePrimitiveType(
    state: IParserState,
    parser: IParser<IParserState>,
): Option<Ast.AsNullablePrimitiveType> {
    return maybeReadPairedConstant<Ast.NodeKind.AsNullablePrimitiveType, Ast.TNullablePrimitiveType>(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs),
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

export function readAsType(state: IParserState, parser: IParser<IParserState>): Ast.AsType {
    return readPairedConstant<Ast.NodeKind.AsType, Ast.TType>(
        state,
        Ast.NodeKind.AsType,
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs),
        () => parser.readType(state, parser),
    );
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

export function readEachExpression(state: IParserState, parser: IParser<IParserState>): Ast.EachExpression {
    return readPairedConstant<Ast.NodeKind.EachExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.EachExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordEach),
        () => parser.readExpression(state, parser),
    );
}

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

export function readLetExpression(state: IParserState, parser: IParser<IParserState>): Ast.LetExpression {
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const letConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordLet);
    const identifierExpressionPairedExpressions: Ast.ICsvArray<
        Ast.IdentifierPairedExpression
    > = parser.readIdentifierPairedExpressions(
        state,
        parser,
        !IParserStateUtils.isNextTokenKind(state, TokenKind.KeywordIn),
        IParserStateUtils.testCsvContinuationLetExpression,
    );
    const inConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordIn);
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.LetExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: Ast.NodeKind.LetExpression,
        isLeaf: false,
        letConstant,
        variableList: identifierExpressionPairedExpressions,
        inConstant,
        expression,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------
// ---------- 12.2.3.24 If expression ----------
// ---------------------------------------------

export function readIfExpression(state: IParserState, parser: IParser<IParserState>): Ast.IfExpression {
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const ifConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordIf);
    const condition: Ast.TExpression = parser.readExpression(state, parser);

    const thenConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordThen);
    const trueExpression: Ast.TExpression = parser.readExpression(state, parser);

    const elseConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordElse);
    const falseExpression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.IfExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ifConstant,
        condition,
        thenConstant,
        trueExpression,
        elseConstant,
        falseExpression,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// -----------------------------------------------
// ---------- 12.2.3.25 Type expression ----------
// -----------------------------------------------

export function readTypeExpression(state: IParserState, parser: IParser<IParserState>): Ast.TTypeExpression {
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordType)) {
        return readPairedConstant<Ast.NodeKind.TypePrimaryType, Ast.TPrimaryType>(
            state,
            Ast.NodeKind.TypePrimaryType,
            () => readTokenKindAsConstant(state, TokenKind.KeywordType),
            () => parser.readPrimaryType(state, parser),
        );
    } else {
        return parser.readPrimaryExpression(state, parser);
    }
}

export function readType(state: IParserState, parser: IParser<IParserState>): Ast.TType {
    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);

    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        return parser.readPrimaryExpression(state, parser);
    }
}

export function readPrimaryType(state: IParserState, parser: IParser<IParserState>): Ast.TPrimaryType {
    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);

    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        throw triedReadPrimaryType.error;
    }
}

export function readRecordType(state: IParserState, parser: IParser<IParserState>): Ast.RecordType {
    const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;
    IParserStateUtils.startContext(state, nodeKind);

    const fields: Ast.FieldSpecificationList = parser.readFieldSpecificationList(
        state,
        parser,
        true,
        testCsvContinuationDanglingCommaForBracket,
    );

    const astNode: Ast.RecordType = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        fields,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readTableType(state: IParserState, parser: IParser<IParserState>): Ast.TableType {
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;
    IParserStateUtils.startContext(state, nodeKind);

    const tableConstant: Ast.Constant = readIdentifierConstantAsConstant(state, Ast.IdentifierConstant.Table);
    const maybeCurrentTokenKind: Option<TokenKind> = state.maybeCurrentTokenKind;
    const isPrimaryExpressionExpected: boolean =
        maybeCurrentTokenKind === TokenKind.AtSign ||
        maybeCurrentTokenKind === TokenKind.Identifier ||
        maybeCurrentTokenKind === TokenKind.LeftParenthesis;

    let rowType: Ast.FieldSpecificationList | Ast.TPrimaryExpression;
    if (isPrimaryExpressionExpected) {
        rowType = parser.readPrimaryExpression(state, parser);
    } else {
        rowType = parser.readFieldSpecificationList(state, parser, false, testCsvContinuationDanglingCommaForBracket);
    }

    const astNode: Ast.TableType = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tableConstant,
        rowType,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readFieldSpecificationList(
    state: IParserState,
    parser: IParser<IParserState>,
    allowOpenMarker: boolean,
    testPostCommaError: (state: IParserState) => Option<ParseError.TInnerParseError>,
): Ast.FieldSpecificationList {
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;
    IParserStateUtils.startContext(state, nodeKind);

    const leftBracketConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.LeftBracket);
    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = true;
    let maybeOpenRecordMarkerConstant: Option<Ast.Constant> = undefined;

    const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, fieldArrayNodeKind);

    while (continueReadingValues) {
        const maybeErr: Option<ParseError.TInnerParseError> = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        if (IParserStateUtils.isOnTokenKind(state, TokenKind.Ellipsis)) {
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
        } else if (IParserStateUtils.isOnGeneralizedIdentifierStart(state)) {
            const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
            IParserStateUtils.startContext(state, csvNodeKind);

            const fieldSpecificationNodeKind: Ast.NodeKind.FieldSpecification = Ast.NodeKind.FieldSpecification;
            IParserStateUtils.startContext(state, fieldSpecificationNodeKind);

            const maybeOptionalConstant: Option<Ast.Constant> = maybeReadIdentifierConstantAsConstant(
                state,
                Ast.IdentifierConstant.Optional,
            );

            const name: Ast.GeneralizedIdentifier = parser.readGeneralizedIdentifier(state, parser);

            const maybeFieldTypeSpeification: Option<Ast.FieldTypeSpecification> = maybeReadFieldTypeSpecification(
                state,
                parser,
            );

            const maybeCommaConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            const field: Ast.FieldSpecification = {
                ...IParserStateUtils.expectContextNodeMetadata(state),
                kind: fieldSpecificationNodeKind,
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeFieldTypeSpeification,
            };
            IParserStateUtils.endContext(state, field);

            const csv: Ast.ICsv<Ast.FieldSpecification> = {
                ...IParserStateUtils.expectContextNodeMetadata(state),
                kind: csvNodeKind,
                isLeaf: false,
                node: field,
                maybeCommaConstant,
            };
            IParserStateUtils.endContext(state, csv);
            fields.push(csv);
        } else {
            throw fieldSpecificationListReadError(state, allowOpenMarker);
        }
    }

    const fieldArray: Ast.ICsvArray<Ast.FieldSpecification> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: fieldArrayNodeKind,
        elements: fields,
        isLeaf: false,
    };
    IParserStateUtils.endContext(state, fieldArray);

    const rightBracketConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.RightBracket);

    const astNode: Ast.FieldSpecificationList = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftBracketConstant,
        content: fieldArray,
        maybeOpenRecordMarkerConstant,
        closeWrapperConstant: rightBracketConstant,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

function maybeReadFieldTypeSpecification(
    state: IParserState,
    parser: IParser<IParserState>,
): Option<Ast.FieldTypeSpecification> {
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeEqualConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Equal);
    if (maybeEqualConstant) {
        const fieldType: Ast.TType = parser.readType(state, parser);

        const astNode: Ast.FieldTypeSpecification = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: Ast.NodeKind.FieldTypeSpecification,
            isLeaf: false,
            equalConstant: maybeEqualConstant,
            fieldType,
        };
        IParserStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
        IParserStateUtils.deleteContext(state, undefined);
        return undefined;
    }
}

function fieldSpecificationListReadError(state: IParserState, allowOpenMarker: boolean): Option<Error> {
    if (allowOpenMarker) {
        const expectedTokenKinds: ReadonlyArray<TokenKind> = [TokenKind.Identifier, TokenKind.Ellipsis];
        return IParserStateUtils.testIsOnAnyTokenKind(state, expectedTokenKinds);
    } else {
        return IParserStateUtils.testIsOnTokenKind(state, TokenKind.Identifier);
    }
}

export function readListType(state: IParserState, parser: IParser<IParserState>): Ast.ListType {
    return readWrapped<Ast.NodeKind.ListType, Ast.TType>(
        state,
        Ast.NodeKind.ListType,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () => parser.readType(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        false,
    );
}

export function readFunctionType(state: IParserState, parser: IParser<IParserState>): Ast.FunctionType {
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
    IParserStateUtils.startContext(state, nodeKind);

    const functionConstant: Ast.Constant = readIdentifierConstantAsConstant(state, Ast.IdentifierConstant.Function);
    const parameters: Ast.IParameterList<Ast.AsType> = parser.readParameterSpecificationList(state, parser);
    const functionReturnType: Ast.AsType = parser.readAsType(state, parser);

    const astNode: Ast.FunctionType = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        functionConstant,
        parameters,
        functionReturnType,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

function tryReadPrimaryType(state: IParserState, parser: IParser<IParserState>): TriedReadPrimaryType {
    const isTableTypeNext: boolean =
        IParserStateUtils.isOnIdentifierConstant(state, Ast.IdentifierConstant.Table) &&
        (IParserStateUtils.isNextTokenKind(state, TokenKind.LeftBracket) ||
            IParserStateUtils.isNextTokenKind(state, TokenKind.LeftParenthesis) ||
            IParserStateUtils.isNextTokenKind(state, TokenKind.AtSign) ||
            IParserStateUtils.isNextTokenKind(state, TokenKind.Identifier));
    const isFunctionTypeNext: boolean =
        IParserStateUtils.isOnIdentifierConstant(state, Ast.IdentifierConstant.Function) &&
        IParserStateUtils.isNextTokenKind(state, TokenKind.LeftParenthesis);

    if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        return ResultUtils.okFactory(parser.readRecordType(state, parser));
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBrace)) {
        return ResultUtils.okFactory(parser.readListType(state, parser));
    } else if (isTableTypeNext) {
        return ResultUtils.okFactory(parser.readTableType(state, parser));
    } else if (isFunctionTypeNext) {
        return ResultUtils.okFactory(parser.readFunctionType(state, parser));
    } else if (IParserStateUtils.isOnIdentifierConstant(state, Ast.IdentifierConstant.Nullable)) {
        return ResultUtils.okFactory(parser.readNullableType(state, parser));
    } else {
        const stateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
        const triedReadPrimitiveType: TriedReadPrimaryType = tryReadPrimitiveType(state, parser);

        if (ResultUtils.isErr(triedReadPrimitiveType)) {
            IParserStateUtils.applyFastStateBackup(state, stateBackup);
        }
        return triedReadPrimitiveType;
    }
}

export function readParameterSpecificationList(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.IParameterList<Ast.AsType> {
    return genericReadParameterList(state, parser, () => parser.readAsType(state, parser));
}

export function readNullableType(state: IParserState, parser: IParser<IParserState>): Ast.NullableType {
    return readPairedConstant<Ast.NodeKind.NullableType, Ast.TType>(
        state,
        Ast.NodeKind.NullableType,
        () => readIdentifierConstantAsConstant(state, Ast.IdentifierConstant.Nullable),
        () => parser.readType(state, parser),
    );
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export function readErrorRaisingExpression(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.ErrorRaisingExpression {
    return readPairedConstant<Ast.NodeKind.ErrorRaisingExpression, Ast.TExpression>(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordError),
        () => parser.readExpression(state, parser),
    );
}

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

export function readErrorHandlingExpression(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.ErrorHandlingExpression {
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const tryConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.KeywordTry);
    const protectedExpression: Ast.TExpression = parser.readExpression(state, parser);

    const otherwiseExpressionNodeKind: Ast.NodeKind.OtherwiseExpression = Ast.NodeKind.OtherwiseExpression;
    const maybeOtherwiseExpression: Option<Ast.OtherwiseExpression> = maybeReadPairedConstant<
        Ast.NodeKind.OtherwiseExpression,
        Ast.TExpression
    >(
        state,
        otherwiseExpressionNodeKind,
        () => IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordOtherwise),
        () => readTokenKindAsConstant(state, TokenKind.KeywordOtherwise),
        () => parser.readExpression(state, parser),
    );

    const astNode: Ast.ErrorHandlingExpression = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tryConstant,
        protectedExpression,
        maybeOtherwiseExpression,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// -----------------------------------------------
// ---------- 12.2.4 Literal Attributes ----------
// -----------------------------------------------

export function readRecordLiteral(state: IParserState, parser: IParser<IParserState>): Ast.RecordLiteral {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBracket);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.RecordLiteral,
        Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>
    > = readWrapped<Ast.NodeKind.RecordLiteral, Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>>(
        state,
        Ast.NodeKind.RecordLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket),
        () =>
            parser.readFieldNamePairedAnyLiterals(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.Record,
        ...wrappedRead,
    };
}

export function readFieldNamePairedAnyLiterals(
    state: IParserState,
    parser: IParser<IParserState>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => Option<ParseError.TInnerParseError>,
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
                () => parser.readGeneralizedIdentifier(state, parser),
                () => parser.readAnyLiteral(state, parser),
            ),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readListLiteral(state: IParserState, parser: IParser<IParserState>): Ast.ListLiteral {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBrace);
    const wrappedRead: Ast.IWrapped<Ast.NodeKind.ListLiteral, Ast.ICsvArray<Ast.TAnyLiteral>> = readWrapped<
        Ast.NodeKind.ListLiteral,
        Ast.ICsvArray<Ast.TAnyLiteral>
    >(
        state,
        Ast.NodeKind.ListLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace),
        () =>
            readCsvArray(
                state,
                () => parser.readAnyLiteral(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.List,
        ...wrappedRead,
    };
}

export function readAnyLiteral(state: IParserState, parser: IParser<IParserState>): Ast.TAnyLiteral {
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBrace)) {
        return parser.readListLiteral(state, parser);
    } else {
        return parser.readLiteralExpression(state, parser);
    }
}

export function readPrimitiveType(state: IParserState, parser: IParser<IParserState>): Ast.PrimitiveType {
    const triedReadPrimitiveType: TriedReadPrimitiveType = tryReadPrimitiveType(state, parser);
    if (ResultUtils.isOk(triedReadPrimitiveType)) {
        return triedReadPrimitiveType.value;
    } else {
        throw triedReadPrimitiveType.error;
    }
}

function tryReadPrimitiveType(state: IParserState, _parser: IParser<IParserState>): TriedReadPrimitiveType {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
    IParserStateUtils.startContext(state, nodeKind);

    const stateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.Identifier,
        TokenKind.KeywordType,
        TokenKind.NullLiteral,
    ];
    const maybeErr: Option<ParseError.ExpectedAnyTokenKindError> = IParserStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeErr) {
        const error: ParseError.ExpectedAnyTokenKindError = maybeErr;
        return ResultUtils.errFactory(error);
    }

    let primitiveType: Ast.Constant;
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.Identifier)) {
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
                const token: Token = IParserStateUtils.expectTokenAt(state, state.tokenIndex);
                IParserStateUtils.applyFastStateBackup(state, stateBackup);
                return ResultUtils.errFactory(
                    new ParseError.InvalidPrimitiveTypeError(
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                    ),
                );
        }
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordType)) {
        primitiveType = readTokenKindAsConstant(state, TokenKind.KeywordType);
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.NullLiteral)) {
        primitiveType = readTokenKindAsConstant(state, TokenKind.NullLiteral);
    } else {
        const details: {} = { tokenKind: state.maybeCurrentTokenKind };
        IParserStateUtils.applyFastStateBackup(state, stateBackup);
        return ResultUtils.errFactory(
            new CommonError.InvariantError(`unknown currentTokenKind, not found in [${expectedTokenKinds}]`, details),
        );
    }

    const astNode: Ast.PrimitiveType = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        primitiveType,
    };
    IParserStateUtils.endContext(state, astNode);
    return ResultUtils.okFactory(astNode);
}

// ------------------------------------
// ---------- Disambiguation ----------
// ------------------------------------

export function disambiguateParenthesis(
    state: IParserState,
    parser: IParser<IParserState>,
): Result<ParenthesisDisambiguation, ParseError.UnterminatedParenthesesError> {
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
            if (IParserStateUtils.isTokenKind(state, TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                const stateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
                unsafeMoveTo(state, offsetTokenIndex + 2);

                try {
                    parser.readNullablePrimitiveType(state, parser);
                } catch {
                    IParserStateUtils.applyFastStateBackup(state, stateBackup);
                    if (IParserStateUtils.isOnTokenKind(state, TokenKind.FatArrow)) {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.FunctionExpression);
                    } else {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.ParenthesizedExpression);
                    }
                }

                let disambiguation: ParenthesisDisambiguation;
                if (IParserStateUtils.isOnTokenKind(state, TokenKind.FatArrow)) {
                    disambiguation = ParenthesisDisambiguation.FunctionExpression;
                } else {
                    disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
                }

                IParserStateUtils.applyFastStateBackup(state, stateBackup);
                return ResultUtils.okFactory(disambiguation);
            } else {
                if (IParserStateUtils.isTokenKind(state, TokenKind.FatArrow, offsetTokenIndex + 1)) {
                    return ResultUtils.okFactory(ParenthesisDisambiguation.FunctionExpression);
                } else {
                    return ResultUtils.okFactory(ParenthesisDisambiguation.ParenthesizedExpression);
                }
            }
        }

        offsetTokenIndex += 1;
    }

    return ResultUtils.errFactory(IParserStateUtils.unterminatedParenthesesError(state));
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

export function disambiguateBracket(
    state: IParserState,
    _parser: IParser<IParserState>,
): Result<BracketDisambiguation, ParseError.UnterminatedBracketError> {
    const tokens: ReadonlyArray<Token> = state.lexerSnapshot.tokens;
    let offsetTokenIndex: number = state.tokenIndex + 1;
    const offsetToken: Token = tokens[offsetTokenIndex];

    if (!offsetToken) {
        return ResultUtils.errFactory(IParserStateUtils.unterminatedBracketError(state));
    }

    let offsetTokenKind: TokenKind = offsetToken.kind;
    if (offsetTokenKind === TokenKind.LeftBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.FieldProjection);
    } else if (offsetTokenKind === TokenKind.RightBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.Record);
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;
        while (offsetTokenIndex < totalTokens) {
            offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === TokenKind.Equal) {
                return ResultUtils.okFactory(BracketDisambiguation.Record);
            } else if (offsetTokenKind === TokenKind.RightBracket) {
                return ResultUtils.okFactory(BracketDisambiguation.FieldSelection);
            }

            offsetTokenIndex += 1;
        }

        return ResultUtils.errFactory(IParserStateUtils.unterminatedBracketError(state));
    }
}

// -------------------------------------
// ---------- key-value pairs ----------
// -------------------------------------

export function readIdentifierPairedExpressions(
    state: IParserState,
    parser: IParser<IParserState>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => Option<ParseError.TInnerParseError>,
): Ast.ICsvArray<Ast.IdentifierPairedExpression> {
    return readCsvArray(
        state,
        () => parser.readIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpressions(
    state: IParserState,
    parser: IParser<IParserState>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => Option<ParseError.TInnerParseError>,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> {
    return readCsvArray(
        state,
        () => parser.readGeneralizedIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpression(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.GeneralizedIdentifierPairedExpression {
    return readKeyValuePair<
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.GeneralizedIdentifier,
        Ast.TExpression
    >(
        state,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        () => parser.readGeneralizedIdentifier(state, parser),
        () => parser.readExpression(state, parser),
    );
}

export function readIdentifierPairedExpression(
    state: IParserState,
    parser: IParser<IParserState>,
): Ast.IdentifierPairedExpression {
    return readKeyValuePair<Ast.NodeKind.IdentifierPairedExpression, Ast.Identifier, Ast.TExpression>(
        state,
        Ast.NodeKind.IdentifierPairedExpression,
        () => parser.readIdentifier(state, parser),
        () => parser.readExpression(state, parser),
    );
}

// ---------------------------------------------------------------
// ---------- Helper functions (generic read functions) ----------
// ---------------------------------------------------------------

// Given the string `1 + 2 + 3` the function will parse the `1 +`,
// then pass the remainder of the string `2 + 3` into recursiveReadBinOpExpressionHelper.
// The helper function is nearly a copy except it replaces Left and leftReader with Right and rightReader.
//
// The reason the code is duplicated across two functions is because I can't think of a cleaner way to do it.
function recursiveReadBinOpExpression<Kind, Left, Operator, Right>(
    state: IParserState,
    nodeKind: Kind & Ast.TBinOpExpressionNodeKind,
    leftReader: () => Left,
    maybeOperatorFrom: (tokenKind: Option<TokenKind>) => Option<Operator>,
    rightReader: () => Right,
): Left | Ast.IBinOpExpression<Kind, Left, Operator, Right> {
    IParserStateUtils.startContext(state, nodeKind);
    const left: Left = leftReader();

    // If no operator, return Left
    const maybeOperator: Option<Operator> = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        IParserStateUtils.deleteContext(state, undefined);
        return left;
    }
    const operator: Operator = maybeOperator;
    const operatorConstant: Ast.Constant = readTokenKindAsConstant(state, state.maybeCurrentTokenKind as TokenKind);
    const right: Right | Ast.IBinOpExpression<Kind, Right, Operator, Right> = recursiveReadBinOpExpressionHelper<
        Kind,
        Operator,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const astNode: Ast.IBinOpExpression<Kind, Left, Operator, Right> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left,
        operator,
        operatorConstant,
        right,
    };
    IParserStateUtils.endContext(state, (astNode as unknown) as Ast.TNode);

    return astNode;
}

// Given the string `1 + 2 + 3` the function will recursively parse 2 Ast nodes,
// where their TokenRange's are represented by brackets:
// 1 + [2 + [3]]
function recursiveReadBinOpExpressionHelper<Kind, Operator, Right>(
    state: IParserState,
    nodeKind: Kind & Ast.TBinOpExpressionNodeKind,
    maybeOperatorFrom: (tokenKind: Option<TokenKind>) => Option<Operator>,
    rightReader: () => Right,
): Right | Ast.IBinOpExpression<Kind, Right, Operator, Right> {
    IParserStateUtils.startContext(state, nodeKind);
    const rightAsLeft: Right = rightReader();

    const maybeOperator: Option<Operator> = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        IParserStateUtils.deleteContext(state, undefined);
        return rightAsLeft;
    }
    const operator: Operator = maybeOperator;
    const operatorConstant: Ast.Constant = readTokenKindAsConstant(state, state.maybeCurrentTokenKind as TokenKind);
    const right: Right | Ast.IBinOpExpression<Kind, Right, Operator, Right> = recursiveReadBinOpExpressionHelper<
        Kind,
        Operator,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const astNode: Ast.IBinOpExpression<Kind, Right, Operator, Right> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left: rightAsLeft,
        operator,
        operatorConstant,
        right,
    };
    IParserStateUtils.endContext(state, (astNode as unknown) as Ast.TNode);

    return astNode;
}

function readCsvArray<T>(
    state: IParserState,
    valueReader: () => T & Ast.TCsvType,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => Option<ParseError.TInnerParseError>,
): Ast.TCsvArray & Ast.ICsvArray<T & Ast.TCsvType> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, nodeKind);

    const elements: Ast.ICsv<T & Ast.TCsvType>[] = [];

    while (continueReadingValues) {
        const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
        IParserStateUtils.startContext(state, csvNodeKind);

        const maybeErr: Option<ParseError.TInnerParseError> = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const node: T & Ast.TCsvType = valueReader();
        const maybeCommaConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Comma);
        continueReadingValues = maybeCommaConstant !== undefined;

        const element: Ast.TCsv & Ast.ICsv<T & Ast.TCsvType> = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: csvNodeKind,
            isLeaf: false,
            node,
            maybeCommaConstant,
        };
        elements.push(element);
        IParserStateUtils.endContext(state, element);
    }

    const astNode: Ast.ICsvArray<T & Ast.TCsvType> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

function readKeyValuePair<Kind, Key, Value>(
    state: IParserState,
    nodeKind: Kind & Ast.TKeyValuePairNodeKind,
    keyReader: () => Key,
    valueReader: () => Value,
): Ast.IKeyValuePair<Kind, Key, Value> {
    IParserStateUtils.startContext(state, nodeKind);

    const key: Key = keyReader();
    const equalConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.Equal);
    const value: Value = valueReader();

    const keyValuePair: Ast.IKeyValuePair<Kind, Key, Value> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        key,
        equalConstant,
        value,
    };
    IParserStateUtils.endContext(state, (keyValuePair as unknown) as Ast.TKeyValuePair);
    return keyValuePair;
}

function readPairedConstant<Kind, Paired>(
    state: IParserState,
    nodeKind: Kind & Ast.TPairedConstantNodeKind,
    constantReader: () => Ast.Constant,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, Paired> {
    IParserStateUtils.startContext(state, nodeKind);

    const constant: Ast.Constant = constantReader();
    const paired: Paired = pairedReader();

    const pairedConstant: Ast.IPairedConstant<Kind, Paired> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        constant,
        paired,
    };

    IParserStateUtils.endContext(state, (pairedConstant as unknown) as Ast.TPairedConstant);

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
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function genericReadParameterList<T>(
    state: IParserState,
    parser: IParser<IParserState>,
    typeReader: () => T & Ast.TParameterType,
): Ast.IParameterList<T> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;
    IParserStateUtils.startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.LeftParenthesis);
    let continueReadingValues: boolean = !IParserStateUtils.isOnTokenKind(state, TokenKind.RightParenthesis);
    let reachedOptionalParameter: boolean = false;

    const paramaterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, paramaterArrayNodeKind);

    const parameters: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>>[] = [];
    while (continueReadingValues) {
        IParserStateUtils.startContext(state, Ast.NodeKind.Csv);
        IParserStateUtils.startContext(state, Ast.NodeKind.Parameter);

        const maybeErr: Option<ParseError.TInnerParseError> = testCsvContinuationDanglingCommaForParenthesis(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const maybeOptionalConstant: Option<Ast.Constant> = maybeReadIdentifierConstantAsConstant(
            state,
            Ast.IdentifierConstant.Optional,
        );

        if (reachedOptionalParameter && !maybeOptionalConstant) {
            const token: Token = IParserStateUtils.expectTokenAt(state, state.tokenIndex);
            throw new ParseError.RequiredParameterAfterOptionalParameterError(
                token,
                state.lexerSnapshot.graphemePositionStartFrom(token),
            );
        } else if (maybeOptionalConstant) {
            reachedOptionalParameter = true;
        }

        const name: Ast.Identifier = parser.readIdentifier(state, parser);
        const maybeParameterType: T & Ast.TParameterType = typeReader();

        const parameter: Ast.IParameter<T & Ast.TParameterType> = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: Ast.NodeKind.Parameter,
            isLeaf: false,
            maybeOptionalConstant,
            name,
            maybeParameterType,
        };
        IParserStateUtils.endContext(state, parameter);

        const maybeCommaConstant: Option<Ast.Constant> = maybeReadTokenKindAsConstant(state, TokenKind.Comma);
        continueReadingValues = maybeCommaConstant !== undefined;

        const csv: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>> = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: Ast.NodeKind.Csv,
            isLeaf: false,
            node: parameter,
            maybeCommaConstant,
        };
        IParserStateUtils.endContext(state, csv);

        parameters.push(csv);
    }

    const parameterArray: Ast.ICsvArray<Ast.IParameter<T & Ast.TParameterType>> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: paramaterArrayNodeKind,
        elements: parameters,
        isLeaf: false,
    };
    IParserStateUtils.endContext(state, parameterArray);

    const rightParenthesisConstant: Ast.Constant = readTokenKindAsConstant(state, TokenKind.RightParenthesis);

    const astNode: Ast.IParameterList<T & Ast.TParameterType> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftParenthesisConstant,
        content: parameterArray,
        closeWrapperConstant: rightParenthesisConstant,
    };
    IParserStateUtils.endContext(state, astNode);
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
    IParserStateUtils.startContext(state, nodeKind);

    const openWrapperConstant: Ast.Constant = openConstantReader();
    const content: Content = contentReader();
    const closeWrapperConstant: Ast.Constant = closeConstantReader();

    let maybeOptionalConstant: Option<Ast.Constant>;
    if (allowOptionalConstant) {
        maybeOptionalConstant = maybeReadTokenKindAsConstant(state, TokenKind.QuestionMark);
    }

    const wrapped: WrappedRead<Kind, Content> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant,
        content,
        closeWrapperConstant,
        maybeOptionalConstant,
    };
    IParserStateUtils.endContext(state, (wrapped as unknown) as Ast.TWrapped);
    return wrapped;
}

// -------------------------------------------------------
// ---------- Helper functions (read functions) ----------
// -------------------------------------------------------

function readTokenKind(state: IParserState, tokenKind: TokenKind): string {
    const maybeErr: Option<ParseError.ExpectedTokenKindError> = IParserStateUtils.testIsOnTokenKind(state, tokenKind);
    if (maybeErr) {
        throw maybeErr;
    }

    return readToken(state);
}

function readIdentifierConstantAsConstant(
    state: IParserState,
    identifierConstant: Ast.IdentifierConstant,
): Ast.Constant {
    const maybeConstant: Option<Ast.Constant> = maybeReadIdentifierConstantAsConstant(state, identifierConstant);
    if (!maybeConstant) {
        const details: {} = { identifierConstant };
        throw new CommonError.InvariantError(`couldn't convert IdentifierConstant into ConstantKind`, details);
    }

    return maybeConstant;
}

function maybeReadIdentifierConstantAsConstant(
    state: IParserState,
    identifierConstant: Ast.IdentifierConstant,
): Option<Ast.Constant> {
    if (IParserStateUtils.isOnIdentifierConstant(state, identifierConstant)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParserStateUtils.startContext(state, nodeKind);

        const maybeConstantKind: Option<Ast.ConstantKind> = Ast.constantKindFromIdentifieConstant(identifierConstant);
        if (!maybeConstantKind) {
            const details: {} = { identifierConstant };
            throw new CommonError.InvariantError(`couldn't convert IdentifierConstant into ConstantKind`, details);
        }

        readToken(state);
        const astNode: Ast.Constant = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            literal: maybeConstantKind,
        };
        IParserStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function maybeReadLiteralAttributes(state: IParserState, parser: IParser<IParserState>): Option<Ast.RecordLiteral> {
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

// -------------------------------------------------------
// ---------- Helper functions (test functions) ----------
// -------------------------------------------------------

function testCsvContinuationDanglingCommaForBrace(
    state: IParserState,
): Option<ParseError.ExpectedCsvContinuationError> {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightBrace);
}

function testCsvContinuationDanglingCommaForBracket(
    state: IParserState,
): Option<ParseError.ExpectedCsvContinuationError> {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightBracket);
}

function testCsvContinuationDanglingCommaForParenthesis(
    state: IParserState,
): Option<ParseError.ExpectedCsvContinuationError> {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightParenthesis);
}
