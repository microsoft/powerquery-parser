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
import { Ast, Constant, ConstantUtils, Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { BracketDisambiguation, IParser, ParenthesisDisambiguation } from "../IParser";
import { IParserState, IParserStateUtils } from "../IParserState";
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

export function readIdentifier<S extends IParserState = IParserState>(
    state: IParserState,
    _parser: IParser<S>,
): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    IParserStateUtils.startContext(state, nodeKind);

    const literal: string = readTokenKind(state, Token.TokenKind.Identifier);

    const astNode: Ast.Identifier = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// This behavior matches the C# parser and not the language specification.
export function readGeneralizedIdentifier<S extends IParserState = IParserState>(
    state: S,
    _parser: IParser<S>,
): Ast.GeneralizedIdentifier {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
    IParserStateUtils.startContext(state, nodeKind);

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
    const tokens: ReadonlyArray<Token.Token> = lexerSnapshot.tokens;
    const contiguousIdentifierStartIndex: number = tokens[tokenRangeStartIndex].positionStart.codeUnit;
    const contiguousIdentifierEndIndex: number = tokens[tokenRangeEndIndex - 1].positionEnd.codeUnit;
    const literal: string = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);

    if (
        !StringUtils.isIdentifier(literal, true) &&
        !StringUtils.isGeneralizedIdentifier(literal) &&
        !StringUtils.isQuotedIdentifier(literal)
    ) {
        throw new ParseError.ExpectedGeneralizedIdentifierError(
            state.localizationTemplates,
            IParserStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
        );
    }

    const astNode: Ast.GeneralizedIdentifier = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readKeyword<S extends IParserState = IParserState>(
    state: IParserState,
    _parser: IParser<S>,
): Ast.IdentifierExpression {
    const identifierExpressionNodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    IParserStateUtils.startContext(state, identifierExpressionNodeKind);

    // Keywords can't have a "@" prefix constant
    IParserStateUtils.incrementAttributeCounter(state);

    const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    IParserStateUtils.startContext(state, identifierNodeKind);

    const literal: string = readToken(state);
    const identifier: Ast.Identifier = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: identifierNodeKind,
        isLeaf: true,
        literal,
    };
    IParserStateUtils.endContext(state, identifier);

    const identifierExpression: Ast.IdentifierExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readDocument<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.TDocument {
    state.maybeCancellationToken?.throwIfCancelled();

    let document: Ast.TDocument;
    // Try parsing as an Expression document first.
    // If Expression document fails (including UnusedTokensRemainError) then try parsing a SectionDocument.
    // If both fail then return the error which parsed more tokens.
    try {
        document = parser.readExpression(state, parser);
        IParserStateUtils.assertNoMoreTokens(state);
        IParserStateUtils.assertNoOpenContext(state);
    } catch (expressionError) {
        // Fast backup deletes context state, but we want to preserve it for the case
        // where both parsing an expression and section document error out.
        const expressionErrorStateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
        const expressionErrorContextState: ParseContext.State = state.contextState;

        // Reset the parser's state.
        state.tokenIndex = 0;
        state.contextState = ParseContextUtils.stateFactory();
        state.maybeCurrentContextNode = undefined;

        if (state.lexerSnapshot.tokens.length) {
            state.maybeCurrentToken = state.lexerSnapshot.tokens[0];
            state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
        }

        try {
            document = readSectionDocument(state, parser);
            IParserStateUtils.assertNoMoreTokens(state);
            IParserStateUtils.assertNoOpenContext(state);
        } catch (sectionError) {
            let triedError: Error;
            if (expressionErrorStateBackup.tokenIndex > /* sectionErrorState */ state.tokenIndex) {
                triedError = expressionError;
                IParserStateUtils.applyFastStateBackup(state, expressionErrorStateBackup);
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

export function readSectionDocument<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.Section {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = maybeReadLiteralAttributes(state, parser);
    const sectionConstant: Ast.IConstant<Constant.KeywordConstantKind.Section> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordSection,
        Constant.KeywordConstantKind.Section,
    );

    let maybeName: Ast.Identifier | undefined;
    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.Identifier)) {
        maybeName = parser.readIdentifier(state, parser);
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
    }

    const semicolonConstant: Ast.IConstant<Constant.MiscConstantKind.Semicolon> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Semicolon,
        Constant.MiscConstantKind.Semicolon,
    );
    const sectionMembers: Ast.IArrayWrapper<Ast.SectionMember> = parser.readSectionMembers(state, parser);

    const astNode: Ast.Section = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readSectionMembers<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.IArrayWrapper<Ast.SectionMember> {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, nodeKind);

    const totalTokens: number = state.lexerSnapshot.tokens.length;
    const sectionMembers: Ast.SectionMember[] = [];
    while (state.tokenIndex < totalTokens) {
        sectionMembers.push(parser.readSectionMember(state, parser));
    }

    const astNode: Ast.IArrayWrapper<Ast.SectionMember> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements: sectionMembers,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readSectionMember<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.SectionMember {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;
    IParserStateUtils.startContext(state, nodeKind);

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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

// ------------------------------------
// ---------- NullCoalescing ----------
// ------------------------------------

export function readNullCoalescingExpression<S extends IParserState = IParserState>(
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

export function readExpression<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.TExpression {
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
            const triedDisambiguation: Result<
                ParenthesisDisambiguation,
                ParseError.UnterminatedSequence
            > = parser.disambiguateParenthesis(state, parser);
            if (ResultUtils.isErr(triedDisambiguation)) {
                throw triedDisambiguation.error;
            }
            const disambiguation: ParenthesisDisambiguation = triedDisambiguation.value;

            switch (disambiguation) {
                case ParenthesisDisambiguation.FunctionExpression:
                    return parser.readFunctionExpression(state, parser);

                case ParenthesisDisambiguation.ParenthesizedExpression:
                    return parser.readNullCoalescingExpression(state, parser);

                default:
                    throw Assert.isNever(disambiguation);
            }

        default:
            return parser.readNullCoalescingExpression(state, parser);
    }
}

// --------------------------------------------------
// ---------- 12.2.3.2 Logical expressions ----------
// --------------------------------------------------

export function readLogicalExpression<S extends IParserState = IParserState>(
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

export function readIsExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.TIsExpression {
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
export function readNullablePrimitiveType<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.TNullablePrimitiveType {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParserStateUtils.isOnConstantKind(state, Constant.IdentifierConstantKind.Nullable)) {
        return readPairedConstant(
            state,
            Ast.NodeKind.NullablePrimitiveType,
            () => readConstantKind(state, Constant.IdentifierConstantKind.Nullable),
            () => parser.readPrimitiveType(state, parser),
        );
    } else {
        return parser.readPrimitiveType(state, parser);
    }
}

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

export function readAsExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.TAsExpression {
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

export function readEqualityExpression<S extends IParserState = IParserState>(
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

export function readRelationalExpression<S extends IParserState = IParserState>(
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

export function readArithmeticExpression<S extends IParserState = IParserState>(
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

export function readMetadataExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.TMetadataExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;
    IParserStateUtils.startContext(state, nodeKind);

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
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readUnaryExpression<S extends IParserState = IParserState>(
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
    IParserStateUtils.startContext(state, unaryNodeKind);

    const arrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, arrayNodeKind);

    const operatorConstants: Ast.IConstant<Constant.UnaryOperatorKind>[] = [];
    while (maybeOperator) {
        operatorConstants.push(
            readTokenKindAsConstant(state, state.maybeCurrentTokenKind as Token.TokenKind, maybeOperator),
        );
        maybeOperator = ConstantUtils.maybeUnaryOperatorKindFrom(state.maybeCurrentTokenKind);
    }
    const operators: Ast.IArrayWrapper<Ast.IConstant<Constant.UnaryOperatorKind>> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: arrayNodeKind,
        isLeaf: false,
        elements: operatorConstants,
    };
    IParserStateUtils.endContext(state, operators);

    const typeExpression: Ast.TTypeExpression = parser.readTypeExpression(state, parser);

    const astNode: Ast.UnaryExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readPrimaryExpression<S extends IParserState = IParserState>(
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
                primaryExpression = readBracketDisambiguation(state, parser, [
                    BracketDisambiguation.FieldProjection,
                    BracketDisambiguation.FieldSelection,
                    BracketDisambiguation.Record,
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

    if (IParserStateUtils.isRecursivePrimaryExpressionNext(state)) {
        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
    } else {
        return primaryExpression;
    }
}

export function readRecursivePrimaryExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
    head: Ast.TPrimaryExpression,
): Ast.RecursivePrimaryExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    Assert.isDefined(state.maybeCurrentContextNode);
    const currentContextNode: ParseContext.Node = state.maybeCurrentContextNode;

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
    IParserStateUtils.startContext(state, recursiveArrayNodeKind);

    const recursiveExpressions: (Ast.InvokeExpression | Ast.ItemAccessExpression | Ast.TFieldAccessExpression)[] = [];
    let continueReadingValues: boolean = true;
    while (continueReadingValues) {
        const maybeCurrentTokenKind: Token.TokenKind | undefined = state.maybeCurrentTokenKind;

        if (maybeCurrentTokenKind === Token.TokenKind.LeftParenthesis) {
            recursiveExpressions.push(parser.readInvokeExpression(state, parser));
        } else if (maybeCurrentTokenKind === Token.TokenKind.LeftBrace) {
            recursiveExpressions.push(parser.readItemAccessExpression(state, parser));
        } else if (maybeCurrentTokenKind === Token.TokenKind.LeftBracket) {
            const bracketExpression: Ast.TFieldAccessExpression = readBracketDisambiguation(state, parser, [
                BracketDisambiguation.FieldProjection,
                BracketDisambiguation.FieldSelection,
            ]) as Ast.TFieldAccessExpression;
            recursiveExpressions.push(bracketExpression);
        } else {
            continueReadingValues = false;
        }
    }

    const recursiveArray: Ast.IArrayWrapper<
        Ast.InvokeExpression | Ast.ItemAccessExpression | Ast.TFieldAccessExpression
    > = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: recursiveArrayNodeKind,
        isLeaf: false,
        elements: recursiveExpressions,
    };
    IParserStateUtils.endContext(state, recursiveArray);

    const astNode: Ast.RecursivePrimaryExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readLiteralExpression<S extends IParserState = IParserState>(
    state: IParserState,
    _parser: IParser<S>,
): Ast.LiteralExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;
    IParserStateUtils.startContext(state, nodeKind);

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
    const maybeErr: ParseError.ExpectedAnyTokenKindError | undefined = IParserStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    const maybeLiteralKind:
        | Constant.LiteralKind.Numeric
        | Constant.LiteralKind.Logical
        | Constant.LiteralKind.Null
        | Constant.LiteralKind.Text
        | undefined = ConstantUtils.maybeLiteralKindFrom(state.maybeCurrentTokenKind);

    Assert.isDefined(maybeLiteralKind, `couldn't convert TokenKind into LiteralKind`, {
        maybeCurrentTokenKind: state.maybeCurrentTokenKind,
    });

    const literal: string = readToken(state);
    const astNode: Ast.LiteralExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
        literalKind: maybeLiteralKind,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------------------------
// ---------- 12.2.3.16 12.2.3.12 Identifier expression ----------
// ---------------------------------------------------------------

export function readIdentifierExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.IdentifierExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeInclusiveConstant:
        | Ast.IConstant<Constant.MiscConstantKind.AtSign>
        | undefined = maybeReadTokenKindAsConstant(state, Token.TokenKind.AtSign, Constant.MiscConstantKind.AtSign);
    const identifier: Ast.Identifier = parser.readIdentifier(state, parser);

    const astNode: Ast.IdentifierExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readParenthesizedExpression<S extends IParserState = IParserState>(
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

export function readNotImplementedExpression<S extends IParserState = IParserState>(
    state: S,
    _parser: IParser<S>,
): Ast.NotImplementedExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const ellipsisConstant: Ast.IConstant<Constant.MiscConstantKind.Ellipsis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Ellipsis,
        Constant.MiscConstantKind.Ellipsis,
    );

    const astNode: Ast.NotImplementedExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readInvokeExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.InvokeExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, Token.TokenKind.RightParenthesis);
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

export function readListExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.ListExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);
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

export function readListItem<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.TListItem {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const left: Ast.TExpression = parser.readExpression(state, parser);
    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.DotDot)) {
        const rangeConstant: Ast.IConstant<Constant.MiscConstantKind.DotDot> = readTokenKindAsConstant(
            state,
            Token.TokenKind.DotDot,
            Constant.MiscConstantKind.DotDot,
        );
        const right: Ast.TExpression = parser.readExpression(state, parser);
        const astNode: Ast.RangeExpression = {
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readRecordExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.RecordExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);
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

export function readItemAccessExpression<S extends IParserState = IParserState>(
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

export function readFieldSelection<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.FieldSelector {
    state.maybeCancellationToken?.throwIfCancelled();

    return readFieldSelector(state, parser, true);
}

export function readFieldProjection<S extends IParserState = IParserState>(
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

export function readFieldSelector<S extends IParserState = IParserState>(
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

export function readFunctionExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.FunctionExpression {
    state.maybeCancellationToken?.throwIfCancelled();
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
    const fatArrowConstant: Ast.IConstant<Constant.MiscConstantKind.FatArrow> = readTokenKindAsConstant(
        state,
        Token.TokenKind.FatArrow,
        Constant.MiscConstantKind.FatArrow,
    );
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.FunctionExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readParameterList<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> {
    state.maybeCancellationToken?.throwIfCancelled();

    return genericReadParameterList(state, parser, () => maybeReadAsNullablePrimitiveType(state, parser));
}

function maybeReadAsNullablePrimitiveType<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.AsNullablePrimitiveType | undefined {
    state.maybeCancellationToken?.throwIfCancelled();

    return maybeReadPairedConstant(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => IParserStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordAs, Constant.KeywordConstantKind.As),
        () => parser.readNullablePrimitiveType(state, parser),
    );
}

export function readAsType<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.AsType {
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

export function readEachExpression<S extends IParserState = IParserState>(
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

export function readLetExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.LetExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;
    IParserStateUtils.startContext(state, nodeKind);

    const letConstant: Ast.IConstant<Constant.KeywordConstantKind.Let> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordLet,
        Constant.KeywordConstantKind.Let,
    );
    const identifierPairedExpression: Ast.ICsvArray<Ast.IdentifierPairedExpression> = parser.readIdentifierPairedExpressions(
        state,
        parser,
        !IParserStateUtils.isNextTokenKind(state, Token.TokenKind.KeywordIn),
        IParserStateUtils.testCsvContinuationLetExpression,
    );
    const inConstant: Ast.IConstant<Constant.KeywordConstantKind.In> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordIn,
        Constant.KeywordConstantKind.In,
    );
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const astNode: Ast.LetExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: Ast.NodeKind.LetExpression,
        isLeaf: false,
        letConstant,
        variableList: identifierPairedExpression,
        inConstant,
        expression,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

// ---------------------------------------------
// ---------- 12.2.3.24 If expression ----------
// ---------------------------------------------

export function readIfExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.IfExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;
    IParserStateUtils.startContext(state, nodeKind);

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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readTypeExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.TTypeExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordType)) {
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

export function readType<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.TType {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);
    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        return parser.readPrimaryExpression(state, parser);
    }
}

export function readPrimaryType<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.TPrimaryType {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);
    if (ResultUtils.isOk(triedReadPrimaryType)) {
        return triedReadPrimaryType.value;
    } else {
        throw triedReadPrimaryType.error;
    }
}

export function readRecordType<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.RecordType {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;
    IParserStateUtils.startContext(state, nodeKind);

    const fields: Ast.FieldSpecificationList = parser.readFieldSpecificationList(
        state,
        parser,
        true,
        testCsvContinuationDanglingCommaForBracket,
    );

    const astNode: Ast.RecordType = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        fields,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readTableType<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.TableType {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;
    IParserStateUtils.startContext(state, nodeKind);

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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tableConstant,
        rowType,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

export function readFieldSpecificationList<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
    allowOpenMarker: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.FieldSpecificationList {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;
    IParserStateUtils.startContext(state, nodeKind);

    const leftBracketConstant: Ast.IConstant<Constant.WrapperConstantKind.LeftBracket> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftBracket,
        Constant.WrapperConstantKind.LeftBracket,
    );
    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = true;
    let isOnOpenRecordMarker: boolean = false;

    const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, fieldArrayNodeKind);

    while (continueReadingValues) {
        const maybeErr: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.Ellipsis)) {
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
        } else if (IParserStateUtils.isOnGeneralizedIdentifierStart(state)) {
            const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
            IParserStateUtils.startContext(state, csvNodeKind);

            const fieldSpecificationNodeKind: Ast.NodeKind.FieldSpecification = Ast.NodeKind.FieldSpecification;
            IParserStateUtils.startContext(state, fieldSpecificationNodeKind);

            const maybeOptionalConstant:
                | Ast.IConstant<Constant.IdentifierConstantKind.Optional>
                | undefined = maybeReadConstantKind(state, Constant.IdentifierConstantKind.Optional);

            const name: Ast.GeneralizedIdentifier = parser.readGeneralizedIdentifier(state, parser);

            const maybeFieldTypeSpecification: Ast.FieldTypeSpecification | undefined = maybeReadFieldTypeSpecification(
                state,
                parser,
            );

            const field: Ast.FieldSpecification = {
                ...IParserStateUtils.assertGetContextNodeMetadata(state),
                kind: fieldSpecificationNodeKind,
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeFieldTypeSpecification,
            };
            IParserStateUtils.endContext(state, field);

            const maybeCommaConstant:
                | Ast.IConstant<Constant.MiscConstantKind.Comma>
                | undefined = maybeReadTokenKindAsConstant(
                state,
                Token.TokenKind.Comma,
                Constant.MiscConstantKind.Comma,
            );
            continueReadingValues = maybeCommaConstant !== undefined;

            const csv: Ast.ICsv<Ast.FieldSpecification> = {
                ...IParserStateUtils.assertGetContextNodeMetadata(state),
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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: fieldArrayNodeKind,
        elements: fields,
        isLeaf: false,
    };
    IParserStateUtils.endContext(state, fieldArray);

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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

function maybeReadFieldTypeSpecification<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.FieldTypeSpecification | undefined {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;
    IParserStateUtils.startContext(state, nodeKind);

    const maybeEqualConstant: Ast.IConstant<Constant.MiscConstantKind.Equal> | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstantKind.Equal,
    );
    if (maybeEqualConstant) {
        const fieldType: Ast.TType = parser.readType(state, parser);

        const astNode: Ast.FieldTypeSpecification = {
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
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
        const expectedTokenKinds: ReadonlyArray<Token.TokenKind> = [
            Token.TokenKind.Identifier,
            Token.TokenKind.Ellipsis,
        ];
        return IParserStateUtils.testIsOnAnyTokenKind(state, expectedTokenKinds);
    } else {
        return IParserStateUtils.testIsOnTokenKind(state, Token.TokenKind.Identifier);
    }
}

export function readListType<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.ListType {
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

export function readFunctionType<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.FunctionType {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
    IParserStateUtils.startContext(state, nodeKind);

    const functionConstant: Ast.IConstant<Constant.PrimitiveTypeConstantKind.Function> = readConstantKind(
        state,
        Constant.PrimitiveTypeConstantKind.Function,
    );
    const parameters: Ast.IParameterList<Ast.AsType> = parser.readParameterSpecificationList(state, parser);
    const functionReturnType: Ast.AsType = parser.readAsType(state, parser);

    const astNode: Ast.FunctionType = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        functionConstant,
        parameters,
        functionReturnType,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

function tryReadPrimaryType<S extends IParserState = IParserState>(state: S, parser: IParser<S>): TriedReadPrimaryType {
    const isTableTypeNext: boolean =
        IParserStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstantKind.Table) &&
        (IParserStateUtils.isNextTokenKind(state, Token.TokenKind.LeftBracket) ||
            IParserStateUtils.isNextTokenKind(state, Token.TokenKind.LeftParenthesis) ||
            IParserStateUtils.isNextTokenKind(state, Token.TokenKind.AtSign) ||
            IParserStateUtils.isNextTokenKind(state, Token.TokenKind.Identifier));
    const isFunctionTypeNext: boolean =
        IParserStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstantKind.Function) &&
        IParserStateUtils.isNextTokenKind(state, Token.TokenKind.LeftParenthesis);

    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return ResultUtils.okFactory(parser.readRecordType(state, parser));
    } else if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        return ResultUtils.okFactory(parser.readListType(state, parser));
    } else if (isTableTypeNext) {
        return ResultUtils.okFactory(parser.readTableType(state, parser));
    } else if (isFunctionTypeNext) {
        return ResultUtils.okFactory(parser.readFunctionType(state, parser));
    } else if (IParserStateUtils.isOnConstantKind(state, Constant.IdentifierConstantKind.Nullable)) {
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

export function readParameterSpecificationList<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.IParameterList<Ast.AsType> {
    state.maybeCancellationToken?.throwIfCancelled();

    return genericReadParameterList(state, parser, () => parser.readAsType(state, parser));
}

export function readNullableType<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.NullableType {
    state.maybeCancellationToken?.throwIfCancelled();

    return readPairedConstant(
        state,
        Ast.NodeKind.NullableType,
        () => readConstantKind(state, Constant.IdentifierConstantKind.Nullable),
        () => parser.readType(state, parser),
    );
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export function readErrorRaisingExpression<S extends IParserState = IParserState>(
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

export function readErrorHandlingExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.ErrorHandlingExpression {
    state.maybeCancellationToken?.throwIfCancelled();
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
    IParserStateUtils.startContext(state, nodeKind);

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
        () => IParserStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordOtherwise),
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordOtherwise, Constant.KeywordConstantKind.Otherwise),
        () => parser.readExpression(state, parser),
    );

    const astNode: Ast.ErrorHandlingExpression = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

export function readRecordLiteral<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.RecordLiteral {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);
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
        literalKind: Constant.LiteralKind.Record,
        ...wrappedRead,
    };
}

export function readFieldNamePairedAnyLiterals<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
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

export function readListLiteral<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.ListLiteral {
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !IParserStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);
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
        literalKind: Constant.LiteralKind.List,
        ...wrappedRead,
    };
}

export function readAnyLiteral<S extends IParserState = IParserState>(state: S, parser: IParser<S>): Ast.TAnyLiteral {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        return parser.readListLiteral(state, parser);
    } else {
        return parser.readLiteralExpression(state, parser);
    }
}

export function readPrimitiveType<S extends IParserState = IParserState>(
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

function tryReadPrimitiveType<S extends IParserState = IParserState>(
    state: S,
    _parser: IParser<S>,
): TriedReadPrimitiveType {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
    IParserStateUtils.startContext(state, nodeKind);

    const stateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
    const expectedTokenKinds: ReadonlyArray<Token.TokenKind> = [
        Token.TokenKind.Identifier,
        Token.TokenKind.KeywordType,
        Token.TokenKind.NullLiteral,
    ];
    const maybeErr: ParseError.ExpectedAnyTokenKindError | undefined = IParserStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeErr) {
        const error: ParseError.ExpectedAnyTokenKindError = maybeErr;
        return ResultUtils.errFactory(error);
    }

    let primitiveTypeKind: Constant.PrimitiveTypeConstantKind;
    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.Identifier)) {
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
                const token: Token.Token = IParserStateUtils.assertGetTokenAt(state, state.tokenIndex);
                IParserStateUtils.applyFastStateBackup(state, stateBackup);
                return ResultUtils.errFactory(
                    new ParseError.InvalidPrimitiveTypeError(
                        state.localizationTemplates,
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                    ),
                );
        }
    } else if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordType)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstantKind.Type;
        readToken(state);
    } else if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.NullLiteral)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstantKind.Null;
        readToken(state);
    } else {
        const details: {} = { tokenKind: state.maybeCurrentTokenKind };
        IParserStateUtils.applyFastStateBackup(state, stateBackup);
        return ResultUtils.errFactory(
            new CommonError.InvariantError(`unknown currentTokenKind, not found in [${expectedTokenKinds}]`, details),
        );
    }

    const astNode: Ast.PrimitiveType = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        primitiveTypeKind,
    };
    IParserStateUtils.endContext(state, astNode);
    return ResultUtils.okFactory(astNode);
}

// ------------------------------------
// ---------- Disambiguation ----------
// ------------------------------------

export function disambiguateParenthesis<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Result<ParenthesisDisambiguation, ParseError.UnterminatedSequence> {
    state.maybeCancellationToken?.throwIfCancelled();

    const initialTokenIndex: number = state.tokenIndex;
    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    const totalTokens: number = tokens.length;
    let nestedDepth: number = 1;
    let offsetTokenIndex: number = initialTokenIndex + 1;

    while (offsetTokenIndex < totalTokens) {
        const offsetTokenKind: Token.TokenKind = tokens[offsetTokenIndex].kind;

        if (offsetTokenKind === Token.TokenKind.LeftParenthesis) {
            nestedDepth += 1;
        } else if (offsetTokenKind === Token.TokenKind.RightParenthesis) {
            nestedDepth -= 1;
        }

        if (nestedDepth === 0) {
            // '(x as number) as number' could either be either case,
            // so we need to consume test if the trailing 'as number' is followed by a FatArrow.
            if (IParserStateUtils.isTokenKind(state, Token.TokenKind.KeywordAs, offsetTokenIndex + 1)) {
                const stateBackup: IParserStateUtils.FastStateBackup = IParserStateUtils.fastStateBackup(state);
                unsafeMoveTo(state, offsetTokenIndex + 2);

                try {
                    parser.readNullablePrimitiveType(state, parser);
                } catch {
                    IParserStateUtils.applyFastStateBackup(state, stateBackup);
                    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.FunctionExpression);
                    } else {
                        return ResultUtils.okFactory(ParenthesisDisambiguation.ParenthesizedExpression);
                    }
                }

                let disambiguation: ParenthesisDisambiguation;
                if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.FatArrow)) {
                    disambiguation = ParenthesisDisambiguation.FunctionExpression;
                } else {
                    disambiguation = ParenthesisDisambiguation.ParenthesizedExpression;
                }

                IParserStateUtils.applyFastStateBackup(state, stateBackup);
                return ResultUtils.okFactory(disambiguation);
            } else {
                if (IParserStateUtils.isTokenKind(state, Token.TokenKind.FatArrow, offsetTokenIndex + 1)) {
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
    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    state.tokenIndex = tokenIndex;

    if (tokenIndex < tokens.length) {
        state.maybeCurrentToken = tokens[tokenIndex];
        state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
    } else {
        state.maybeCurrentToken = undefined;
        state.maybeCurrentTokenKind = undefined;
    }
}

export function disambiguateBracket<S extends IParserState = IParserState>(
    state: S,
    _parser: IParser<S>,
): Result<BracketDisambiguation, ParseError.UnterminatedSequence> {
    state.maybeCancellationToken?.throwIfCancelled();

    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    let offsetTokenIndex: number = state.tokenIndex + 1;
    const offsetToken: Token.Token = tokens[offsetTokenIndex];

    if (!offsetToken) {
        return ResultUtils.errFactory(IParserStateUtils.unterminatedBracketError(state));
    }

    let offsetTokenKind: Token.TokenKind = offsetToken.kind;
    if (offsetTokenKind === Token.TokenKind.LeftBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.FieldProjection);
    } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
        return ResultUtils.okFactory(BracketDisambiguation.Record);
    } else {
        const totalTokens: number = tokens.length;
        offsetTokenIndex += 1;
        while (offsetTokenIndex < totalTokens) {
            offsetTokenKind = tokens[offsetTokenIndex].kind;

            if (offsetTokenKind === Token.TokenKind.Equal) {
                return ResultUtils.okFactory(BracketDisambiguation.Record);
            } else if (offsetTokenKind === Token.TokenKind.RightBracket) {
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

export function readIdentifierPairedExpressions<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.IdentifierPairedExpression> {
    state.maybeCancellationToken?.throwIfCancelled();

    return readCsvArray(
        state,
        () => parser.readIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpressions<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> {
    state.maybeCancellationToken?.throwIfCancelled();

    return readCsvArray(
        state,
        () => parser.readGeneralizedIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
}

export function readGeneralizedIdentifierPairedExpression<S extends IParserState = IParserState>(
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

export function readIdentifierPairedExpression<S extends IParserState = IParserState>(
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
    S extends IParserState,
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
    IParserStateUtils.startContext(state, nodeKind);
    const left: Left = leftReader();

    // If no operator, return Left
    const maybeOperator: Op | undefined = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        IParserStateUtils.deleteContext(state, undefined);
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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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
function recursiveReadBinOpExpressionHelper<
    S extends IParserState,
    Kind extends Ast.TBinOpExpressionNodeKind,
    OperatorKind extends Constant.TBinOpExpressionOperator,
    Right
>(
    state: S,
    nodeKind: Kind,
    maybeOperatorFrom: (tokenKind: Token.TokenKind | undefined) => OperatorKind | undefined,
    rightReader: () => Right,
): Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> {
    IParserStateUtils.startContext(state, nodeKind);
    const rightAsLeft: Right = rightReader();

    const maybeOperator: OperatorKind | undefined = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        IParserStateUtils.deleteContext(state, undefined);
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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left: rightAsLeft,
        operatorConstant,
        right,
    };
    IParserStateUtils.endContext(state, (astNode as unknown) as Ast.TNode);

    return astNode;
}

function readCsvArray<S extends IParserState, T extends Ast.TCsvType>(
    state: S,
    valueReader: () => T,
    continueReadingValues: boolean,
    testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
): Ast.TCsvArray & Ast.ICsvArray<T> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, nodeKind);

    const elements: Ast.ICsv<T>[] = [];

    while (continueReadingValues) {
        const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
        IParserStateUtils.startContext(state, csvNodeKind);

        const maybeErr: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const node: T = valueReader();
        const maybeCommaConstant:
            | Ast.IConstant<Constant.MiscConstantKind.Comma>
            | undefined = maybeReadTokenKindAsConstant(state, Token.TokenKind.Comma, Constant.MiscConstantKind.Comma);

        const element: Ast.TCsv & Ast.ICsv<T> = {
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
            kind: csvNodeKind,
            isLeaf: false,
            node,
            maybeCommaConstant,
        };
        IParserStateUtils.endContext(state, element);
        elements.push(element);

        continueReadingValues = maybeCommaConstant !== undefined;
    }

    const astNode: Ast.ICsvArray<T> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

function readKeyValuePair<S extends IParserState, Kind extends Ast.TKeyValuePairNodeKind, Key, Value>(
    state: S,
    nodeKind: Kind,
    keyReader: () => Key,
    valueReader: () => Value,
): Ast.IKeyValuePair<Kind, Key, Value> {
    IParserStateUtils.startContext(state, nodeKind);

    const key: Key = keyReader();
    const equalConstant: Ast.IConstant<Constant.MiscConstantKind.Equal> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstantKind.Equal,
    );
    const value: Value = valueReader();

    const keyValuePair: Ast.IKeyValuePair<Kind, Key, Value> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        key,
        equalConstant,
        value,
    };
    IParserStateUtils.endContext(state, (keyValuePair as unknown) as Ast.TKeyValuePair);
    return keyValuePair;
}

function readPairedConstant<
    S extends IParserState,
    Kind extends Ast.TPairedConstantNodeKind,
    ConstantKind extends Constant.TConstantKind,
    Paired
>(
    state: S,
    nodeKind: Kind,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, ConstantKind, Paired> {
    IParserStateUtils.startContext(state, nodeKind);

    const constant: Ast.TConstant & Ast.IConstant<ConstantKind> = constantReader();
    const paired: Paired = pairedReader();

    const pairedConstant: Ast.IPairedConstant<Kind, ConstantKind, Paired> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        constant,
        paired,
    };

    IParserStateUtils.endContext(state, (pairedConstant as unknown) as Ast.TPairedConstant);

    return pairedConstant;
}

function maybeReadPairedConstant<
    S extends IParserState,
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
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function genericReadParameterList<S extends IParserState, T extends Ast.TParameterType>(
    state: S,
    parser: IParser<S>,
    typeReader: () => T,
): Ast.IParameterList<T> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;
    IParserStateUtils.startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.IConstant<Constant.WrapperConstantKind.LeftParenthesis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftParenthesis,
        Constant.WrapperConstantKind.LeftParenthesis,
    );
    let continueReadingValues: boolean = !IParserStateUtils.isOnTokenKind(state, Token.TokenKind.RightParenthesis);
    let reachedOptionalParameter: boolean = false;

    const paramterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    IParserStateUtils.startContext(state, paramterArrayNodeKind);

    const parameters: Ast.ICsv<Ast.IParameter<T>>[] = [];
    while (continueReadingValues) {
        IParserStateUtils.startContext(state, Ast.NodeKind.Csv);
        IParserStateUtils.startContext(state, Ast.NodeKind.Parameter);

        const maybeErr: ParseError.TInnerParseError | undefined = testCsvContinuationDanglingCommaForParenthesis(state);
        if (maybeErr) {
            throw maybeErr;
        }

        const maybeOptionalConstant:
            | Ast.IConstant<Constant.IdentifierConstantKind.Optional>
            | undefined = maybeReadConstantKind(state, Constant.IdentifierConstantKind.Optional);

        if (reachedOptionalParameter && !maybeOptionalConstant) {
            const token: Token.Token = IParserStateUtils.assertGetTokenAt(state, state.tokenIndex);
            throw new ParseError.RequiredParameterAfterOptionalParameterError(
                state.localizationTemplates,
                token,
                state.lexerSnapshot.graphemePositionStartFrom(token),
            );
        } else if (maybeOptionalConstant) {
            reachedOptionalParameter = true;
        }

        const name: Ast.Identifier = parser.readIdentifier(state, parser);
        const maybeParameterType: T = typeReader();

        const parameter: Ast.IParameter<T> = {
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Parameter,
            isLeaf: false,
            maybeOptionalConstant,
            name,
            maybeParameterType,
        };
        IParserStateUtils.endContext(state, parameter);

        const maybeCommaConstant:
            | Ast.IConstant<Constant.MiscConstantKind.Comma>
            | undefined = maybeReadTokenKindAsConstant(state, Token.TokenKind.Comma, Constant.MiscConstantKind.Comma);
        continueReadingValues = maybeCommaConstant !== undefined;

        const csv: Ast.ICsv<Ast.IParameter<T>> = {
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Csv,
            isLeaf: false,
            node: parameter,
            maybeCommaConstant,
        };
        IParserStateUtils.endContext(state, csv);

        parameters.push(csv);
    }

    const parameterArray: Ast.ICsvArray<Ast.IParameter<T>> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: paramterArrayNodeKind,
        elements: parameters,
        isLeaf: false,
    };
    IParserStateUtils.endContext(state, parameterArray);

    const rightParenthesisConstant: Ast.IConstant<Constant.WrapperConstantKind.RightParenthesis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.RightParenthesis,
        Constant.WrapperConstantKind.RightParenthesis,
    );

    const astNode: Ast.IParameterList<T> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftParenthesisConstant,
        content: parameterArray,
        closeWrapperConstant: rightParenthesisConstant,
    };
    IParserStateUtils.endContext(state, astNode);
    return astNode;
}

function readWrapped<
    S extends IParserState,
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
    IParserStateUtils.startContext(state, nodeKind);

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
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

// ---------------------------------------------
// ---------- Helper functions (read) ----------
// ---------------------------------------------

export function readToken<S extends IParserState = IParserState>(state: S): string {
    state.maybeCancellationToken?.throwIfCancelled();

    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    Assert.isFalse(state.tokenIndex >= tokens.length, `index is beyond tokens.length`, {
        tokenIndex: state.tokenIndex,
        tokensLength: tokens.length,
    });

    const data: string = tokens[state.tokenIndex].data;
    state.tokenIndex += 1;

    if (state.tokenIndex === tokens.length) {
        state.maybeCurrentTokenKind = undefined;
    } else {
        state.maybeCurrentToken = tokens[state.tokenIndex];
        state.maybeCurrentTokenKind = state.maybeCurrentToken.kind;
    }

    return data;
}

export function readTokenKindAsConstant<S extends IParserState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    tokenKind: Token.TokenKind,
    constantKind: ConstantKind,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    state.maybeCancellationToken?.throwIfCancelled();
    IParserStateUtils.startContext(state, Ast.NodeKind.Constant);

    const maybeErr: ParseError.ExpectedTokenKindError | undefined = IParserStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const tokenData: string = readToken(state);
    Assert.isTrue(tokenData === constantKind, `expected tokenData to equal constantKind`, { tokenData, constantKind });

    const astNode: Ast.TConstant & Ast.IConstant<ConstantKind> = {
        ...IParserStateUtils.assertGetContextNodeMetadata(state),
        kind: Ast.NodeKind.Constant,
        isLeaf: true,
        constantKind,
    };
    IParserStateUtils.endContext(state, astNode);

    return astNode;
}

export function maybeReadTokenKindAsConstant<S extends IParserState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    tokenKind: Token.TokenKind,
    constantKind: ConstantKind,
): (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined {
    state.maybeCancellationToken?.throwIfCancelled();

    if (IParserStateUtils.isOnTokenKind(state, tokenKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParserStateUtils.startContext(state, nodeKind);

        const tokenData: string = readToken(state);
        Assert.isTrue(tokenData === constantKind, `expected tokenData to equal constantKind`, {
            tokenData,
            constantKind,
        });

        const astNode: Ast.TConstant & Ast.IConstant<ConstantKind> = {
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

function readTokenKind(state: IParserState, tokenKind: Token.TokenKind): string {
    const maybeErr: ParseError.ExpectedTokenKindError | undefined = IParserStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    return readToken(state);
}

function readConstantKind<S extends IParserState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    constantKind: ConstantKind,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    const maybeConstant: (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined = maybeReadConstantKind(
        state,
        constantKind,
    );
    Assert.isDefined(maybeConstant, `couldn't conver constantKind`, { constantKind });

    return maybeConstant;
}

function maybeReadConstantKind<S extends IParserState, ConstantKind extends Constant.TConstantKind>(
    state: S,
    constantKind: ConstantKind,
): (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined {
    if (IParserStateUtils.isOnConstantKind(state, constantKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        IParserStateUtils.startContext(state, nodeKind);

        readToken(state);
        const astNode: Ast.TConstant & Ast.IConstant<ConstantKind> = {
            ...IParserStateUtils.assertGetContextNodeMetadata(state),
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

function maybeReadLiteralAttributes<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
): Ast.RecordLiteral | undefined {
    if (IParserStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else {
        IParserStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

// -------------------------------------------------------
// ---------- Helper functions (disambiguation) ----------
// -------------------------------------------------------

export function readBracketDisambiguation<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
    allowedVariants: ReadonlyArray<BracketDisambiguation>,
): Ast.FieldProjection | Ast.FieldSelector | Ast.RecordExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    const triedDisambiguation: Result<
        BracketDisambiguation,
        ParseError.UnterminatedSequence
    > = parser.disambiguateBracket(state, parser);
    if (ResultUtils.isErr(triedDisambiguation)) {
        throw triedDisambiguation.error;
    }
    const disambiguation: BracketDisambiguation = triedDisambiguation.value;
    ArrayUtils.assertIn(allowedVariants, disambiguation, `invalid disambiguation`);

    switch (disambiguation) {
        case BracketDisambiguation.FieldProjection:
            return parser.readFieldProjection(state, parser);

        case BracketDisambiguation.FieldSelection:
            return parser.readFieldSelection(state, parser);

        case BracketDisambiguation.Record:
            return parser.readRecordExpression(state, parser);

        default:
            throw Assert.isNever(disambiguation);
    }
}

// -------------------------------------------------------
// ---------- Helper functions (test functions) ----------
// -------------------------------------------------------

function testCsvContinuationDanglingCommaForBrace<S extends IParserState = IParserState>(
    state: S,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightBrace);
}

function testCsvContinuationDanglingCommaForBracket<S extends IParserState = IParserState>(
    state: S,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightBracket);
}

function testCsvContinuationDanglingCommaForParenthesis<S extends IParserState = IParserState>(
    state: S,
): ParseError.ExpectedCsvContinuationError | undefined {
    return IParserStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightParenthesis);
}
