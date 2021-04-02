// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, ParseContext, ParseContextUtils, ParseError } from "..";
import {
    ArrayUtils,
    Assert,
    CommonError,
    MapUtils,
    Result,
    ResultUtils,
    StringUtils,
    TypeScriptUtils,
} from "../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { Disambiguation, DisambiguationUtils } from "../disambiguation";
import { IParser, IParseStateCheckpoint } from "../IParser";
import { IParseState, IParseStateUtils } from "../IParseState";
import { NodeIdMapUtils } from "../nodeIdMap";

type TriedReadPrimaryType = Result<
    Ast.TPrimaryType,
    ParseError.ExpectedAnyTokenKindError | ParseError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

type TriedReadPrimitiveType = Result<
    Ast.PrimitiveType,
    ParseError.ExpectedAnyTokenKindError | ParseError.InvalidPrimitiveTypeError | CommonError.InvariantError
>;

interface WrappedRead<
    Kind extends Ast.TWrappedNodeKind,
    Open extends Constant.WrapperConstantKind,
    Content,
    Close extends Constant.WrapperConstantKind
> extends Ast.IWrapped<Kind, Open, Content, Close> {
    readonly maybeOptionalConstant: Ast.IConstant<Constant.MiscConstantKind.QuestionMark> | undefined;
}

const GeneralizedIdentifierTerminatorTokenKinds: ReadonlyArray<Token.TokenKind> = [
    Token.TokenKind.Comma,
    Token.TokenKind.Equal,
    Token.TokenKind.RightBracket,
];

// ----------------------------------------
// ---------- 12.1.6 Identifiers ----------
// ----------------------------------------

export function readIdentifier<S extends IParseState = IParseState>(
    state: IParseState,
    _parser: IParser<S>,
): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    IParseStateUtils.startContext(state, nodeKind);

    const literal: string = readTokenKind(state, Token.TokenKind.Identifier);

    const astNode: Ast.Identifier = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// This behavior matches the C# parser and not the language specification.
export function readGeneralizedIdentifier<S extends IParseState = IParseState>(
    state: S,
    _parser: IParser<S>,
): Ast.GeneralizedIdentifier {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
    IParseStateUtils.startContext(state, nodeKind);

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
            state.locale,
            IParseStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
        );
    }

    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const tokens: ReadonlyArray<Token.Token> = lexerSnapshot.tokens;
    const contiguousIdentifierStartIndex: number = tokens[tokenRangeStartIndex].positionStart.codeUnit;
    const contiguousIdentifierEndIndex: number = tokens[tokenRangeEndIndex - 1].positionEnd.codeUnit;
    const literal: string = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);
    const literalKind: StringUtils.IdentifierKind = StringUtils.identifierKind(literal, true);

    if (literalKind === StringUtils.IdentifierKind.Invalid) {
        throw new ParseError.ExpectedGeneralizedIdentifierError(
            state.locale,
            IParseStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
        );
    }

    const astNode: Ast.GeneralizedIdentifier = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

export function readKeyword<S extends IParseState = IParseState>(
    state: IParseState,
    _parser: IParser<S>,
): Ast.IdentifierExpression {
    const identifierExpressionNodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    IParseStateUtils.startContext(state, identifierExpressionNodeKind);

    // Keywords can't have a "@" prefix constant
    IParseStateUtils.incrementAttributeCounter(state);

    const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    IParseStateUtils.startContext(state, identifierNodeKind);

    const literal: string = readToken(state);
    const identifier: Ast.Identifier = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: identifierNodeKind,
        isLeaf: true,
        literal,
    };
    IParseStateUtils.endContext(state, identifier);

    const identifierExpression: Ast.IdentifierExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: identifierExpressionNodeKind,
        isLeaf: false,
        maybeInclusiveConstant: undefined,
        identifier,
    };
    IParseStateUtils.endContext(state, identifierExpression);
    return identifierExpression;
}

// --------------------------------------
// ---------- 12.2.1 Documents ----------
// --------------------------------------

export function readDocument<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TDocument {
    state.maybeCancellationToken?.throwIfCancelled();

    let document: Ast.TDocument;
    // Try parsing as an Expression document first.
    // If Expression document fails (including UnusedTokensRemainError) then try parsing a SectionDocument.
    // If both fail then return the error which parsed more tokens.
    try {
        document = parser.readExpression(state, parser);
        IParseStateUtils.assertIsDoneParsing(state);
    } catch (expressionError) {
        // Fast backup deletes context state, but we want to preserve it for the case
        // where both parsing an expression and section document error out.
        const expressionCheckpoint: IParseStateCheckpoint = parser.createCheckpoint(state);
        const expressionErrorContextState: ParseContext.State = state.contextState;

        // Reset the parser's state.
        state.tokenIndex = 0;
        state.contextState = ParseContextUtils.createState();
        state.maybeCurrentContextNode = undefined;

        if (state.lexerSnapshot.tokens.length) {
            state.maybeCurrentToken = state.lexerSnapshot.tokens[0];
            state.maybeCurrentTokenKind = state.maybeCurrentToken?.kind;
        }

        try {
            document = readSectionDocument(state, parser);
            IParseStateUtils.assertIsDoneParsing(state);
        } catch (sectionError) {
            let triedError: Error;
            if (expressionCheckpoint.tokenIndex > /* sectionErrorState */ state.tokenIndex) {
                triedError = expressionError;
                parser.restoreCheckpoint(state, expressionCheckpoint);
                state.contextState = expressionErrorContextState;
            } else {
                triedError = sectionError;
            }

            throw triedError;
        }
    }

    return document;
}

// ----------------------------------------------
// ---------- 12.2.2 Section Documents ----------
// ----------------------------------------------

export function readSectionDocument<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.Section {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;
    IParseStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = maybeReadLiteralAttributes(state, parser);
    const sectionConstant: Ast.IConstant<Constant.KeywordConstantKind.Section> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordSection,
        Constant.KeywordConstantKind.Section,
    );

    let maybeName: Ast.Identifier | undefined;
    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.Identifier)) {
        maybeName = parser.readIdentifier(state, parser);
    } else {
        IParseStateUtils.incrementAttributeCounter(state);
    }

    const semicolonConstant: Ast.IConstant<Constant.MiscConstantKind.Semicolon> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Semicolon,
        Constant.MiscConstantKind.Semicolon,
    );
    const sectionMembers: Ast.IArrayWrapper<Ast.SectionMember> = parser.readSectionMembers(state, parser);

    const astNode: Ast.Section = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeLiteralAttributes,
        sectionConstant,
        maybeName,
        semicolonConstant,
        sectionMembers,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

export function readSectionMembers<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.IArrayWrapper<Ast.SectionMember> {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParseStateUtils.startContext(state, nodeKind);

    const totalTokens: number = state.lexerSnapshot.tokens.length;
    const sectionMembers: Ast.SectionMember[] = [];
    while (state.tokenIndex < totalTokens) {
        sectionMembers.push(parser.readSectionMember(state, parser));
    }

    const astNode: Ast.IArrayWrapper<Ast.SectionMember> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements: sectionMembers,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

export function readSectionMember<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.SectionMember {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;
    IParseStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = maybeReadLiteralAttributes(state, parser);
    const maybeSharedConstant:
        | Ast.IConstant<Constant.KeywordConstantKind.Shared>
        | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordShared,
        Constant.KeywordConstantKind.Shared,
    );
    const namePairedExpression: Ast.IdentifierPairedExpression = parser.readIdentifierPairedExpression(state, parser);
    const semicolonConstant: Ast.IConstant<Constant.MiscConstantKind.Semicolon> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Semicolon,
        Constant.MiscConstantKind.Semicolon,
    );

    const astNode: Ast.SectionMember = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeLiteralAttributes,
        maybeSharedConstant,
        namePairedExpression,
        semicolonConstant,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// ------------------------------------------
// ---------- 12.2.3.1 Expressions ----------
// ------------------------------------------

// ------------------------------------
// ---------- NullCoalescing ----------
// ------------------------------------

export function readNullCoalescingExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.NullCoalescingExpression,
        Ast.TLogicalExpression,
        Constant.MiscConstantKind.NullCoalescingOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.NullCoalescingExpression,
        () => parser.readLogicalExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            maybeCurrentTokenKind === Token.TokenKind.NullCoalescingOperator
                ? Constant.MiscConstantKind.NullCoalescingOperator
                : undefined,
        () => parser.readLogicalExpression(state, parser),
    );
}

export function readExpression<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    switch (state.maybeCurrentTokenKind) {
        case Token.TokenKind.KeywordEach:
            return parser.readEachExpression(state, parser);

        case Token.TokenKind.KeywordLet:
            return parser.readLetExpression(state, parser);

        case Token.TokenKind.KeywordIf:
            return parser.readIfExpression(state, parser);

        case Token.TokenKind.KeywordError:
            return parser.readErrorRaisingExpression(state, parser);

        case Token.TokenKind.KeywordTry:
            return parser.readErrorHandlingExpression(state, parser);

        case Token.TokenKind.LeftParenthesis:
            return DisambiguationUtils.readAmbiguousParenthesis(state, parser);

        default:
            return parser.readNullCoalescingExpression(state, parser);
    }
}

// --------------------------------------------------
// ---------- 12.2.3.2 Logical expressions ----------
// --------------------------------------------------

export function readLogicalExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TLogicalExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.LogicalExpression,
        Ast.TLogicalExpression,
        Constant.LogicalOperatorKind,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.LogicalExpression,
        () => parser.readIsExpression(state, parser),
        maybeCurrentTokenKind => ConstantUtils.maybeLogicalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readIsExpression(state, parser),
    );
}

// --------------------------------------------
// ---------- 12.2.3.3 Is expression ----------
// --------------------------------------------

export function readIsExpression<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TIsExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.IsExpression,
        Ast.TAsExpression,
        Constant.KeywordConstantKind.Is,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.IsExpression,
        () => parser.readAsExpression(state, parser),
        maybeCurrentTokenKind =>
            maybeCurrentTokenKind === Token.TokenKind.KeywordIs ? Constant.KeywordConstantKind.Is : undefined,
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

// sub-item of 12.2.3.3 Is expression
export function readNullablePrimitiveType<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TNullablePrimitiveType {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParseStateUtils.isOnConstantKind(state, Constant.LanguageConstantKind.Nullable)) {
        return readPairedConstant(
            state,
            Ast.NodeKind.NullablePrimitiveType,
            () => readConstantKind(state, Constant.LanguageConstantKind.Nullable),
            () => parser.readPrimitiveType(state, parser),
        );
    } else {
        return parser.readPrimitiveType(state, parser);
    }
}

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

export function readAsExpression<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TAsExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.AsExpression,
        Ast.TEqualityExpression,
        Constant.KeywordConstantKind.As,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.AsExpression,
        () => parser.readEqualityExpression(state, parser),
        maybeCurrentTokenKind =>
            maybeCurrentTokenKind === Token.TokenKind.KeywordAs ? Constant.KeywordConstantKind.As : undefined,
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

// --------------------------------------------------
// ---------- 12.2.3.5 Equality expression ----------
// --------------------------------------------------

export function readEqualityExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TEqualityExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.EqualityExpression,
        Ast.TEqualityExpression,
        Constant.EqualityOperatorKind,
        Ast.TEqualityExpression
    >(
        state,
        Ast.NodeKind.EqualityExpression,
        () => parser.readRelationalExpression(state, parser),
        maybeCurrentTokenKind => ConstantUtils.maybeEqualityOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readRelationalExpression(state, parser),
    );
}

// ----------------------------------------------------
// ---------- 12.2.3.6 Relational expression ----------
// ----------------------------------------------------

export function readRelationalExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TRelationalExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.RelationalExpression,
        Ast.TArithmeticExpression,
        Constant.RelationalOperatorKind,
        Ast.TArithmeticExpression
    >(
        state,
        Ast.NodeKind.RelationalExpression,
        () => parser.readArithmeticExpression(state, parser),
        maybeCurrentTokenKind => ConstantUtils.maybeRelationalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readArithmeticExpression(state, parser),
    );
}

// -----------------------------------------------------
// ---------- 12.2.3.7 Arithmetic expressions ----------
// -----------------------------------------------------

export function readArithmeticExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TArithmeticExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return recursiveReadBinOpExpression<
        S,
        Ast.NodeKind.ArithmeticExpression,
        Ast.TMetadataExpression,
        Constant.ArithmeticOperatorKind,
        Ast.TMetadataExpression
    >(
        state,
        Ast.NodeKind.ArithmeticExpression,
        () => parser.readMetadataExpression(state, parser),
        maybeCurrentTokenKind => ConstantUtils.maybeArithmeticOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readMetadataExpression(state, parser),
    );
}

// --------------------------------------------------
// ---------- 12.2.3.8 Metadata expression ----------
// --------------------------------------------------

export function readMetadataExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TMetadataExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);
    const maybeMetaConstant:
        | Ast.IConstant<Constant.KeywordConstantKind.Meta>
        | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordMeta,
        Constant.KeywordConstantKind.Meta,
    );

    if (maybeMetaConstant !== undefined) {
        const operatorConstant: Ast.IConstant<Constant.KeywordConstantKind.Meta> = maybeMetaConstant;
        const right: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);

        const astNode: Ast.MetadataExpression = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            operatorConstant,
            right,
        };

        IParseStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParseStateUtils.deleteContext(state, undefined);
        return left;
    }
}

// -----------------------------------------------
// ---------- 12.2.3.9 Unary expression ----------
// -----------------------------------------------

export function readUnaryExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TUnaryExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    let maybeOperator: Constant.UnaryOperatorKind | undefined = ConstantUtils.maybeUnaryOperatorKindFrom(
        state.maybeCurrentTokenKind,
    );
    if (maybeOperator === undefined) {
        return parser.readTypeExpression(state, parser);
    }

    const unaryNodeKind: Ast.NodeKind.UnaryExpression = Ast.NodeKind.UnaryExpression;
    IParseStateUtils.startContext(state, unaryNodeKind);

    const arrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParseStateUtils.startContext(state, arrayNodeKind);

    const operatorConstants: Ast.IConstant<Constant.UnaryOperatorKind>[] = [];
    while (maybeOperator) {
        operatorConstants.push(
            readTokenKindAsConstant(state, state.maybeCurrentTokenKind as Token.TokenKind, maybeOperator),
        );
        maybeOperator = ConstantUtils.maybeUnaryOperatorKindFrom(state.maybeCurrentTokenKind);
    }
    const operators: Ast.IArrayWrapper<Ast.IConstant<Constant.UnaryOperatorKind>> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: arrayNodeKind,
        isLeaf: false,
        elements: operatorConstants,
    };
    IParseStateUtils.endContext(state, operators);

    const typeExpression: Ast.TTypeExpression = parser.readTypeExpression(state, parser);

    const astNode: Ast.UnaryExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: unaryNodeKind,
        isLeaf: false,
        operators,
        typeExpression,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------
// ---------- 12.2.3.10 Primary expression ----------
// --------------------------------------------------

export function readPrimaryExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TPrimaryExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    let primaryExpression: Ast.TPrimaryExpression | undefined;
    const maybeCurrentTokenKind: Token.TokenKind | undefined = state.maybeCurrentTokenKind;
    const isIdentifierExpressionNext: boolean =
        maybeCurrentTokenKind === Token.TokenKind.AtSign || maybeCurrentTokenKind === Token.TokenKind.Identifier;

    if (isIdentifierExpressionNext) {
        primaryExpression = parser.readIdentifierExpression(state, parser);
    } else {
        switch (maybeCurrentTokenKind) {
            case Token.TokenKind.LeftParenthesis:
                primaryExpression = parser.readParenthesizedExpression(state, parser);
                break;

            case Token.TokenKind.LeftBracket:
                primaryExpression = DisambiguationUtils.readAmbiguousBracket(state, parser, [
                    Disambiguation.BracketDisambiguation.FieldProjection,
                    Disambiguation.BracketDisambiguation.FieldSelection,
                    Disambiguation.BracketDisambiguation.RecordExpression,
                ]);
                break;

            case Token.TokenKind.LeftBrace:
                primaryExpression = parser.readListExpression(state, parser);
                break;

            case Token.TokenKind.Ellipsis:
                primaryExpression = parser.readNotImplementedExpression(state, parser);
                break;

            case Token.TokenKind.KeywordHashSections:
            case Token.TokenKind.KeywordHashShared:
            case Token.TokenKind.KeywordHashBinary:
            case Token.TokenKind.KeywordHashDate:
            case Token.TokenKind.KeywordHashDateTime:
            case Token.TokenKind.KeywordHashDateTimeZone:
            case Token.TokenKind.KeywordHashDuration:
            case Token.TokenKind.KeywordHashTable:
            case Token.TokenKind.KeywordHashTime:
                primaryExpression = parser.readKeyword(state, parser);
                break;

            default:
                primaryExpression = parser.readLiteralExpression(state, parser);
        }
    }

    if (IParseStateUtils.isRecursivePrimaryExpressionNext(state)) {
        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
    } else {
        return primaryExpression;
    }
}

export function readRecursivePrimaryExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    head: Ast.TPrimaryExpression,
): Ast.RecursivePrimaryExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const currentContextNode: ParseContext.Node = Assert.asDefined(
        state.maybeCurrentContextNode,
        "state.maybeCurrentContextNode",
    );

    // Update parent attributes.
    const parentOfHeadId: number = MapUtils.assertGet(nodeIdMapCollection.parentIdById, head.id);
    nodeIdMapCollection.childIdsById.set(
        parentOfHeadId,
        ArrayUtils.removeFirstInstance(MapUtils.assertGet(nodeIdMapCollection.childIdsById, parentOfHeadId), head.id),
    );
    nodeIdMapCollection.childIdsById.set(currentContextNode.id, [head.id]);
    nodeIdMapCollection.parentIdById.set(head.id, currentContextNode.id);

    const newTokenIndexStart: number = head.tokenRange.tokenIndexStart;
    const mutableContext: TypeScriptUtils.StripReadonly<ParseContext.Node> = currentContextNode;
    const mutableHead: TypeScriptUtils.StripReadonly<Ast.TPrimaryExpression> = head;

    // Update token start to match the first parsed node under it, aka the head.
    mutableContext.maybeTokenStart = state.lexerSnapshot.tokens[newTokenIndexStart];
    mutableContext.tokenIndexStart = newTokenIndexStart;

    // Update attribute counters.
    mutableContext.attributeCounter = 1;
    mutableHead.maybeAttributeIndex = 0;

    // Recalculate ids after shuffling things around.
    const newNodeIdByOldNodeId: Map<number, number> = NodeIdMapUtils.recalculateIds(
        nodeIdMapCollection,
        NodeIdMapUtils.assertGetXor(
            nodeIdMapCollection,
            MapUtils.assertGet(nodeIdMapCollection.parentIdById, currentContextNode.id),
        ),
    );
    NodeIdMapUtils.updateNodeIds(nodeIdMapCollection, newNodeIdByOldNodeId);
    // And be sure to update the leafNodeIds.
    state.contextState.leafNodeIds = state.contextState.leafNodeIds.reduce(
        (previousValue: number[], currentValue: number) => {
            previousValue.push(newNodeIdByOldNodeId.get(currentValue) ?? currentValue);
            return previousValue;
        },
        [],
    );

    // Begin normal parsing.
    const recursiveArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParseStateUtils.startContext(state, recursiveArrayNodeKind);

    const recursiveExpressions: (Ast.InvokeExpression | Ast.ItemAccessExpression | Ast.TFieldAccessExpression)[] = [];
    let continueReadingValues: boolean = true;
    while (continueReadingValues) {
        const maybeCurrentTokenKind: Token.TokenKind | undefined = state.maybeCurrentTokenKind;

        if (maybeCurrentTokenKind === Token.TokenKind.LeftParenthesis) {
            recursiveExpressions.push(parser.readInvokeExpression(state, parser));
        } else if (maybeCurrentTokenKind === Token.TokenKind.LeftBrace) {
            recursiveExpressions.push(parser.readItemAccessExpression(state, parser));
        } else if (maybeCurrentTokenKind === Token.TokenKind.LeftBracket) {
            const bracketExpression: Ast.TFieldAccessExpression = DisambiguationUtils.readAmbiguousBracket(
                state,
                parser,
                [
                    Disambiguation.BracketDisambiguation.FieldSelection,
                    Disambiguation.BracketDisambiguation.FieldProjection,
                ],
            ) as Ast.TFieldAccessExpression;
            recursiveExpressions.push(bracketExpression);
        } else {
            continueReadingValues = false;
        }
    }

    const recursiveArray: Ast.IArrayWrapper<
        Ast.InvokeExpression | Ast.ItemAccessExpression | Ast.TFieldAccessExpression
    > = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: recursiveArrayNodeKind,
        isLeaf: false,
        elements: recursiveExpressions,
    };
    IParseStateUtils.endContext(state, recursiveArray);

    const astNode: Ast.RecursivePrimaryExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        head,
        recursiveExpressions: recursiveArray,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------
// ---------- 12.2.3.11 Literal expression ----------
// --------------------------------------------------

export function readLiteralExpression<S extends IParseState = IParseState>(
    state: IParseState,
    _parser: IParser<S>,
): Ast.LiteralExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const expectedTokenKinds: ReadonlyArray<Token.TokenKind> = [
        Token.TokenKind.HexLiteral,
        Token.TokenKind.KeywordFalse,
        Token.TokenKind.KeywordHashInfinity,
        Token.TokenKind.KeywordHashNan,
        Token.TokenKind.KeywordTrue,
        Token.TokenKind.NumericLiteral,
        Token.TokenKind.NullLiteral,
        Token.TokenKind.TextLiteral,
    ];
    const maybeErr: ParseError.ExpectedAnyTokenKindError | undefined = IParseStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    const literalKind: Ast.LiteralKind = Assert.asDefined(
        AstUtils.maybeLiteralKindFrom(state.maybeCurrentTokenKind),
        `couldn't convert TokenKind into LiteralKind`,
        { maybeCurrentTokenKind: state.maybeCurrentTokenKind },
    );

    const literal: string = readToken(state);
    const astNode: Ast.LiteralExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
        literalKind,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------------------------
// ---------- 12.2.3.16 12.2.3.12 Identifier expression ----------
// ---------------------------------------------------------------

export function readIdentifierExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.IdentifierExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const maybeInclusiveConstant:
        | Ast.IConstant<Constant.MiscConstantKind.AtSign>
        | undefined = maybeReadTokenKindAsConstant(state, Token.TokenKind.AtSign, Constant.MiscConstantKind.AtSign);
    const identifier: Ast.Identifier = parser.readIdentifier(state, parser);

    const astNode: Ast.IdentifierExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeInclusiveConstant,
        identifier,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// --------------------------------------------------------
// ---------- 12.2.3.14 Parenthesized expression ----------
// --------------------------------------------------------

export function readParenthesizedExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.ParenthesizedExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return readWrapped(
        state,
        Ast.NodeKind.ParenthesizedExpression,
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.LeftParenthesis,
                Constant.WrapperConstantKind.LeftParenthesis,
            ),
        () => parser.readExpression(state, parser),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightParenthesis,
                Constant.WrapperConstantKind.RightParenthesis,
            ),
        false,
    );
}

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

export function readNotImplementedExpression<S extends IParseState = IParseState>(
    state: S,
    _parser: IParser<S>,
): Ast.NotImplementedExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const ellipsisConstant: Ast.IConstant<Constant.MiscConstantKind.Ellipsis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Ellipsis,
        Constant.MiscConstantKind.Ellipsis,
    );

    const astNode: Ast.NotImplementedExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ellipsisConstant,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// -------------------------------------------------
// ---------- 12.2.3.16 Invoke expression ----------
// -------------------------------------------------

export function readInvokeExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.InvokeExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightParenthesis);
    return readWrapped(
        state,
        Ast.NodeKind.InvokeExpression,
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.LeftParenthesis,
                Constant.WrapperConstantKind.LeftParenthesis,
            ),
        () =>
            // The type inference in VSCode considers the lambda below a type error, but it compiles just fine.
            // I'm adding an explicit type to stop it from (incorrectly) saying it's an error.
            readCsvArray<S, Ast.TExpression>(
                state,
                () => parser.readExpression(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForParenthesis,
            ),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightParenthesis,
                Constant.WrapperConstantKind.RightParenthesis,
            ),
        false,
    );
}

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

export function readListExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.ListExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);
    return readWrapped(
        state,
        Ast.NodeKind.ListExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstantKind.LeftBrace),
        () =>
            readCsvArray<S, Ast.TListItem>(
                state,
                () => parser.readListItem(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstantKind.RightBrace),
        false,
    );
}

export function readListItem<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TListItem {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TExpression = parser.readExpression(state, parser);
    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.DotDot)) {
        const rangeConstant: Ast.IConstant<Constant.MiscConstantKind.DotDot> = readTokenKindAsConstant(
            state,
            Token.TokenKind.DotDot,
            Constant.MiscConstantKind.DotDot,
        );
        const right: Ast.TExpression = parser.readExpression(state, parser);
        const astNode: Ast.RangeExpression = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            rangeConstant,
            right,
        };

        IParseStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParseStateUtils.deleteContext(state, undefined);
        return left;
    }
}

// -------------------------------------------------
// ---------- 12.2.3.18 Record expression ----------
// -------------------------------------------------

export function readRecordExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.RecordExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);
    return readWrapped(
        state,
        Ast.NodeKind.RecordExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstantKind.LeftBracket),
        () =>
            parser.readGeneralizedIdentifierPairedExpressions(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstantKind.RightBracket),
        false,
    );
}

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

export function readItemAccessExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.ItemAccessExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return readWrapped(
        state,
        Ast.NodeKind.ItemAccessExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstantKind.LeftBrace),
        () => parser.readExpression(state, parser),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstantKind.RightBrace),
        true,
    );
}

// -------------------------------------------------------
// ---------- 12.2.3.20 Field access expression ----------
// -------------------------------------------------------

export function readFieldSelection<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.FieldSelector {
    state.maybeCancellationToken?.throwIfCancelled();

    return readFieldSelector(state, parser, true);
}

export function readFieldProjection<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.FieldProjection {
    state.maybeCancellationToken?.throwIfCancelled();
    return readWrapped(
        state,
        Ast.NodeKind.FieldProjection,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstantKind.LeftBracket),
        () =>
            readCsvArray(
                state,
                () => parser.readFieldSelector(state, parser, false),
                true,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstantKind.RightBracket),
        true,
    );
}

export function readFieldSelector<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowOptional: boolean,
): Ast.FieldSelector {
    state.maybeCancellationToken?.throwIfCancelled();

    return readWrapped(
        state,
        Ast.NodeKind.FieldSelector,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstantKind.LeftBracket),
        () => parser.readGeneralizedIdentifier(state, parser),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstantKind.RightBracket),
        allowOptional,
    );
}

// ---------------------------------------------------
// ---------- 12.2.3.21 Function expression ----------
// ---------------------------------------------------

export function readFunctionExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.FunctionExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const parameters: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = parser.readParameterList(
        state,
        parser,
    );
    const maybeFunctionReturnType: Ast.AsNullablePrimitiveType | undefined = maybeReadAsNullablePrimitiveType(
        state,
        parser,
    );
    const fatArrowConstant: Ast.IConstant<Constant.MiscConstantKind.FatArrow> = readTokenKindAsConstant(
        state,
        Token.TokenKind.FatArrow,
        Constant.MiscConstantKind.FatArrow,
    );
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.FunctionExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        parameters,
        maybeFunctionReturnType,
        fatArrowConstant,
        expression,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

export function readParameterList<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> {
    state.maybeCancellationToken?.throwIfCancelled();

    return genericReadParameterList(state, parser, () => maybeReadAsNullablePrimitiveType(state, parser));
}

function maybeReadAsNullablePrimitiveType<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.AsNullablePrimitiveType | undefined {
    state.maybeCancellationToken?.throwIfCancelled();

    return maybeReadPairedConstant(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => IParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordAs, Constant.KeywordConstantKind.As),
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

export function readAsType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.AsType {
    state.maybeCancellationToken?.throwIfCancelled();

    return readPairedConstant(
        state,
        Ast.NodeKind.AsType,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordAs, Constant.KeywordConstantKind.As),
        () => parser.readType(state, parser),
    );
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

export function readEachExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.EachExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return readPairedConstant(
        state,
        Ast.NodeKind.EachExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordEach, Constant.KeywordConstantKind.Each),
        () => parser.readExpression(state, parser),
    );
}

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

export function readLetExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.LetExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const letConstant: Ast.IConstant<Constant.KeywordConstantKind.Let> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordLet,
        Constant.KeywordConstantKind.Let,
    );
    const identifierPairedExpression: Ast.ICsvArray<Ast.IdentifierPairedExpression> = parser.readIdentifierPairedExpressions(
        state,
        parser,
        !IParseStateUtils.isNextTokenKind(state, Token.TokenKind.KeywordIn),
        IParseStateUtils.testCsvContinuationLetExpression,
    );
    const inConstant: Ast.IConstant<Constant.KeywordConstantKind.In> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordIn,
        Constant.KeywordConstantKind.In,
    );
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.LetExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: Ast.NodeKind.LetExpression,
        isLeaf: false,
        letConstant,
        variableList: identifierPairedExpression,
        inConstant,
        expression,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------
// ---------- 12.2.3.24 If expression ----------
// ---------------------------------------------

export function readIfExpression<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.IfExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const ifConstant: Ast.IConstant<Constant.KeywordConstantKind.If> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordIf,
        Constant.KeywordConstantKind.If,
    );
    const condition: Ast.TExpression = parser.readExpression(state, parser);

    const thenConstant: Ast.IConstant<Constant.KeywordConstantKind.Then> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordThen,
        Constant.KeywordConstantKind.Then,
    );
    const trueExpression: Ast.TExpression = parser.readExpression(state, parser);

    const elseConstant: Ast.IConstant<Constant.KeywordConstantKind.Else> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordElse,
        Constant.KeywordConstantKind.Else,
    );
    const falseExpression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.IfExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ifConstant,
        condition,
        thenConstant,
        trueExpression,
        elseConstant,
        falseExpression,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// -----------------------------------------------
// ---------- 12.2.3.25 Type expression ----------
// -----------------------------------------------

export function readTypeExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.TTypeExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordType)) {
        return readPairedConstant(
            state,
            Ast.NodeKind.TypePrimaryType,
            () => readTokenKindAsConstant(state, Token.TokenKind.KeywordType, Constant.KeywordConstantKind.Type),
            () => parser.readPrimaryType(state, parser),
        );
    } else {
        return parser.readPrimaryExpression(state, parser);
    }
}

export function readType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TType {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);
    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        return parser.readPrimaryExpression(state, parser);
    }
}

export function readPrimaryType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TPrimaryType {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);
    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        throw triedReadPrimaryType.error;
    }
}

export function readRecordType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.RecordType {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;
    IParseStateUtils.startContext(state, nodeKind);

    const fields: Ast.FieldSpecificationList = parser.readFieldSpecificationList(
        state,
        parser,
        true,
        testCsvContinuationDanglingCommaForBracket,
    );

    const astNode: Ast.RecordType = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        fields,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

export function readTableType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TableType {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;
    IParseStateUtils.startContext(state, nodeKind);

    const tableConstant: Ast.IConstant<Constant.PrimitiveTypeConstantKind.Table> = readConstantKind(
        state,
        Constant.PrimitiveTypeConstantKind.Table,
    );
    const maybeCurrentTokenKind: Token.TokenKind | undefined = state.maybeCurrentTokenKind;
    const isPrimaryExpressionExpected: boolean =
        maybeCurrentTokenKind === Token.TokenKind.AtSign ||
        maybeCurrentTokenKind === Token.TokenKind.Identifier ||
        maybeCurrentTokenKind === Token.TokenKind.LeftParenthesis;

    let rowType: Ast.FieldSpecificationList | Ast.TPrimaryExpression;
    if (isPrimaryExpressionExpected) {
        rowType = parser.readPrimaryExpression(state, parser);
    } else {
        rowType = parser.readFieldSpecificationList(state, parser, false, testCsvContinuationDanglingCommaForBracket);
    }

    const astNode: Ast.TableType = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tableConstant,
        rowType,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

export function readFieldSpecificationList<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    allowOpenMarker: boolean,
    testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
): Ast.FieldSpecificationList {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;
    IParseStateUtils.startContext(state, nodeKind);

    const leftBracketConstant: Ast.IConstant<Constant.WrapperConstantKind.LeftBracket> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftBracket,
        Constant.WrapperConstantKind.LeftBracket,
    );
    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = true;
    let isOnOpenRecordMarker: boolean = false;

    const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParseStateUtils.startContext(state, fieldArrayNodeKind);

    while (continueReadingValues) {
        const maybeErr: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.Ellipsis)) {
            if (allowOpenMarker) {
                if (isOnOpenRecordMarker) {
                    throw fieldSpecificationListReadError(state, false);
                } else {
                    isOnOpenRecordMarker = true;
                    continueReadingValues = false;
                }
            } else {
                throw fieldSpecificationListReadError(state, allowOpenMarker);
            }
        } else if (IParseStateUtils.isOnGeneralizedIdentifierStart(state)) {
            const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
            IParseStateUtils.startContext(state, csvNodeKind);

            const fieldSpecificationNodeKind: Ast.NodeKind.FieldSpecification = Ast.NodeKind.FieldSpecification;
            IParseStateUtils.startContext(state, fieldSpecificationNodeKind);

            const maybeOptionalConstant:
                | Ast.IConstant<Constant.LanguageConstantKind.Optional>
                | undefined = maybeReadConstantKind(state, Constant.LanguageConstantKind.Optional);

            const name: Ast.GeneralizedIdentifier = parser.readGeneralizedIdentifier(state, parser);

            const maybeFieldTypeSpecification: Ast.FieldTypeSpecification | undefined = maybeReadFieldTypeSpecification(
                state,
                parser,
            );

            const field: Ast.FieldSpecification = {
                ...IParseStateUtils.assertGetContextNodeMetadata(state),
                kind: fieldSpecificationNodeKind,
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeFieldTypeSpecification,
            };
            IParseStateUtils.endContext(state, field);

            const maybeCommaConstant:
                | Ast.IConstant<Constant.MiscConstantKind.Comma>
                | undefined = maybeReadTokenKindAsConstant(
                state,
                Token.TokenKind.Comma,
                Constant.MiscConstantKind.Comma,
            );
            continueReadingValues = maybeCommaConstant !== undefined;

            const csv: Ast.ICsv<Ast.FieldSpecification> = {
                ...IParseStateUtils.assertGetContextNodeMetadata(state),
                kind: csvNodeKind,
                isLeaf: false,
                node: field,
                maybeCommaConstant,
            };
            IParseStateUtils.endContext(state, csv);
            fields.push(csv);
        } else {
            throw fieldSpecificationListReadError(state, allowOpenMarker);
        }
    }

    const fieldArray: Ast.ICsvArray<Ast.FieldSpecification> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: fieldArrayNodeKind,
        elements: fields,
        isLeaf: false,
    };
    IParseStateUtils.endContext(state, fieldArray);

    let maybeOpenRecordMarkerConstant: Ast.IConstant<Constant.MiscConstantKind.Ellipsis> | undefined = undefined;
    if (isOnOpenRecordMarker) {
        maybeOpenRecordMarkerConstant = readTokenKindAsConstant(
            state,
            Token.TokenKind.Ellipsis,
            Constant.MiscConstantKind.Ellipsis,
        );
    }

    const rightBracketConstant: Ast.IConstant<Constant.WrapperConstantKind.RightBracket> = readTokenKindAsConstant(
        state,
        Token.TokenKind.RightBracket,
        Constant.WrapperConstantKind.RightBracket,
    );

    const astNode: Ast.FieldSpecificationList = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftBracketConstant,
        content: fieldArray,
        maybeOpenRecordMarkerConstant,
        closeWrapperConstant: rightBracketConstant,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

function maybeReadFieldTypeSpecification<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.FieldTypeSpecification | undefined {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;
    IParseStateUtils.startContext(state, nodeKind);

    const maybeEqualConstant: Ast.IConstant<Constant.MiscConstantKind.Equal> | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstantKind.Equal,
    );
    if (maybeEqualConstant) {
        const fieldType: Ast.TType = parser.readType(state, parser);

        const astNode: Ast.FieldTypeSpecification = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.FieldTypeSpecification,
            isLeaf: false,
            equalConstant: maybeEqualConstant,
            fieldType,
        };
        IParseStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParseStateUtils.incrementAttributeCounter(state);
        IParseStateUtils.deleteContext(state, undefined);
        return undefined;
    }
}

function fieldSpecificationListReadError(state: IParseState, allowOpenMarker: boolean): Error | undefined {
    if (allowOpenMarker) {
        const expectedTokenKinds: ReadonlyArray<Token.TokenKind> = [
            Token.TokenKind.Identifier,
            Token.TokenKind.Ellipsis,
        ];
        return IParseStateUtils.testIsOnAnyTokenKind(state, expectedTokenKinds);
    } else {
        return IParseStateUtils.testIsOnTokenKind(state, Token.TokenKind.Identifier);
    }
}

export function readListType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.ListType {
    state.maybeCancellationToken?.throwIfCancelled();

    return readWrapped(
        state,
        Ast.NodeKind.ListType,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstantKind.LeftBrace),
        () => parser.readType(state, parser),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstantKind.RightBrace),
        false,
    );
}

export function readFunctionType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.FunctionType {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
    IParseStateUtils.startContext(state, nodeKind);

    const functionConstant: Ast.IConstant<Constant.PrimitiveTypeConstantKind.Function> = readConstantKind(
        state,
        Constant.PrimitiveTypeConstantKind.Function,
    );
    const parameters: Ast.IParameterList<Ast.AsType> = parser.readParameterSpecificationList(state, parser);
    const functionReturnType: Ast.AsType = parser.readAsType(state, parser);

    const astNode: Ast.FunctionType = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        functionConstant,
        parameters,
        functionReturnType,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

function tryReadPrimaryType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): TriedReadPrimaryType {
    const isTableTypeNext: boolean =
        IParseStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstantKind.Table) &&
        (IParseStateUtils.isNextTokenKind(state, Token.TokenKind.LeftBracket) ||
            IParseStateUtils.isNextTokenKind(state, Token.TokenKind.LeftParenthesis) ||
            IParseStateUtils.isNextTokenKind(state, Token.TokenKind.AtSign) ||
            IParseStateUtils.isNextTokenKind(state, Token.TokenKind.Identifier));
    const isFunctionTypeNext: boolean =
        IParseStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstantKind.Function) &&
        IParseStateUtils.isNextTokenKind(state, Token.TokenKind.LeftParenthesis);

    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return ResultUtils.createOk(parser.readRecordType(state, parser));
    } else if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        return ResultUtils.createOk(parser.readListType(state, parser));
    } else if (isTableTypeNext) {
        return ResultUtils.createOk(parser.readTableType(state, parser));
    } else if (isFunctionTypeNext) {
        return ResultUtils.createOk(parser.readFunctionType(state, parser));
    } else if (IParseStateUtils.isOnConstantKind(state, Constant.LanguageConstantKind.Nullable)) {
        return ResultUtils.createOk(parser.readNullableType(state, parser));
    } else {
        const checkpoint: IParseStateCheckpoint = parser.createCheckpoint(state);
        const triedReadPrimitiveType: TriedReadPrimaryType = tryReadPrimitiveType(state, parser);

        if (ResultUtils.isError(triedReadPrimitiveType)) {
            parser.restoreCheckpoint(state, checkpoint);
        }
        return triedReadPrimitiveType;
    }
}

export function readParameterSpecificationList<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.IParameterList<Ast.AsType> {
    state.maybeCancellationToken?.throwIfCancelled();

    return genericReadParameterList(state, parser, () => parser.readAsType(state, parser));
}

export function readNullableType<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.NullableType {
    state.maybeCancellationToken?.throwIfCancelled();

    return readPairedConstant(
        state,
        Ast.NodeKind.NullableType,
        () => readConstantKind(state, Constant.LanguageConstantKind.Nullable),
        () => parser.readType(state, parser),
    );
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export function readErrorRaisingExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.ErrorRaisingExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    return readPairedConstant(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordError, Constant.KeywordConstantKind.Error),
        () => parser.readExpression(state, parser),
    );
}

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

export function readErrorHandlingExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.ErrorHandlingExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
    IParseStateUtils.startContext(state, nodeKind);

    const tryConstant: Ast.IConstant<Constant.KeywordConstantKind.Try> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordTry,
        Constant.KeywordConstantKind.Try,
    );
    const protectedExpression: Ast.TExpression = parser.readExpression(state, parser);

    const otherwiseExpressionNodeKind: Ast.NodeKind.OtherwiseExpression = Ast.NodeKind.OtherwiseExpression;
    const maybeOtherwiseExpression: Ast.OtherwiseExpression | undefined = maybeReadPairedConstant(
        state,
        otherwiseExpressionNodeKind,
        () => IParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordOtherwise),
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordOtherwise, Constant.KeywordConstantKind.Otherwise),
        () => parser.readExpression(state, parser),
    );

    const astNode: Ast.ErrorHandlingExpression = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tryConstant,
        protectedExpression,
        maybeOtherwiseExpression,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

// -----------------------------------------------
// ---------- 12.2.4 Literal Attributes ----------
// -----------------------------------------------

export function readRecordLiteral<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.RecordLiteral {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.RecordLiteral,
        Constant.WrapperConstantKind.LeftBracket,
        Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>,
        Constant.WrapperConstantKind.RightBracket
    > = readWrapped(
        state,
        Ast.NodeKind.RecordLiteral,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstantKind.LeftBracket),
        () =>
            parser.readFieldNamePairedAnyLiterals(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstantKind.RightBracket),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.Record,
        ...wrappedRead,
    };
}

export function readFieldNamePairedAnyLiterals<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> {
    state.maybeCancellationToken?.throwIfCancelled();

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

export function readListLiteral<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.ListLiteral {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.ListLiteral,
        Constant.WrapperConstantKind.LeftBrace,
        Ast.ICsvArray<Ast.TAnyLiteral>,
        Constant.WrapperConstantKind.RightBrace
    > = readWrapped(
        state,
        Ast.NodeKind.ListLiteral,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstantKind.LeftBrace),
        () =>
            readCsvArray<S, Ast.TAnyLiteral>(
                state,
                () => parser.readAnyLiteral(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstantKind.RightBrace),
        false,
    );
    return {
        literalKind: Ast.LiteralKind.List,
        ...wrappedRead,
    };
}

export function readAnyLiteral<S extends IParseState = IParseState>(state: S, parser: IParser<S>): Ast.TAnyLiteral {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        return parser.readListLiteral(state, parser);
    } else {
        return parser.readLiteralExpression(state, parser);
    }
}

export function readPrimitiveType<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.PrimitiveType {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimitiveType: TriedReadPrimitiveType = tryReadPrimitiveType(state, parser);
    if (ResultUtils.isOk(triedReadPrimitiveType)) {
        return triedReadPrimitiveType.value;
    } else {
        throw triedReadPrimitiveType.error;
    }
}

function tryReadPrimitiveType<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): TriedReadPrimitiveType {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
    IParseStateUtils.startContext(state, nodeKind);

    const checkpoint: IParseStateCheckpoint = parser.createCheckpoint(state);
    const expectedTokenKinds: ReadonlyArray<Token.TokenKind> = [
        Token.TokenKind.Identifier,
        Token.TokenKind.KeywordType,
        Token.TokenKind.NullLiteral,
    ];
    const maybeErr: ParseError.ExpectedAnyTokenKindError | undefined = IParseStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeErr) {
        const error: ParseError.ExpectedAnyTokenKindError = maybeErr;
        return ResultUtils.createError(error);
    }

    let primitiveTypeKind: Constant.PrimitiveTypeConstantKind;
    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.Identifier)) {
        const currentTokenData: string = state.lexerSnapshot.tokens[state.tokenIndex].data;

        switch (currentTokenData) {
            case Constant.PrimitiveTypeConstantKind.Action:
            case Constant.PrimitiveTypeConstantKind.Any:
            case Constant.PrimitiveTypeConstantKind.AnyNonNull:
            case Constant.PrimitiveTypeConstantKind.Binary:
            case Constant.PrimitiveTypeConstantKind.Date:
            case Constant.PrimitiveTypeConstantKind.DateTime:
            case Constant.PrimitiveTypeConstantKind.DateTimeZone:
            case Constant.PrimitiveTypeConstantKind.Duration:
            case Constant.PrimitiveTypeConstantKind.Function:
            case Constant.PrimitiveTypeConstantKind.List:
            case Constant.PrimitiveTypeConstantKind.Logical:
            case Constant.PrimitiveTypeConstantKind.None:
            case Constant.PrimitiveTypeConstantKind.Number:
            case Constant.PrimitiveTypeConstantKind.Record:
            case Constant.PrimitiveTypeConstantKind.Table:
            case Constant.PrimitiveTypeConstantKind.Text:
            case Constant.PrimitiveTypeConstantKind.Time:
                primitiveTypeKind = currentTokenData;
                readToken(state);
                break;

            default:
                const token: Token.Token = IParseStateUtils.assertGetTokenAt(state, state.tokenIndex);
                parser.restoreCheckpoint(state, checkpoint);
                return ResultUtils.createError(
                    new ParseError.InvalidPrimitiveTypeError(
                        state.locale,
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                    ),
                );
        }
    } else if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordType)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstantKind.Type;
        readToken(state);
    } else if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.NullLiteral)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstantKind.Null;
        readToken(state);
    } else {
        const details: {} = { tokenKind: state.maybeCurrentTokenKind };
        parser.restoreCheckpoint(state, checkpoint);
        return ResultUtils.createError(
            new CommonError.InvariantError(`unknown currentTokenKind, not found in [${expectedTokenKinds}]`, details),
        );
    }

    const astNode: Ast.PrimitiveType = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        primitiveTypeKind,
    };
    IParseStateUtils.endContext(state, astNode);
    return ResultUtils.createOk(astNode);
}

// -------------------------------------
// ---------- key-value pairs ----------
// -------------------------------------

export function readIdentifierPairedExpressions<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.IdentifierPairedExpression> {
    state.maybeCancellationToken?.throwIfCancelled();

    return readCsvArray(
        state,
        () => parser.readIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpressions<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> {
    state.maybeCancellationToken?.throwIfCancelled();

    return readCsvArray(
        state,
        () => parser.readGeneralizedIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.GeneralizedIdentifierPairedExpression {
    state.maybeCancellationToken?.throwIfCancelled();

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

export function readIdentifierPairedExpression<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.IdentifierPairedExpression {
    state.maybeCancellationToken?.throwIfCancelled();

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
function recursiveReadBinOpExpression<
    S extends IParseState,
    Kind extends Ast.TBinOpExpressionNodeKind,
    Left,
    Op extends Constant.TBinOpExpressionOperator,
    Right
>(
    state: S,
    nodeKind: Kind,
    leftReader: () => Left,
    maybeOperatorFrom: (tokenKind: Token.TokenKind | undefined) => Op | undefined,
    rightReader: () => Right,
): Left | Ast.IBinOpExpression<Kind, Left, Op, Right> {
    IParseStateUtils.startContext(state, nodeKind);
    const left: Left = leftReader();

    // If no operator, return Left
    const maybeOperator: Op | undefined = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        IParseStateUtils.deleteContext(state, undefined);
        return left;
    }
    const operatorConstant: Ast.TConstant & Ast.IConstant<Op> = readTokenKindAsConstant(
        state,
        state.maybeCurrentTokenKind!,
        maybeOperator,
    );
    const right: Right | Ast.IBinOpExpression<Kind, Right, Op, Right> = recursiveReadBinOpExpressionHelper<
        S,
        Kind,
        Op,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const astNode: Ast.IBinOpExpression<Kind, Left, Op, Right> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left,
        operatorConstant,
        right,
    };
    IParseStateUtils.endContext(state, (astNode as unknown) as Ast.TNode);

    return astNode;
}

// Given the string `1 + 2 + 3` the function will recursively parse 2 Ast nodes,
// where their TokenRange's are represented by brackets:
// 1 + [2 + [3]]
function recursiveReadBinOpExpressionHelper<
    S extends IParseState,
    Kind extends Ast.TBinOpExpressionNodeKind,
    OperatorKind extends Constant.TBinOpExpressionOperator,
    Right
>(
    state: S,
    nodeKind: Kind,
    maybeOperatorFrom: (tokenKind: Token.TokenKind | undefined) => OperatorKind | undefined,
    rightReader: () => Right,
): Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> {
    IParseStateUtils.startContext(state, nodeKind);
    const rightAsLeft: Right = rightReader();

    const maybeOperator: OperatorKind | undefined = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        IParseStateUtils.deleteContext(state, undefined);
        return rightAsLeft;
    }
    const operatorConstant: Ast.TConstant & Ast.IConstant<OperatorKind> = readTokenKindAsConstant(
        state,
        state.maybeCurrentTokenKind!,
        maybeOperator,
    );
    const right: Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> = recursiveReadBinOpExpressionHelper<
        S,
        Kind,
        OperatorKind,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const astNode: Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left: rightAsLeft,
        operatorConstant,
        right,
    };
    IParseStateUtils.endContext(state, (astNode as unknown) as Ast.TNode);

    return astNode;
}

function readCsvArray<S extends IParseState, T extends Ast.TCsvType>(
    state: S,
    valueReader: () => T,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
): Ast.TCsvArray & Ast.ICsvArray<T> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParseStateUtils.startContext(state, nodeKind);

    const elements: Ast.ICsv<T>[] = [];

    while (continueReadingValues) {
        const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
        IParseStateUtils.startContext(state, csvNodeKind);

        const maybeErr: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const node: T = valueReader();
        const maybeCommaConstant:
            | Ast.IConstant<Constant.MiscConstantKind.Comma>
            | undefined = maybeReadTokenKindAsConstant(state, Token.TokenKind.Comma, Constant.MiscConstantKind.Comma);

        const element: Ast.TCsv & Ast.ICsv<T> = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: csvNodeKind,
            isLeaf: false,
            node,
            maybeCommaConstant,
        };
        IParseStateUtils.endContext(state, element);
        elements.push(element);

        continueReadingValues = maybeCommaConstant !== undefined;
    }

    const astNode: Ast.ICsvArray<T> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

function readKeyValuePair<S extends IParseState, Kind extends Ast.TKeyValuePairNodeKind, Key, Value>(
    state: S,
    nodeKind: Kind,
    keyReader: () => Key,
    valueReader: () => Value,
): Ast.IKeyValuePair<Kind, Key, Value> {
    IParseStateUtils.startContext(state, nodeKind);

    const key: Key = keyReader();
    const equalConstant: Ast.IConstant<Constant.MiscConstantKind.Equal> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstantKind.Equal,
    );
    const value: Value = valueReader();

    const keyValuePair: Ast.IKeyValuePair<Kind, Key, Value> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        key,
        equalConstant,
        value,
    };
    IParseStateUtils.endContext(state, (keyValuePair as unknown) as Ast.TKeyValuePair);
    return keyValuePair;
}

function readPairedConstant<
    S extends IParseState,
    Kind extends Ast.TPairedConstantNodeKind,
    ConstantKind extends Constant.TConstantKind,
    Paired
>(
    state: S,
    nodeKind: Kind,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, ConstantKind, Paired> {
    IParseStateUtils.startContext(state, nodeKind);

    const constant: Ast.TConstant & Ast.IConstant<ConstantKind> = constantReader();
    const paired: Paired = pairedReader();

    const pairedConstant: Ast.IPairedConstant<Kind, ConstantKind, Paired> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        constant,
        paired,
    };

    IParseStateUtils.endContext(state, (pairedConstant as unknown) as Ast.TPairedConstant);

    return pairedConstant;
}

function maybeReadPairedConstant<
    S extends IParseState,
    Kind extends Ast.TPairedConstantNodeKind,
    ConstantKind extends Constant.TConstantKind,
    Paired
>(
    state: S,
    nodeKind: Kind,
    condition: () => boolean,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, ConstantKind, Paired> | undefined {
    if (condition()) {
        return readPairedConstant<S, Kind, ConstantKind, Paired>(state, nodeKind, constantReader, pairedReader);
    } else {
        IParseStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function genericReadParameterList<S extends IParseState, T extends Ast.TParameterType>(
    state: S,
    parser: IParser<S>,
    typeReader: () => T,
): Ast.IParameterList<T> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;
    IParseStateUtils.startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.IConstant<Constant.WrapperConstantKind.LeftParenthesis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftParenthesis,
        Constant.WrapperConstantKind.LeftParenthesis,
    );
    let continueReadingValues: boolean = !IParseStateUtils.isOnTokenKind(state, Token.TokenKind.RightParenthesis);
    let reachedOptionalParameter: boolean = false;

    const paramterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParseStateUtils.startContext(state, paramterArrayNodeKind);

    const parameters: Ast.ICsv<Ast.IParameter<T>>[] = [];
    while (continueReadingValues) {
        IParseStateUtils.startContext(state, Ast.NodeKind.Csv);
        IParseStateUtils.startContext(state, Ast.NodeKind.Parameter);

        const maybeErr: ParseError.TInnerParseError | undefined = testCsvContinuationDanglingCommaForParenthesis(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const maybeOptionalConstant:
            | Ast.IConstant<Constant.LanguageConstantKind.Optional>
            | undefined = maybeReadConstantKind(state, Constant.LanguageConstantKind.Optional);

        if (reachedOptionalParameter && !maybeOptionalConstant) {
            const token: Token.Token = IParseStateUtils.assertGetTokenAt(state, state.tokenIndex);
            throw new ParseError.RequiredParameterAfterOptionalParameterError(
                state.locale,
                token,
                state.lexerSnapshot.graphemePositionStartFrom(token),
            );
        } else if (maybeOptionalConstant) {
            reachedOptionalParameter = true;
        }

        const name: Ast.Identifier = parser.readIdentifier(state, parser);
        const maybeParameterType: T = typeReader();

        const parameter: Ast.IParameter<T> = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Parameter,
            isLeaf: false,
            maybeOptionalConstant,
            name,
            maybeParameterType,
        };
        IParseStateUtils.endContext(state, parameter);

        const maybeCommaConstant:
            | Ast.IConstant<Constant.MiscConstantKind.Comma>
            | undefined = maybeReadTokenKindAsConstant(state, Token.TokenKind.Comma, Constant.MiscConstantKind.Comma);
        continueReadingValues = maybeCommaConstant !== undefined;

        const csv: Ast.ICsv<Ast.IParameter<T>> = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Csv,
            isLeaf: false,
            node: parameter,
            maybeCommaConstant,
        };
        IParseStateUtils.endContext(state, csv);

        parameters.push(csv);
    }

    const parameterArray: Ast.ICsvArray<Ast.IParameter<T>> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: paramterArrayNodeKind,
        elements: parameters,
        isLeaf: false,
    };
    IParseStateUtils.endContext(state, parameterArray);

    const rightParenthesisConstant: Ast.IConstant<Constant.WrapperConstantKind.RightParenthesis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.RightParenthesis,
        Constant.WrapperConstantKind.RightParenthesis,
    );

    const astNode: Ast.IParameterList<T> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftParenthesisConstant,
        content: parameterArray,
        closeWrapperConstant: rightParenthesisConstant,
    };
    IParseStateUtils.endContext(state, astNode);
    return astNode;
}

function readWrapped<
    S extends IParseState,
    Kind extends Ast.TWrappedNodeKind,
    Open extends Constant.WrapperConstantKind,
    Content,
    Close extends Constant.WrapperConstantKind
>(
    state: S,
    nodeKind: Kind,
    openConstantReader: () => Ast.IConstant<Open>,
    contentReader: () => Content,
    closeConstantReader: () => Ast.IConstant<Close>,
    allowOptionalConstant: boolean,
): WrappedRead<Kind, Open, Content, Close> {
    IParseStateUtils.startContext(state, nodeKind);

    const openWrapperConstant: Ast.IConstant<Open> = openConstantReader();
    const content: Content = contentReader();
    const closeWrapperConstant: Ast.IConstant<Close> = closeConstantReader();

    let maybeOptionalConstant: Ast.IConstant<Constant.MiscConstantKind.QuestionMark> | undefined;
    if (allowOptionalConstant) {
        maybeOptionalConstant = maybeReadTokenKindAsConstant(
            state,
            Token.TokenKind.QuestionMark,
            Constant.MiscConstantKind.QuestionMark,
        );
    }

    const wrapped: WrappedRead<Kind, Open, Content, Close> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant,
        content,
        closeWrapperConstant,
        maybeOptionalConstant,
    };
    IParseStateUtils.endContext(state, (wrapped as unknown) as Ast.TWrapped);
    return wrapped;
}

// ---------------------------------------------
// ---------- Helper functions (read) ----------
// ---------------------------------------------

export function readToken<S extends IParseState = IParseState>(state: S): string {
    state.maybeCancellationToken?.throwIfCancelled();

    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    Assert.isFalse(state.tokenIndex >= tokens.length, `index is beyond tokens.length`, {
        tokenIndex: state.tokenIndex,
        tokensLength: tokens.length,
    });

    const data: string = tokens[state.tokenIndex].data;
    state.tokenIndex += 1;

    if (state.tokenIndex === tokens.length) {
        // Each node should have a token range of either [start, finish).
        // That idea breaks if a required parse takes place at the end of the token stream.
        // Eg. `let x = 1 |` will attempt a parse for `in`.
        // That means a correct implementation would have some sort of TokenRange | Eof union type,
        // but there's no clean way to introduce that.
        //
        // So, for now when a IParseState is Eof when maybeCurrentTokenKind === undefined.
        state.maybeCurrentTokenKind = undefined;
    } else {
        state.maybeCurrentToken = tokens[state.tokenIndex];
        state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
    }

    return data;
}

export function readTokenKindAsConstant<S extends IParseState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    tokenKind: Token.TokenKind,
    constantKind: ConstantKind,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    state.maybeCancellationToken?.throwIfCancelled();
    IParseStateUtils.startContext(state, Ast.NodeKind.Constant);

    const maybeErr: ParseError.ExpectedTokenKindError | undefined = IParseStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const tokenData: string = readToken(state);
    Assert.isTrue(tokenData === constantKind, `expected tokenData to equal constantKind`, { tokenData, constantKind });

    const astNode: Ast.TConstant & Ast.IConstant<ConstantKind> = {
        ...IParseStateUtils.assertGetContextNodeMetadata(state),
        kind: Ast.NodeKind.Constant,
        isLeaf: true,
        constantKind,
    };
    IParseStateUtils.endContext(state, astNode);

    return astNode;
}

export function maybeReadTokenKindAsConstant<S extends IParseState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    tokenKind: Token.TokenKind,
    constantKind: ConstantKind,
): (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParseStateUtils.isOnTokenKind(state, tokenKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParseStateUtils.startContext(state, nodeKind);

        const tokenData: string = readToken(state);
        Assert.isTrue(tokenData === constantKind, `expected tokenData to equal constantKind`, {
            tokenData,
            constantKind,
        });

        const astNode: Ast.TConstant & Ast.IConstant<ConstantKind> = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            constantKind,
        };
        IParseStateUtils.endContext(state, astNode);

        return astNode;
    } else {
        IParseStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function readTokenKind(state: IParseState, tokenKind: Token.TokenKind): string {
    const maybeErr: ParseError.ExpectedTokenKindError | undefined = IParseStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    return readToken(state);
}

function readConstantKind<S extends IParseState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    constantKind: ConstantKind,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    return Assert.asDefined(maybeReadConstantKind(state, constantKind), `couldn't conver constantKind`, {
        constantKind,
    });
}

function maybeReadConstantKind<S extends IParseState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    constantKind: ConstantKind,
): (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined {
    if (IParseStateUtils.isOnConstantKind(state, constantKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParseStateUtils.startContext(state, nodeKind);

        readToken(state);
        const astNode: Ast.TConstant & Ast.IConstant<ConstantKind> = {
            ...IParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            constantKind,
        };
        IParseStateUtils.endContext(state, astNode);
        return astNode;
    } else {
        IParseStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function maybeReadLiteralAttributes<S extends IParseState = IParseState>(
    state: S,
    parser: IParser<S>,
): Ast.RecordLiteral | undefined {
    if (IParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else {
        IParseStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

// -------------------------------------------------------
// ---------- Helper functions (test functions) ----------
// -------------------------------------------------------

function testCsvContinuationDanglingCommaForBrace<S extends IParseState = IParseState>(
    state: S,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParseStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightBrace);
}

function testCsvContinuationDanglingCommaForBracket<S extends IParseState = IParseState>(
    state: S,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParseStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightBracket);
}

function testCsvContinuationDanglingCommaForParenthesis<S extends IParseState = IParseState>(
    state: S,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParseStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightParenthesis);
}
