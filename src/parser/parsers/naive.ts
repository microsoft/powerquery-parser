// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils, NodeIdMap, ParseContext, ParseContextUtils, ParseError } from "..";
import { CommonError, isNever, Result, ResultUtils, TypeUtils } from "../../common";
import { LexerSnapshot, Token, TokenKind } from "../../lexer";
import { BracketDisambiguation, IParser, ParenthesisDisambiguation, TriedParse } from "../IParser";
import { IParserState, IParserStateUtils } from "../IParserState";
import { NodeIdMapUtils } from "../nodeIdMap";
import { maybeReadTokenKindAsConstant, readBracketDisambiguation, readToken, readTokenKindAsConstant } from "./common";

type TriedReadPrimaryType = Result<
    Ast.TPrimaryType,
    ParseError.ExpectedAnyTokenKindError | ParseError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

type TriedReadPrimitiveType = Result<
    Ast.PrimitiveType,
    ParseError.ExpectedAnyTokenKindError | ParseError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

interface WrappedRead<Kind, Open, Content, Close> extends Ast.IWrapped<Kind, Open, Content, Close> {
    readonly maybeOptionalConstant: Ast.IConstant<Ast.MiscConstantKind.QuestionMark> | undefined;
}

const GeneralizedIdentifierTerminatorTokenKinds: ReadonlyArray<TokenKind> = [
    TokenKind.Comma,
    TokenKind.Equal,
    TokenKind.RightBracket,
];

// -------------------------------------------
// ---------- // 12.1.6 Identifiers ----------
// -------------------------------------------

export function readIdentifier<S = IParserState>(
    state: IParserState,
    _parser: IParser<S & IParserState>,
): Ast.Identifier {
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
export function readGeneralizedIdentifier<S = IParserState>(
    state: S & IParserState,
    _parser: IParser<S & IParserState>,
): Ast.GeneralizedIdentifier {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
    IParserStateUtils.startContext(state, nodeKind);

    let literal: string;
    let astNode: Ast.GeneralizedIdentifier;

    const tokenRangeStartIndex: number = state.tokenIndex;
    let tokenRangeEndIndex: number = tokenRangeStartIndex;
    while (
        state.maybeCurrentTokenKind &&
        GeneralizedIdentifierTerminatorTokenKinds.indexOf(state.maybeCurrentTokenKind) === -1
    ) {
        readToken(state);
        tokenRangeEndIndex = state.tokenIndex;
    }

    if (tokenRangeStartIndex === tokenRangeEndIndex) {
        throw new ParseError.ExpectedGeneralizedIdentifierError(
            state.localizationTemplates,
            IParserStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
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

export function readKeyword<S = IParserState>(
    state: IParserState,
    _parser: IParser<S & IParserState>,
): Ast.IdentifierExpression {
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

export function readDocument<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): TriedParse<S> {
    let triedReadDocument: Result<Ast.TDocument, Error>;

    // Try parsing as an Expression document first.
    // If Expression document fails (including UnusedTokensRemainError) then try parsing a SectionDocument.
    // If both fail then return the error which parsed more tokens.
    try {
        triedReadDocument = ResultUtils.okFactory(parser.readExpression(state, parser));
        const maybeErr: ParseError.UnusedTokensRemainError | undefined = IParserStateUtils.testNoMoreTokens(state);
        if (maybeErr) {
            throw maybeErr;
        }
    } catch (expressionError) {
        // Fast backup deletes context state, but we want to preserve it for the case
        // where both parsing an expression and section document error out.
        const expressionErrorStateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
        const expressionErrorContextState: ParseContext.State = state.contextState;

        // Reset the parser's state.
        state.tokenIndex = 0;
        state.contextState = ParseContextUtils.newState();
        state.maybeCurrentContextNode = undefined;

        if (state.lexerSnapshot.tokens.length) {
            state.maybeCurrentToken = state.lexerSnapshot.tokens[0];
            state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
        }

        try {
            triedReadDocument = ResultUtils.okFactory(readSectionDocument(state, parser));
            const maybeErr: ParseError.UnusedTokensRemainError | undefined = IParserStateUtils.testNoMoreTokens(state);
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
        let convertedError: ParseError.TParseError<S>;
        if (ParseError.isTInnerParseError(currentError)) {
            convertedError = new ParseError.ParseError(currentError, state);
        } else {
            convertedError = CommonError.ensureCommonError(state.localizationTemplates, currentError);
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

    const contextState: ParseContext.State = state.contextState;
    return ResultUtils.okFactory({
        ast: document,
        nodeIdMapCollection: contextState.nodeIdMapCollection,
        leafNodeIds: contextState.leafNodeIds,
        state,
    });
}

// ----------------------------------------------
// ---------- 12.2.2 Section Documents ----------
// ----------------------------------------------

export function readSectionDocument<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.Section {
    const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = maybeReadLiteralAttributes(state, parser);
    const sectionConstant: Ast.IConstant<Ast.KeywordConstantKind.Section> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordSection,
        Ast.KeywordConstantKind.Section,
    );

    let maybeName: Ast.Identifier | undefined;
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.Identifier)) {
        maybeName = parser.readIdentifier(state, parser);
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
    }

    const semicolonConstant: Ast.IConstant<Ast.MiscConstantKind.Semicolon> = readTokenKindAsConstant(
        state,
        TokenKind.Semicolon,
        Ast.MiscConstantKind.Semicolon,
    );
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

export function readSectionMembers<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
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

export function readSectionMember<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.SectionMember {
    const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = maybeReadLiteralAttributes(state, parser);
    const maybeSharedConstant: Ast.IConstant<Ast.KeywordConstantKind.Shared> | undefined = maybeReadTokenKindAsConstant(
        state,
        TokenKind.KeywordShared,
        Ast.KeywordConstantKind.Shared,
    );
    const namePairedExpression: Ast.IdentifierPairedExpression = parser.readIdentifierPairedExpression(state, parser);
    const semicolonConstant: Ast.IConstant<Ast.MiscConstantKind.Semicolon> = readTokenKindAsConstant(
        state,
        TokenKind.Semicolon,
        Ast.MiscConstantKind.Semicolon,
    );

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

export function readExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TExpression {
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

export function readLogicalExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TLogicalExpression {
    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.LogicalExpression,
        Ast.TLogicalExpression,
        Ast.LogicalOperatorKind,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.LogicalExpression,
        () => parser.readIsExpression(state, parser),
        maybeCurrentTokenKind => AstUtils.maybeLogicalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readIsExpression(state, parser),
    );
}

// --------------------------------------------
// ---------- 12.2.3.3 Is expression ----------
// --------------------------------------------

export function readIsExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TIsExpression {
    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.IsExpression,
        Ast.TAsExpression,
        Ast.KeywordConstantKind.Is,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.IsExpression,
        () => parser.readAsExpression(state, parser),
        maybeCurrentTokenKind =>
            maybeCurrentTokenKind === TokenKind.KeywordIs ? Ast.KeywordConstantKind.Is : undefined,
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

// sub-item of 12.2.3.3 Is expression
export function readNullablePrimitiveType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TNullablePrimitiveType {
    if (IParserStateUtils.isOnConstantKind(state, Ast.IdentifierConstantKind.Nullable)) {
        return readPairedConstant(
            state,
            Ast.NodeKind.NullablePrimitiveType,
            () => readConstantKind(state, Ast.IdentifierConstantKind.Nullable),
            () => parser.readPrimitiveType(state, parser),
        );
    } else {
        return parser.readPrimitiveType(state, parser);
    }
}

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

export function readAsExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TAsExpression {
    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.AsExpression,
        Ast.TEqualityExpression,
        Ast.KeywordConstantKind.As,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.AsExpression,
        () => parser.readEqualityExpression(state, parser),
        maybeCurrentTokenKind =>
            maybeCurrentTokenKind === TokenKind.KeywordAs ? Ast.KeywordConstantKind.As : undefined,
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

// --------------------------------------------------
// ---------- 12.2.3.5 Equality expression ----------
// --------------------------------------------------

export function readEqualityExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TEqualityExpression {
    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.EqualityExpression,
        Ast.TEqualityExpression,
        Ast.EqualityOperatorKind,
        Ast.TEqualityExpression
    >(
        state,
        Ast.NodeKind.EqualityExpression,
        () => parser.readRelationalExpression(state, parser),
        maybeCurrentTokenKind => AstUtils.maybeEqualityOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readRelationalExpression(state, parser),
    );
}

// ----------------------------------------------------
// ---------- 12.2.3.6 Relational expression ----------
// ----------------------------------------------------

export function readRelationalExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TRelationalExpression {
    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.RelationalExpression,
        Ast.TArithmeticExpression,
        Ast.RelationalOperatorKind,
        Ast.TArithmeticExpression
    >(
        state,
        Ast.NodeKind.RelationalExpression,
        () => parser.readArithmeticExpression(state, parser),
        maybeCurrentTokenKind => AstUtils.maybeRelationalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readArithmeticExpression(state, parser),
    );
}

// -----------------------------------------------------
// ---------- 12.2.3.7 Arithmetic expressions ----------
// -----------------------------------------------------

export function readArithmeticExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TArithmeticExpression {
    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.ArithmeticExpression,
        Ast.TMetadataExpression,
        Ast.ArithmeticOperatorKind,
        Ast.TMetadataExpression
    >(
        state,
        Ast.NodeKind.ArithmeticExpression,
        () => parser.readMetadataExpression(state, parser),
        maybeCurrentTokenKind => AstUtils.maybeArithmeticOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readMetadataExpression(state, parser),
    );
}

// --------------------------------------------------
// ---------- 12.2.3.8 Metadata expression ----------
// --------------------------------------------------

export function readMetadataExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TMetadataExpression {
    const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const left: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);
    const maybeMetaConstant: Ast.IConstant<Ast.KeywordConstantKind.Meta> | undefined = maybeReadTokenKindAsConstant(
        state,
        TokenKind.KeywordMeta,
        Ast.KeywordConstantKind.Meta,
    );

    if (maybeMetaConstant !== undefined) {
        const operatorConstant: Ast.IConstant<Ast.KeywordConstantKind.Meta> = maybeMetaConstant;
        const right: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);

        const astNode: Ast.MetadataExpression = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
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

export function readUnaryExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TUnaryExpression {
    let maybeOperator: Ast.UnaryOperatorKind | undefined = AstUtils.maybeUnaryOperatorKindFrom(
        state.maybeCurrentTokenKind,
    );
    if (maybeOperator === undefined) {
        return parser.readTypeExpression(state, parser);
    }

    const unaryNodeKind: Ast.NodeKind.UnaryExpression = Ast.NodeKind.UnaryExpression;
    IParserStateUtils.startContext(state, unaryNodeKind);

    const arrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, arrayNodeKind);

    const operatorConstants: Ast.IConstant<Ast.UnaryOperatorKind>[] = [];
    while (maybeOperator) {
        operatorConstants.push(readTokenKindAsConstant(state, state.maybeCurrentTokenKind as TokenKind, maybeOperator));
        maybeOperator = AstUtils.maybeUnaryOperatorKindFrom(state.maybeCurrentTokenKind);
    }
    const operators: Ast.IArrayWrapper<Ast.IConstant<Ast.UnaryOperatorKind>> = {
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

export function readPrimaryExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TPrimaryExpression {
    let primaryExpression: Ast.TPrimaryExpression | undefined;
    const maybeCurrentTokenKind: TokenKind | undefined = state.maybeCurrentTokenKind;
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

export function readRecursivePrimaryExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
    head: Ast.TPrimaryExpression,
): Ast.RecursivePrimaryExpression {
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
    IParserStateUtils.startContext(state, nodeKind);

    // The head of the recursive primary expression is created before the recursive primary expression,
    // meaning the parent/child mapping for contexts are in reverse order.
    // The clean up for that happens here.
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    if (state.maybeCurrentContextNode === undefined) {
        throw new CommonError.InvariantError(`maybeCurrentContextNode should be truthy`);
    }
    const currentContextNode: ParseContext.Node = state.maybeCurrentContextNode;

    const maybeHeadParentId: number | undefined = nodeIdMapCollection.parentIdById.get(head.id);
    if (maybeHeadParentId !== undefined) {
        const headParentId: number = maybeHeadParentId;

        // Remove head as a child of its current parent.
        const parentChildIds: ReadonlyArray<number> = NodeIdMapUtils.expectChildIds(
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
    const mutableContext: TypeUtils.StripReadonly<ParseContext.Node> = currentContextNode;
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
        const maybeCurrentTokenKind: TokenKind | undefined = state.maybeCurrentTokenKind;

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

export function readLiteralExpression<S = IParserState>(
    state: IParserState,
    _parser: IParser<S & IParserState>,
): Ast.LiteralExpression {
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
    const maybeErr: ParseError.ExpectedAnyTokenKindError | undefined = IParserStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    const maybeLiteralKind: Ast.LiteralKind | undefined = AstUtils.maybeLiteralKindFrom(state.maybeCurrentTokenKind);
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

export function readIdentifierExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeInclusiveConstant: Ast.IConstant<Ast.MiscConstantKind.AtSign> | undefined = maybeReadTokenKindAsConstant(
        state,
        TokenKind.AtSign,
        Ast.MiscConstantKind.AtSign,
    );
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

export function readParenthesizedExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.ParenthesizedExpression {
    return readWrapped(
        state,
        Ast.NodeKind.ParenthesizedExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftParenthesis, Ast.WrapperConstantKind.LeftParenthesis),
        () => parser.readExpression(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightParenthesis, Ast.WrapperConstantKind.RightParenthesis),
        false,
    );
}

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

export function readNotImplementedExpression<S = IParserState>(
    state: S & IParserState,
    _parser: IParser<S & IParserState>,
): Ast.NotImplementedExpression {
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const ellipsisConstant: Ast.IConstant<Ast.MiscConstantKind.Ellipsis> = readTokenKindAsConstant(
        state,
        TokenKind.Ellipsis,
        Ast.MiscConstantKind.Ellipsis,
    );

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

export function readInvokeExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.InvokeExpression {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightParenthesis);
    return readWrapped(
        state,
        Ast.NodeKind.InvokeExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftParenthesis, Ast.WrapperConstantKind.LeftParenthesis),
        () =>
            // The type inference in VSCode considers the lambda below a type error, but it compiles just fine.
            // I'm adding an explicit type to stop it from (incorrectly) saying it's an error.
            readCsvArray<S, Ast.TExpression>(
                state,
                () => parser.readExpression(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForParenthesis,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightParenthesis, Ast.WrapperConstantKind.RightParenthesis),
        false,
    );
}

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

export function readListExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.ListExpression {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBrace);
    return readWrapped(
        state,
        Ast.NodeKind.ListExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Ast.WrapperConstantKind.LeftBrace),
        () =>
            readCsvArray<S, Ast.TListItem>(
                state,
                () => parser.readListItem(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace, Ast.WrapperConstantKind.RightBrace),
        false,
    );
}

export function readListItem<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TListItem {
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const left: Ast.TExpression = parser.readExpression(state, parser);
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.DotDot)) {
        const rangeConstant: Ast.IConstant<Ast.MiscConstantKind.DotDot> = readTokenKindAsConstant(
            state,
            TokenKind.DotDot,
            Ast.MiscConstantKind.DotDot,
        );
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

// -------------------------------------------------
// ---------- 12.2.3.18 Record expression ----------
// -------------------------------------------------

export function readRecordExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.RecordExpression {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBracket);
    return readWrapped(
        state,
        Ast.NodeKind.RecordExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Ast.WrapperConstantKind.LeftBracket),
        () =>
            parser.readGeneralizedIdentifierPairedExpressions(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket, Ast.WrapperConstantKind.RightBracket),
        false,
    );
}

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

export function readItemAccessExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.ItemAccessExpression {
    return readWrapped(
        state,
        Ast.NodeKind.ItemAccessExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Ast.WrapperConstantKind.LeftBrace),
        () => parser.readExpression(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace, Ast.WrapperConstantKind.RightBrace),
        true,
    );
}

// -------------------------------------------------------
// ---------- 12.2.3.20 Field access expression ----------
// -------------------------------------------------------

export function readFieldSelection<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.FieldSelector {
    return readFieldSelector(state, parser, true);
}

export function readFieldProjection<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.FieldProjection {
    return readWrapped(
        state,
        Ast.NodeKind.FieldProjection,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Ast.WrapperConstantKind.LeftBracket),
        () =>
            readCsvArray(
                state,
                () => parser.readFieldSelector(state, parser, false),
                true,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket, Ast.WrapperConstantKind.RightBracket),
        true,
    );
}

export function readFieldSelector<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
    allowOptional: boolean,
): Ast.FieldSelector {
    return readWrapped(
        state,
        Ast.NodeKind.FieldSelector,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Ast.WrapperConstantKind.LeftBracket),
        () => parser.readGeneralizedIdentifier(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket, Ast.WrapperConstantKind.RightBracket),
        allowOptional,
    );
}

// ---------------------------------------------------
// ---------- 12.2.3.21 Function expression ----------
// ---------------------------------------------------

export function readFunctionExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.FunctionExpression {
    const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const parameters: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = parser.readParameterList(
        state,
        parser,
    );
    const maybeFunctionReturnType: Ast.AsNullablePrimitiveType | undefined = maybeReadAsNullablePrimitiveType(
        state,
        parser,
    );
    const fatArrowConstant: Ast.IConstant<Ast.MiscConstantKind.FatArrow> = readTokenKindAsConstant(
        state,
        TokenKind.FatArrow,
        Ast.MiscConstantKind.FatArrow,
    );
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

export function readParameterList<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> {
    return genericReadParameterList(state, parser, () => maybeReadAsNullablePrimitiveType(state, parser));
}

function maybeReadAsNullablePrimitiveType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.AsNullablePrimitiveType | undefined {
    return maybeReadPairedConstant(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs, Ast.KeywordConstantKind.As),
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

export function readAsType<S = IParserState>(state: S & IParserState, parser: IParser<S & IParserState>): Ast.AsType {
    return readPairedConstant(
        state,
        Ast.NodeKind.AsType,
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs, Ast.KeywordConstantKind.As),
        () => parser.readType(state, parser),
    );
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

export function readEachExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.EachExpression {
    return readPairedConstant(
        state,
        Ast.NodeKind.EachExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordEach, Ast.KeywordConstantKind.Each),
        () => parser.readExpression(state, parser),
    );
}

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

export function readLetExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.LetExpression {
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const letConstant: Ast.IConstant<Ast.KeywordConstantKind.Let> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordLet,
        Ast.KeywordConstantKind.Let,
    );
    const identifierExpressionPairedExpressions: Ast.ICsvArray<Ast.IdentifierPairedExpression> = parser.readIdentifierPairedExpressions(
        state,
        parser,
        !IParserStateUtils.isNextTokenKind(state, TokenKind.KeywordIn),
        IParserStateUtils.testCsvContinuationLetExpression,
    );
    const inConstant: Ast.IConstant<Ast.KeywordConstantKind.In> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordIn,
        Ast.KeywordConstantKind.In,
    );
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

export function readIfExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.IfExpression {
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const ifConstant: Ast.IConstant<Ast.KeywordConstantKind.If> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordIf,
        Ast.KeywordConstantKind.If,
    );
    const condition: Ast.TExpression = parser.readExpression(state, parser);

    const thenConstant: Ast.IConstant<Ast.KeywordConstantKind.Then> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordThen,
        Ast.KeywordConstantKind.Then,
    );
    const trueExpression: Ast.TExpression = parser.readExpression(state, parser);

    const elseConstant: Ast.IConstant<Ast.KeywordConstantKind.Else> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordElse,
        Ast.KeywordConstantKind.Else,
    );
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

export function readTypeExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TTypeExpression {
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordType)) {
        return readPairedConstant(
            state,
            Ast.NodeKind.TypePrimaryType,
            () => readTokenKindAsConstant(state, TokenKind.KeywordType, Ast.KeywordConstantKind.Type),
            () => parser.readPrimaryType(state, parser),
        );
    } else {
        return parser.readPrimaryExpression(state, parser);
    }
}

export function readType<S = IParserState>(state: S & IParserState, parser: IParser<S & IParserState>): Ast.TType {
    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);

    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        return parser.readPrimaryExpression(state, parser);
    }
}

export function readPrimaryType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TPrimaryType {
    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);

    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        throw triedReadPrimaryType.error;
    }
}

export function readRecordType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.RecordType {
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

export function readTableType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TableType {
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;
    IParserStateUtils.startContext(state, nodeKind);

    const tableConstant: Ast.IConstant<Ast.PrimitiveTypeConstantKind.Table> = readConstantKind(
        state,
        Ast.PrimitiveTypeConstantKind.Table,
    );
    const maybeCurrentTokenKind: TokenKind | undefined = state.maybeCurrentTokenKind;
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

export function readFieldSpecificationList<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
    allowOpenMarker: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.FieldSpecificationList {
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;
    IParserStateUtils.startContext(state, nodeKind);

    const leftBracketConstant: Ast.IConstant<Ast.WrapperConstantKind.LeftBracket> = readTokenKindAsConstant(
        state,
        TokenKind.LeftBracket,
        Ast.WrapperConstantKind.LeftBracket,
    );
    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = true;
    let maybeOpenRecordMarkerConstant: Ast.IConstant<Ast.MiscConstantKind.Ellipsis> | undefined = undefined;

    const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, fieldArrayNodeKind);

    while (continueReadingValues) {
        const maybeErr: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        if (IParserStateUtils.isOnTokenKind(state, TokenKind.Ellipsis)) {
            if (allowOpenMarker) {
                if (maybeOpenRecordMarkerConstant) {
                    throw fieldSpecificationListReadError(state, false);
                } else {
                    maybeOpenRecordMarkerConstant = readTokenKindAsConstant(
                        state,
                        TokenKind.Ellipsis,
                        Ast.MiscConstantKind.Ellipsis,
                    );
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

            const maybeOptionalConstant:
                | Ast.IConstant<Ast.IdentifierConstantKind.Optional>
                | undefined = maybeReadConstantKind(state, Ast.IdentifierConstantKind.Optional);

            const name: Ast.GeneralizedIdentifier = parser.readGeneralizedIdentifier(state, parser);

            const maybeFieldTypeSpecification: Ast.FieldTypeSpecification | undefined = maybeReadFieldTypeSpecification(
                state,
                parser,
            );

            const maybeCommaConstant:
                | Ast.IConstant<Ast.MiscConstantKind.Comma>
                | undefined = maybeReadTokenKindAsConstant(state, TokenKind.Comma, Ast.MiscConstantKind.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            const field: Ast.FieldSpecification = {
                ...IParserStateUtils.expectContextNodeMetadata(state),
                kind: fieldSpecificationNodeKind,
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeFieldTypeSpecification,
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

    const rightBracketConstant: Ast.IConstant<Ast.WrapperConstantKind.RightBracket> = readTokenKindAsConstant(
        state,
        TokenKind.RightBracket,
        Ast.WrapperConstantKind.RightBracket,
    );

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

function maybeReadFieldTypeSpecification<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.FieldTypeSpecification | undefined {
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeEqualConstant: Ast.IConstant<Ast.MiscConstantKind.Equal> | undefined = maybeReadTokenKindAsConstant(
        state,
        TokenKind.Equal,
        Ast.MiscConstantKind.Equal,
    );
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

function fieldSpecificationListReadError(state: IParserState, allowOpenMarker: boolean): Error | undefined {
    if (allowOpenMarker) {
        const expectedTokenKinds: ReadonlyArray<TokenKind> = [TokenKind.Identifier, TokenKind.Ellipsis];
        return IParserStateUtils.testIsOnAnyTokenKind(state, expectedTokenKinds);
    } else {
        return IParserStateUtils.testIsOnTokenKind(state, TokenKind.Identifier);
    }
}

export function readListType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.ListType {
    return readWrapped(
        state,
        Ast.NodeKind.ListType,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Ast.WrapperConstantKind.LeftBrace),
        () => parser.readType(state, parser),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace, Ast.WrapperConstantKind.RightBrace),
        false,
    );
}

export function readFunctionType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.FunctionType {
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
    IParserStateUtils.startContext(state, nodeKind);

    const functionConstant: Ast.IConstant<Ast.PrimitiveTypeConstantKind.Function> = readConstantKind(
        state,
        Ast.PrimitiveTypeConstantKind.Function,
    );
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

function tryReadPrimaryType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): TriedReadPrimaryType {
    const isTableTypeNext: boolean =
        IParserStateUtils.isOnConstantKind(state, Ast.PrimitiveTypeConstantKind.Table) &&
        (IParserStateUtils.isNextTokenKind(state, TokenKind.LeftBracket) ||
            IParserStateUtils.isNextTokenKind(state, TokenKind.LeftParenthesis) ||
            IParserStateUtils.isNextTokenKind(state, TokenKind.AtSign) ||
            IParserStateUtils.isNextTokenKind(state, TokenKind.Identifier));
    const isFunctionTypeNext: boolean =
        IParserStateUtils.isOnConstantKind(state, Ast.PrimitiveTypeConstantKind.Function) &&
        IParserStateUtils.isNextTokenKind(state, TokenKind.LeftParenthesis);

    if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        return ResultUtils.okFactory(parser.readRecordType(state, parser));
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBrace)) {
        return ResultUtils.okFactory(parser.readListType(state, parser));
    } else if (isTableTypeNext) {
        return ResultUtils.okFactory(parser.readTableType(state, parser));
    } else if (isFunctionTypeNext) {
        return ResultUtils.okFactory(parser.readFunctionType(state, parser));
    } else if (IParserStateUtils.isOnConstantKind(state, Ast.IdentifierConstantKind.Nullable)) {
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

export function readParameterSpecificationList<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.IParameterList<Ast.AsType> {
    return genericReadParameterList(state, parser, () => parser.readAsType(state, parser));
}

export function readNullableType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.NullableType {
    return readPairedConstant(
        state,
        Ast.NodeKind.NullableType,
        () => readConstantKind(state, Ast.IdentifierConstantKind.Nullable),
        () => parser.readType(state, parser),
    );
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export function readErrorRaisingExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.ErrorRaisingExpression {
    return readPairedConstant(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordError, Ast.KeywordConstantKind.Error),
        () => parser.readExpression(state, parser),
    );
}

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

export function readErrorHandlingExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.ErrorHandlingExpression {
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const tryConstant: Ast.IConstant<Ast.KeywordConstantKind.Try> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordTry,
        Ast.KeywordConstantKind.Try,
    );
    const protectedExpression: Ast.TExpression = parser.readExpression(state, parser);

    const otherwiseExpressionNodeKind: Ast.NodeKind.OtherwiseExpression = Ast.NodeKind.OtherwiseExpression;
    const maybeOtherwiseExpression: Ast.OtherwiseExpression | undefined = maybeReadPairedConstant(
        state,
        otherwiseExpressionNodeKind,
        () => IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordOtherwise),
        () => readTokenKindAsConstant(state, TokenKind.KeywordOtherwise, Ast.KeywordConstantKind.Otherwise),
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

export function readRecordLiteral<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.RecordLiteral {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBracket);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.RecordLiteral,
        Ast.WrapperConstantKind.LeftBracket,
        Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>,
        Ast.WrapperConstantKind.RightBracket
    > = readWrapped(
        state,
        Ast.NodeKind.RecordLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Ast.WrapperConstantKind.LeftBracket),
        () =>
            parser.readFieldNamePairedAnyLiterals(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket, Ast.WrapperConstantKind.RightBracket),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.Record,
        ...wrappedRead,
    };
}

export function readFieldNamePairedAnyLiterals<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> {
    return readCsvArray(
        state,
        () =>
            readKeyValuePair<
                S,
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

export function readListLiteral<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.ListLiteral {
    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, TokenKind.RightBrace);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.ListLiteral,
        Ast.WrapperConstantKind.LeftBrace,
        Ast.ICsvArray<Ast.TAnyLiteral>,
        Ast.WrapperConstantKind.RightBrace
    > = readWrapped(
        state,
        Ast.NodeKind.ListLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Ast.WrapperConstantKind.LeftBrace),
        () =>
            readCsvArray<S, Ast.TAnyLiteral>(
                state,
                () => parser.readAnyLiteral(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace, Ast.WrapperConstantKind.RightBrace),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.List,
        ...wrappedRead,
    };
}

export function readAnyLiteral<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.TAnyLiteral {
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.LeftBrace)) {
        return parser.readListLiteral(state, parser);
    } else {
        return parser.readLiteralExpression(state, parser);
    }
}

export function readPrimitiveType<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.PrimitiveType {
    const triedReadPrimitiveType: TriedReadPrimitiveType = tryReadPrimitiveType(state, parser);
    if (ResultUtils.isOk(triedReadPrimitiveType)) {
        return triedReadPrimitiveType.value;
    } else {
        throw triedReadPrimitiveType.error;
    }
}

function tryReadPrimitiveType<S = IParserState>(
    state: S & IParserState,
    _parser: IParser<S & IParserState>,
): TriedReadPrimitiveType {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
    IParserStateUtils.startContext(state, nodeKind);

    const stateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.Identifier,
        TokenKind.KeywordType,
        TokenKind.NullLiteral,
    ];
    const maybeErr: ParseError.ExpectedAnyTokenKindError | undefined = IParserStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeErr) {
        const error: ParseError.ExpectedAnyTokenKindError = maybeErr;
        return ResultUtils.errFactory(error);
    }

    let primitiveType: Ast.IConstant<Ast.PrimitiveTypeConstantKind>;
    if (IParserStateUtils.isOnTokenKind(state, TokenKind.Identifier)) {
        const currentTokenData: string = state.lexerSnapshot.tokens[state.tokenIndex].data;
        switch (currentTokenData) {
            case Ast.PrimitiveTypeConstantKind.Action:
            case Ast.PrimitiveTypeConstantKind.Any:
            case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            case Ast.PrimitiveTypeConstantKind.Binary:
            case Ast.PrimitiveTypeConstantKind.Date:
            case Ast.PrimitiveTypeConstantKind.DateTime:
            case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            case Ast.PrimitiveTypeConstantKind.Duration:
            case Ast.PrimitiveTypeConstantKind.Function:
            case Ast.PrimitiveTypeConstantKind.List:
            case Ast.PrimitiveTypeConstantKind.Logical:
            case Ast.PrimitiveTypeConstantKind.None:
            case Ast.PrimitiveTypeConstantKind.Number:
            case Ast.PrimitiveTypeConstantKind.Record:
            case Ast.PrimitiveTypeConstantKind.Table:
            case Ast.PrimitiveTypeConstantKind.Text:
            case Ast.PrimitiveTypeConstantKind.Time:
                primitiveType = readConstantKind(state, currentTokenData);
                break;

            default:
                const token: Token = IParserStateUtils.expectTokenAt(state, state.tokenIndex);
                IParserStateUtils.applyFastStateBackup(state, stateBackup);
                return ResultUtils.errFactory(
                    new ParseError.InvalidPrimitiveTypeError(
                        state.localizationTemplates,
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                    ),
                );
        }
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.KeywordType)) {
        primitiveType = readTokenKindAsConstant(state, TokenKind.KeywordType, Ast.PrimitiveTypeConstantKind.Type);
    } else if (IParserStateUtils.isOnTokenKind(state, TokenKind.NullLiteral)) {
        primitiveType = readTokenKindAsConstant(state, TokenKind.NullLiteral, Ast.PrimitiveTypeConstantKind.Null);
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

export function disambiguateParenthesis<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
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
            // '(x as number) as number' could either be either case,
            // so we need to consume test if the trailing 'as number' is followed by a FatArrow.
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

export function disambiguateBracket<S = IParserState>(
    state: S & IParserState,
    _parser: IParser<S & IParserState>,
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

export function readIdentifierPairedExpressions<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.IdentifierPairedExpression> {
    return readCsvArray(
        state,
        () => parser.readIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpressions<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> {
    return readCsvArray(
        state,
        () => parser.readGeneralizedIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.GeneralizedIdentifierPairedExpression {
    return readKeyValuePair<
        S,
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

export function readIdentifierPairedExpression<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.IdentifierPairedExpression {
    return readKeyValuePair<S, Ast.NodeKind.IdentifierPairedExpression, Ast.Identifier, Ast.TExpression>(
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
function recursiveReadBinOpExpression<S, Kind, Left, Operator, Right>(
    state: S & IParserState,
    nodeKind: Kind & Ast.TBinOpExpressionNodeKind,
    leftReader: () => Left,
    maybeOperatorFrom: (tokenKind: TokenKind | undefined) => (Operator & Ast.TBinOpExpressionOperator) | undefined,
    rightReader: () => Right,
): Left | Ast.IBinOpExpression<Kind, Left, Operator, Right> {
    IParserStateUtils.startContext(state, nodeKind);
    const left: Left = leftReader();

    // If no operator, return Left
    const maybeOperator: (Operator & Ast.TBinOpExpressionOperator) | undefined = maybeOperatorFrom(
        state.maybeCurrentTokenKind,
    );
    if (maybeOperator === undefined) {
        IParserStateUtils.deleteContext(state, undefined);
        return left;
    }
    const operatorConstant: Ast.TConstant & Ast.IConstant<Operator & Ast.TConstantKind> = readTokenKindAsConstant(
        state,
        state.maybeCurrentTokenKind!,
        maybeOperator,
    );
    const right: Right | Ast.IBinOpExpression<Kind, Right, Operator, Right> = recursiveReadBinOpExpressionHelper<
        S,
        Kind,
        Operator,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const astNode: Ast.IBinOpExpression<Kind, Left, Operator, Right> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left,
        operatorConstant,
        right,
    };
    IParserStateUtils.endContext(state, (astNode as unknown) as Ast.TNode);

    return astNode;
}

// Given the string `1 + 2 + 3` the function will recursively parse 2 Ast nodes,
// where their TokenRange's are represented by brackets:
// 1 + [2 + [3]]
function recursiveReadBinOpExpressionHelper<S, Kind, Operator, Right>(
    state: S & IParserState,
    nodeKind: Kind & Ast.TBinOpExpressionNodeKind,
    maybeOperatorFrom: (tokenKind: TokenKind | undefined) => (Operator & Ast.TBinOpExpressionOperator) | undefined,
    rightReader: () => Right,
): Right | Ast.IBinOpExpression<Kind, Right, Operator, Right> {
    IParserStateUtils.startContext(state, nodeKind);
    const rightAsLeft: Right = rightReader();

    const maybeOperator: (Operator & Ast.TBinOpExpressionOperator) | undefined = maybeOperatorFrom(
        state.maybeCurrentTokenKind,
    );
    if (maybeOperator === undefined) {
        IParserStateUtils.deleteContext(state, undefined);
        return rightAsLeft;
    }
    const operatorConstant: Ast.TConstant & Ast.IConstant<Operator & Ast.TConstantKind> = readTokenKindAsConstant(
        state,
        state.maybeCurrentTokenKind!,
        maybeOperator,
    );
    const right: Right | Ast.IBinOpExpression<Kind, Right, Operator, Right> = recursiveReadBinOpExpressionHelper<
        S,
        Kind,
        Operator,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const astNode: Ast.IBinOpExpression<Kind, Right, Operator, Right> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left: rightAsLeft,
        operatorConstant,
        right,
    };
    IParserStateUtils.endContext(state, (astNode as unknown) as Ast.TNode);

    return astNode;
}

function readCsvArray<S, T>(
    state: S & IParserState,
    valueReader: () => T & Ast.TCsvType,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.TCsvArray & Ast.ICsvArray<T & Ast.TCsvType> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, nodeKind);

    const elements: Ast.ICsv<T & Ast.TCsvType>[] = [];

    while (continueReadingValues) {
        const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
        IParserStateUtils.startContext(state, csvNodeKind);

        const maybeErr: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const node: T & Ast.TCsvType = valueReader();
        const maybeCommaConstant: Ast.IConstant<Ast.MiscConstantKind.Comma> | undefined = maybeReadTokenKindAsConstant(
            state,
            TokenKind.Comma,
            Ast.MiscConstantKind.Comma,
        );

        const element: Ast.TCsv & Ast.ICsv<T & Ast.TCsvType> = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: csvNodeKind,
            isLeaf: false,
            node,
            maybeCommaConstant,
        };
        IParserStateUtils.endContext(state, element);
        elements.push(element);

        continueReadingValues = maybeCommaConstant !== undefined;
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

function readKeyValuePair<S, Kind, Key, Value>(
    state: S & IParserState,
    nodeKind: Kind & Ast.TKeyValuePairNodeKind,
    keyReader: () => Key,
    valueReader: () => Value,
): Ast.IKeyValuePair<Kind, Key, Value> {
    IParserStateUtils.startContext(state, nodeKind);

    const key: Key = keyReader();
    const equalConstant: Ast.IConstant<Ast.MiscConstantKind.Equal> = readTokenKindAsConstant(
        state,
        TokenKind.Equal,
        Ast.MiscConstantKind.Equal,
    );
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

function readPairedConstant<S, Kind, ConstantKind, Paired>(
    state: S & IParserState,
    nodeKind: Kind & Ast.TPairedConstantNodeKind,
    constantReader: () => Ast.TConstant & Ast.IConstant<Ast.TConstantKind & ConstantKind>,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, ConstantKind, Paired> {
    IParserStateUtils.startContext(state, nodeKind);

    const constant: Ast.TConstant & Ast.IConstant<Ast.TConstantKind & ConstantKind> = constantReader();
    const paired: Paired = pairedReader();

    const pairedConstant: Ast.IPairedConstant<Kind, ConstantKind, Paired> = {
        ...IParserStateUtils.expectContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        constant,
        paired,
    };

    IParserStateUtils.endContext(state, (pairedConstant as unknown) as Ast.TPairedConstant);

    return pairedConstant;
}

function maybeReadPairedConstant<S, Kind, ConstantKind, Paired>(
    state: S & IParserState,
    nodeKind: Kind & Ast.TPairedConstantNodeKind,
    condition: () => boolean,
    constantReader: () => Ast.TConstant & Ast.IConstant<Ast.TConstantKind & ConstantKind>,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, ConstantKind, Paired> | undefined {
    if (condition()) {
        return readPairedConstant<S, Kind, ConstantKind, Paired>(state, nodeKind, constantReader, pairedReader);
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function genericReadParameterList<S, T>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
    typeReader: () => T & Ast.TParameterType,
): Ast.IParameterList<T> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;
    IParserStateUtils.startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.IConstant<Ast.WrapperConstantKind.LeftParenthesis> = readTokenKindAsConstant(
        state,
        TokenKind.LeftParenthesis,
        Ast.WrapperConstantKind.LeftParenthesis,
    );
    let continueReadingValues: boolean = !IParserStateUtils.isOnTokenKind(state, TokenKind.RightParenthesis);
    let reachedOptionalParameter: boolean = false;

    const paramterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, paramterArrayNodeKind);

    const parameters: Ast.ICsv<Ast.IParameter<T & Ast.TParameterType>>[] = [];
    while (continueReadingValues) {
        IParserStateUtils.startContext(state, Ast.NodeKind.Csv);
        IParserStateUtils.startContext(state, Ast.NodeKind.Parameter);

        const maybeErr: ParseError.TInnerParseError | undefined = testCsvContinuationDanglingCommaForParenthesis(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const maybeOptionalConstant:
            | Ast.IConstant<Ast.IdentifierConstantKind.Optional>
            | undefined = maybeReadConstantKind(state, Ast.IdentifierConstantKind.Optional);

        if (reachedOptionalParameter && !maybeOptionalConstant) {
            const token: Token = IParserStateUtils.expectTokenAt(state, state.tokenIndex);
            throw new ParseError.RequiredParameterAfterOptionalParameterError(
                state.localizationTemplates,
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

        const maybeCommaConstant: Ast.IConstant<Ast.MiscConstantKind.Comma> | undefined = maybeReadTokenKindAsConstant(
            state,
            TokenKind.Comma,
            Ast.MiscConstantKind.Comma,
        );
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
        kind: paramterArrayNodeKind,
        elements: parameters,
        isLeaf: false,
    };
    IParserStateUtils.endContext(state, parameterArray);

    const rightParenthesisConstant: Ast.IConstant<Ast.WrapperConstantKind.RightParenthesis> = readTokenKindAsConstant(
        state,
        TokenKind.RightParenthesis,
        Ast.WrapperConstantKind.RightParenthesis,
    );

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

function readWrapped<S, Kind, Open, Content, Close>(
    state: S & IParserState,
    nodeKind: Kind & Ast.TWrappedNodeKind,
    openConstantReader: () => Ast.IConstant<Open>,
    contentReader: () => Content,
    closeConstantReader: () => Ast.IConstant<Close>,
    allowOptionalConstant: boolean,
): WrappedRead<Kind, Open, Content, Close> {
    IParserStateUtils.startContext(state, nodeKind);

    const openWrapperConstant: Ast.IConstant<Open> = openConstantReader();
    const content: Content = contentReader();
    const closeWrapperConstant: Ast.IConstant<Close> = closeConstantReader();

    let maybeOptionalConstant: Ast.IConstant<Ast.MiscConstantKind.QuestionMark> | undefined;
    if (allowOptionalConstant) {
        maybeOptionalConstant = maybeReadTokenKindAsConstant(
            state,
            TokenKind.QuestionMark,
            Ast.MiscConstantKind.QuestionMark,
        );
    }

    const wrapped: WrappedRead<Kind, Open, Content, Close> = {
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
    const maybeErr: ParseError.ExpectedTokenKindError | undefined = IParserStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    return readToken(state);
}

function readConstantKind<S, C>(
    state: S & IParserState,
    constantKind: C & Ast.TConstantKind,
): Ast.TConstant & Ast.IConstant<C> {
    const maybeConstant: (Ast.TConstant & Ast.IConstant<C>) | undefined = maybeReadConstantKind(state, constantKind);
    if (!maybeConstant) {
        const details: {} = { constantKind };
        throw new CommonError.InvariantError(`couldn't convert constantKind`, details);
    }

    return maybeConstant;
}

function maybeReadConstantKind<S, C>(
    state: S & IParserState,
    constantKind: C & Ast.TConstantKind,
): (Ast.TConstant & Ast.IConstant<C>) | undefined {
    if (IParserStateUtils.isOnConstantKind(state, constantKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParserStateUtils.startContext(state, nodeKind);

        readToken(state);
        const astNode: Ast.TConstant & Ast.IConstant<C> = {
            ...IParserStateUtils.expectContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            constantKind,
        };
        IParserStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function maybeReadLiteralAttributes<S = IParserState>(
    state: S & IParserState,
    parser: IParser<S & IParserState>,
): Ast.RecordLiteral | undefined {
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

function testCsvContinuationDanglingCommaForBrace<S = IParserState>(
    state: S & IParserState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightBrace);
}

function testCsvContinuationDanglingCommaForBracket<S = IParserState>(
    state: S & IParserState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightBracket);
}

function testCsvContinuationDanglingCommaForParenthesis<S = IParserState>(
    state: S & IParserState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightParenthesis);
}
