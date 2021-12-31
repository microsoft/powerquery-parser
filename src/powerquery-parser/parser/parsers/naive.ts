// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

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
import { Disambiguation, DisambiguationUtils } from "../disambiguation";
import { NodeIdMap, ParseContext, ParseContextUtils, ParseError } from "..";
import { Parser, ParseStateCheckpoint } from "../parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { Trace, TraceConstant } from "../../common/trace";
import { LexerSnapshot } from "../../lexer";
import { NodeIdMapUtils } from "../nodeIdMap";

const enum NaiveTraceConstant {
    IsFieldTypeSpecification = "isFieldTypeSpecification",
    IsOperatorPresent = "IsOperatorPresent",
    IsRecursive = "IsRecursive",
    Parse = "Parse",
    TokenIndex = "TokenIndex",
}

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
    Open extends Constant.WrapperConstant,
    Content,
    Close extends Constant.WrapperConstant,
> extends Ast.IWrapped<Kind, Open, Content, Close> {
    readonly maybeOptionalConstant: Ast.IConstant<Constant.MiscConstant.QuestionMark> | undefined;
}

const GeneralizedIdentifierTerminatorTokenKinds: ReadonlyArray<Token.TokenKind> = [
    Token.TokenKind.Comma,
    Token.TokenKind.Equal,
    Token.TokenKind.RightBracket,
];

// ----------------------------------------
// ---------- 12.1.6 Identifiers ----------
// ----------------------------------------

export function readIdentifier(state: ParseState, _parser: Parser): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIdentifier.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

    const literal: string = readTokenKind(state, Token.TokenKind.Identifier);

    const identifier: Ast.Identifier = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };

    ParseStateUtils.endContext(state, identifier);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return identifier;
}

// This behavior matches the C# parser and not the language specification.
export function readGeneralizedIdentifier(state: ParseState, _parser: Parser): Ast.GeneralizedIdentifier {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readGeneralizedIdentifier.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

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
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsThrowing]: true,
        });

        throw new ParseError.ExpectedGeneralizedIdentifierError(
            state.locale,
            ParseStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
        );
    }

    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const tokens: ReadonlyArray<Token.Token> = lexerSnapshot.tokens;
    const contiguousIdentifierStartIndex: number = tokens[tokenRangeStartIndex].positionStart.codeUnit;
    const contiguousIdentifierEndIndex: number = tokens[tokenRangeEndIndex - 1].positionEnd.codeUnit;
    const literal: string = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);
    const literalKind: StringUtils.IdentifierKind = StringUtils.identifierKind(literal, true);

    if (literalKind === StringUtils.IdentifierKind.Invalid) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsThrowing]: true,
        });

        throw new ParseError.ExpectedGeneralizedIdentifierError(
            state.locale,
            ParseStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
        );
    }

    const generalizedIdentifier: Ast.GeneralizedIdentifier = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
    };
    ParseStateUtils.endContext(state, generalizedIdentifier);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsThrowing]: false,
    });

    return generalizedIdentifier;
}

export function readKeyword(state: ParseState, _parser: Parser): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readKeyword.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

    // Keywords can't have a "@" prefix constant
    ParseStateUtils.incrementAttributeCounter(state);

    const identifierNodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;
    ParseStateUtils.startContext(state, identifierNodeKind);

    const literal: string = readToken(state);
    const identifier: Ast.Identifier = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: identifierNodeKind,
        isLeaf: true,
        literal,
    };
    ParseStateUtils.endContext(state, identifier);

    const identifierExpression: Ast.IdentifierExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeInclusiveConstant: undefined,
        identifier,
    };
    ParseStateUtils.endContext(state, identifierExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return identifierExpression;
}

// --------------------------------------
// ---------- 12.2.1 Documents ----------
// --------------------------------------

export function readDocument(state: ParseState, parser: Parser): Ast.TDocument {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readDocument.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    let document: Ast.TDocument;
    // Try parsing as an Expression document first.
    // If Expression document fails (including UnusedTokensRemainError) then try parsing a SectionDocument.
    // If both fail then return the error which parsed more tokens.
    try {
        document = parser.readExpression(state, parser);
        ParseStateUtils.assertIsDoneParsing(state);
    } catch (expressionError) {
        Assert.isInstanceofError(expressionError);

        // Fast backup deletes context state, but we want to preserve it for the case
        // where both parsing an expression and section document error out.
        const expressionCheckpoint: ParseStateCheckpoint = parser.createCheckpoint(state);
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
            ParseStateUtils.assertIsDoneParsing(state);
        } catch (sectionError) {
            Assert.isInstanceofError(sectionError);

            let triedError: Error;
            if (expressionCheckpoint.tokenIndex > /* sectionErrorState */ state.tokenIndex) {
                triedError = expressionError;
                parser.restoreCheckpoint(state, expressionCheckpoint);
                state.contextState = expressionErrorContextState;
            } else {
                triedError = sectionError;
            }

            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

            throw triedError;
        }
    }

    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsThrowing]: false,
    });

    return document;
}

// ----------------------------------------------
// ---------- 12.2.2 Section Documents ----------
// ----------------------------------------------

export function readSectionDocument(state: ParseState, parser: Parser): Ast.Section {
    const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readSectionDocument.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = maybeReadLiteralAttributes(state, parser);
    const sectionConstant: Ast.IConstant<Constant.KeywordConstant.Section> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordSection,
        Constant.KeywordConstant.Section,
    );

    let maybeName: Ast.Identifier | undefined;
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.Identifier)) {
        maybeName = parser.readIdentifier(state, parser);
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
    }

    const semicolonConstant: Ast.IConstant<Constant.MiscConstant.Semicolon> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Semicolon,
        Constant.MiscConstant.Semicolon,
    );
    const sectionMembers: Ast.IArrayWrapper<Ast.SectionMember> = parser.readSectionMembers(state, parser);

    const section: Ast.Section = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeLiteralAttributes,
        sectionConstant,
        maybeName,
        semicolonConstant,
        sectionMembers,
    };
    ParseStateUtils.endContext(state, section);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return section;
}

export function readSectionMembers(state: ParseState, parser: Parser): Ast.IArrayWrapper<Ast.SectionMember> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readSectionMembers.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const totalTokens: number = state.lexerSnapshot.tokens.length;
    const sectionMembers: Ast.SectionMember[] = [];
    while (state.tokenIndex < totalTokens) {
        sectionMembers.push(parser.readSectionMember(state, parser));
    }

    const sectionMemberArray: Ast.IArrayWrapper<Ast.SectionMember> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements: sectionMembers,
    };
    ParseStateUtils.endContext(state, sectionMemberArray);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return sectionMemberArray;
}

export function readSectionMember(state: ParseState, parser: Parser): Ast.SectionMember {
    const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readSectionMember.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = maybeReadLiteralAttributes(state, parser);
    const maybeSharedConstant: Ast.IConstant<Constant.KeywordConstant.Shared> | undefined =
        maybeReadTokenKindAsConstant(state, Token.TokenKind.KeywordShared, Constant.KeywordConstant.Shared);
    const namePairedExpression: Ast.IdentifierPairedExpression = parser.readIdentifierPairedExpression(state, parser);
    const semicolonConstant: Ast.IConstant<Constant.MiscConstant.Semicolon> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Semicolon,
        Constant.MiscConstant.Semicolon,
    );

    const sectionMember: Ast.SectionMember = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeLiteralAttributes,
        maybeSharedConstant,
        namePairedExpression,
        semicolonConstant,
    };
    ParseStateUtils.endContext(state, sectionMember);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return sectionMember;
}

// ------------------------------------------
// ---------- 12.2.3.1 Expressions ----------
// ------------------------------------------

// ------------------------------------
// ---------- NullCoalescing ----------
// ------------------------------------

export function readNullCoalescingExpression(state: ParseState, parser: Parser): Ast.TExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readNullCoalescingExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const expression: Ast.TExpression = recursiveReadBinOpExpression<
        Ast.NodeKind.NullCoalescingExpression,
        Ast.TLogicalExpression,
        Constant.MiscConstant.NullCoalescingOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.NullCoalescingExpression,
        () => parser.readLogicalExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            maybeCurrentTokenKind === Token.TokenKind.NullCoalescingOperator
                ? Constant.MiscConstant.NullCoalescingOperator
                : undefined,
        () => parser.readLogicalExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return expression;
}

export function readExpression(state: ParseState, parser: Parser): Ast.TExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    let expression: Ast.TExpression;
    switch (state.maybeCurrentTokenKind) {
        case Token.TokenKind.KeywordEach:
            expression = parser.readEachExpression(state, parser);
            break;

        case Token.TokenKind.KeywordLet:
            expression = parser.readLetExpression(state, parser);
            break;

        case Token.TokenKind.KeywordIf:
            expression = parser.readIfExpression(state, parser);
            break;

        case Token.TokenKind.KeywordError:
            expression = parser.readErrorRaisingExpression(state, parser);
            break;

        case Token.TokenKind.KeywordTry:
            expression = parser.readErrorHandlingExpression(state, parser);
            break;

        case Token.TokenKind.LeftParenthesis:
            expression = DisambiguationUtils.readAmbiguousParenthesis(state, parser);
            break;

        default:
            expression = parser.readNullCoalescingExpression(state, parser);
            break;
    }

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return expression;
}

// --------------------------------------------------
// ---------- 12.2.3.2 Logical expressions ----------
// --------------------------------------------------

export function readLogicalExpression(state: ParseState, parser: Parser): Ast.TLogicalExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readLogicalExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const logicalExpression: Ast.TLogicalExpression = recursiveReadBinOpExpression<
        Ast.NodeKind.LogicalExpression,
        Ast.TLogicalExpression,
        Constant.LogicalOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.LogicalExpression,
        () => parser.readIsExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeLogicalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readIsExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return logicalExpression;
}

// --------------------------------------------
// ---------- 12.2.3.3 Is expression ----------
// --------------------------------------------

export function readIsExpression(state: ParseState, parser: Parser): Ast.TIsExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIsExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const isExpression: Ast.TIsExpression = recursiveReadBinOpExpression<
        Ast.NodeKind.IsExpression,
        Ast.TAsExpression,
        Constant.KeywordConstant.Is,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.IsExpression,
        () => parser.readAsExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            maybeCurrentTokenKind === Token.TokenKind.KeywordIs ? Constant.KeywordConstant.Is : undefined,
        () => parser.readNullablePrimitiveType(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return isExpression;
}

// sub-item of 12.2.3.3 Is expression
export function readNullablePrimitiveType(state: ParseState, parser: Parser): Ast.TNullablePrimitiveType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readNullablePrimitiveType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    let nullablePrimitiveType: Ast.TNullablePrimitiveType;
    if (ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Nullable)) {
        nullablePrimitiveType = readPairedConstant(
            state,
            Ast.NodeKind.NullablePrimitiveType,
            () => readConstantKind(state, Constant.LanguageConstant.Nullable),
            () => parser.readPrimitiveType(state, parser),
        );
    } else {
        nullablePrimitiveType = parser.readPrimitiveType(state, parser);
    }
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return nullablePrimitiveType;
}

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

export function readAsExpression(state: ParseState, parser: Parser): Ast.TAsExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAsExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const asExpression: Ast.TAsExpression = recursiveReadBinOpExpression<
        Ast.NodeKind.AsExpression,
        Ast.TEqualityExpression,
        Constant.KeywordConstant.As,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.AsExpression,
        () => parser.readEqualityExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            maybeCurrentTokenKind === Token.TokenKind.KeywordAs ? Constant.KeywordConstant.As : undefined,
        () => parser.readNullablePrimitiveType(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return asExpression;
}

// --------------------------------------------------
// ---------- 12.2.3.5 Equality expression ----------
// --------------------------------------------------

export function readEqualityExpression(state: ParseState, parser: Parser): Ast.TEqualityExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readEqualityExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const equalityExpression: Ast.TEqualityExpression = recursiveReadBinOpExpression<
        Ast.NodeKind.EqualityExpression,
        Ast.TEqualityExpression,
        Constant.EqualityOperator,
        Ast.TEqualityExpression
    >(
        state,
        Ast.NodeKind.EqualityExpression,
        () => parser.readRelationalExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeEqualityOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readRelationalExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return equalityExpression;
}

// ----------------------------------------------------
// ---------- 12.2.3.6 Relational expression ----------
// ----------------------------------------------------

export function readRelationalExpression(state: ParseState, parser: Parser): Ast.TRelationalExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRelationalExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const relationalExpression: Ast.TRelationalExpression = recursiveReadBinOpExpression<
        Ast.NodeKind.RelationalExpression,
        Ast.TArithmeticExpression,
        Constant.RelationalOperator,
        Ast.TArithmeticExpression
    >(
        state,
        Ast.NodeKind.RelationalExpression,
        () => parser.readArithmeticExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeRelationalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readArithmeticExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return relationalExpression;
}

// -----------------------------------------------------
// ---------- 12.2.3.7 Arithmetic expressions ----------
// -----------------------------------------------------

export function readArithmeticExpression(state: ParseState, parser: Parser): Ast.TArithmeticExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readArithmeticExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const arithmeticExpression: Ast.TArithmeticExpression = recursiveReadBinOpExpression<
        Ast.NodeKind.ArithmeticExpression,
        Ast.TMetadataExpression,
        Constant.ArithmeticOperator,
        Ast.TMetadataExpression
    >(
        state,
        Ast.NodeKind.ArithmeticExpression,
        () => parser.readMetadataExpression(state, parser),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeArithmeticOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readMetadataExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return arithmeticExpression;
}

// --------------------------------------------------
// ---------- 12.2.3.8 Metadata expression ----------
// --------------------------------------------------

export function readMetadataExpression(state: ParseState, parser: Parser): Ast.TMetadataExpression {
    const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readMetadataExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);
    const maybeMetaConstant: Ast.IConstant<Constant.KeywordConstant.Meta> | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordMeta,
        Constant.KeywordConstant.Meta,
    );

    if (maybeMetaConstant !== undefined) {
        const operatorConstant: Ast.IConstant<Constant.KeywordConstant.Meta> = maybeMetaConstant;
        const right: Ast.TUnaryExpression = parser.readUnaryExpression(state, parser);

        const metadataExpression: Ast.MetadataExpression = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            operatorConstant,
            right,
        };

        ParseStateUtils.endContext(state, metadataExpression);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: true,
        });

        return metadataExpression;
    } else {
        ParseStateUtils.deleteContext(state, undefined);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });

        return left;
    }
}

// -----------------------------------------------
// ---------- 12.2.3.9 Unary expression ----------
// -----------------------------------------------

export function readUnaryExpression(state: ParseState, parser: Parser): Ast.TUnaryExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readUnaryExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    let maybeOperator: Constant.UnaryOperator | undefined = ConstantUtils.maybeUnaryOperatorKindFrom(
        state.maybeCurrentTokenKind,
    );
    if (maybeOperator === undefined) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });
        return parser.readTypeExpression(state, parser);
    }

    const unaryNodeKind: Ast.NodeKind.UnaryExpression = Ast.NodeKind.UnaryExpression;
    ParseStateUtils.startContext(state, unaryNodeKind);

    const arrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, arrayNodeKind);

    const operatorConstants: Ast.IConstant<Constant.UnaryOperator>[] = [];
    while (maybeOperator) {
        operatorConstants.push(
            readTokenKindAsConstant(state, state.maybeCurrentTokenKind as Token.TokenKind, maybeOperator),
        );
        maybeOperator = ConstantUtils.maybeUnaryOperatorKindFrom(state.maybeCurrentTokenKind);
    }
    const operators: Ast.IArrayWrapper<Ast.IConstant<Constant.UnaryOperator>> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: arrayNodeKind,
        isLeaf: false,
        elements: operatorConstants,
    };
    ParseStateUtils.endContext(state, operators);

    const typeExpression: Ast.TTypeExpression = parser.readTypeExpression(state, parser);

    const unaryExpression: Ast.UnaryExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: unaryNodeKind,
        isLeaf: false,
        operators,
        typeExpression,
    };
    ParseStateUtils.endContext(state, unaryExpression);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [NaiveTraceConstant.IsOperatorPresent]: true,
    });

    return unaryExpression;
}

// --------------------------------------------------
// ---------- 12.2.3.10 Primary expression ----------
// --------------------------------------------------

export function readPrimaryExpression(state: ParseState, parser: Parser): Ast.TPrimaryExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPrimaryExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
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

    if (ParseStateUtils.isRecursivePrimaryExpressionNext(state)) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsRecursive]: true,
        });

        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
    } else {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsRecursive]: false,
        });

        return primaryExpression;
    }
}

export function readRecursivePrimaryExpression(
    state: ParseState,
    parser: Parser,
    head: Ast.TPrimaryExpression,
): Ast.RecursivePrimaryExpression {
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecursivePrimaryExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const currentContextNode: ParseContext.TNode = Assert.asDefined(
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
    const mutableContext: TypeScriptUtils.StripReadonly<ParseContext.TNode> = currentContextNode;
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

    // Begin normal parsing.
    const recursiveArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, recursiveArrayNodeKind);

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
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: recursiveArrayNodeKind,
        isLeaf: false,
        elements: recursiveExpressions,
    };
    ParseStateUtils.endContext(state, recursiveArray);

    const recursivePrimaryExpression: Ast.RecursivePrimaryExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        head,
        recursiveExpressions: recursiveArray,
    };
    ParseStateUtils.endContext(state, recursivePrimaryExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return recursivePrimaryExpression;
}

// --------------------------------------------------
// ---------- 12.2.3.11 Literal expression ----------
// --------------------------------------------------

export function readLiteralExpression(state: ParseState, _parser: Parser): Ast.LiteralExpression {
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readLiteralExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

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
    const maybeError: ParseError.ExpectedAnyTokenKindError | undefined = ParseStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeError) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsThrowing]: true,
        });

        throw maybeError;
    }

    const literalKind: Ast.LiteralKind = Assert.asDefined(
        AstUtils.maybeLiteralKindFrom(state.maybeCurrentTokenKind),
        `couldn't convert TokenKind into LiteralKind`,
        { maybeCurrentTokenKind: state.maybeCurrentTokenKind },
    );

    const literal: string = readToken(state);
    const literalExpression: Ast.LiteralExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        literal,
        literalKind,
    };
    ParseStateUtils.endContext(state, literalExpression);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsThrowing]: false,
    });

    return literalExpression;
}

// -----------------------------------------------------
// ---------- 12.2.3.12 Identifier expression ----------
// -----------------------------------------------------

export function readIdentifierExpression(state: ParseState, parser: Parser): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIdentifierExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeInclusiveConstant: Ast.IConstant<Constant.MiscConstant.AtSign> | undefined =
        maybeReadTokenKindAsConstant(state, Token.TokenKind.AtSign, Constant.MiscConstant.AtSign);
    const identifier: Ast.Identifier = parser.readIdentifier(state, parser);

    const identifierExpression: Ast.IdentifierExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        maybeInclusiveConstant,
        identifier,
    };
    ParseStateUtils.endContext(state, identifierExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return identifierExpression;
}

// --------------------------------------------------------
// ---------- 12.2.3.14 Parenthesized expression ----------
// --------------------------------------------------------

export function readParenthesizedExpression(state: ParseState, parser: Parser): Ast.ParenthesizedExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readParenthesizedExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const parenthesizedExpression: Ast.ParenthesizedExpression = readWrapped(
        state,
        Ast.NodeKind.ParenthesizedExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftParenthesis, Constant.WrapperConstant.LeftParenthesis),
        () => parser.readExpression(state, parser),
        () =>
            readTokenKindAsConstant(state, Token.TokenKind.RightParenthesis, Constant.WrapperConstant.RightParenthesis),
        false,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return parenthesizedExpression;
}

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

export function readNotImplementedExpression(state: ParseState, _parser: Parser): Ast.NotImplementedExpression {
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readNotImplementedExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const ellipsisConstant: Ast.IConstant<Constant.MiscConstant.Ellipsis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Ellipsis,
        Constant.MiscConstant.Ellipsis,
    );

    const notImplementedExpression: Ast.NotImplementedExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ellipsisConstant,
    };
    ParseStateUtils.endContext(state, notImplementedExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return notImplementedExpression;
}

// ---------------------------------------
// ---------- Invoke expression ----------
// ---------------------------------------

export function readInvokeExpression(state: ParseState, parser: Parser): Ast.InvokeExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readInvokeExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightParenthesis);
    const invokeExpression: Ast.InvokeExpression = readWrapped(
        state,
        Ast.NodeKind.InvokeExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftParenthesis, Constant.WrapperConstant.LeftParenthesis),
        () =>
            // The type inference in VSCode considers the lambda below a type error, but it compiles just fine.
            // I'm adding an explicit type to stop it from (incorrectly) saying it's an error.
            readCsvArray<Ast.TExpression>(
                state,
                () => parser.readExpression(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForParenthesis,
            ),
        () =>
            readTokenKindAsConstant(state, Token.TokenKind.RightParenthesis, Constant.WrapperConstant.RightParenthesis),
        false,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return invokeExpression;
}

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

export function readListExpression(state: ParseState, parser: Parser): Ast.ListExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);
    const listExpression: Ast.ListExpression = readWrapped(
        state,
        Ast.NodeKind.ListExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace),
        () =>
            readCsvArray<Ast.TListItem>(
                state,
                () => parser.readListItem(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace),
        false,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listExpression;
}

export function readListItem(state: ParseState, parser: Parser): Ast.TListItem {
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListItem.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TExpression = parser.readExpression(state, parser);
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.DotDot)) {
        const rangeConstant: Ast.IConstant<Constant.MiscConstant.DotDot> = readTokenKindAsConstant(
            state,
            Token.TokenKind.DotDot,
            Constant.MiscConstant.DotDot,
        );
        const right: Ast.TExpression = parser.readExpression(state, parser);
        const rangeExpression: Ast.RangeExpression = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            rangeConstant,
            right,
        };

        ParseStateUtils.endContext(state, rangeExpression);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: true,
        });

        return rangeExpression;
    } else {
        ParseStateUtils.deleteContext(state, undefined);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });

        return left;
    }
}

// -------------------------------------------------
// ---------- 12.2.3.18 Record expression ----------
// -------------------------------------------------

export function readRecordExpression(state: ParseState, parser: Parser): Ast.RecordExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecordExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);
    const recordExpression: Ast.RecordExpression = readWrapped(
        state,
        Ast.NodeKind.RecordExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket),
        () =>
            parser.readGeneralizedIdentifierPairedExpressions(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstant.RightBracket),
        false,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return recordExpression;
}

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

export function readItemAccessExpression(state: ParseState, parser: Parser): Ast.ItemAccessExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readItemAccessExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const itemAccessExpression: Ast.ItemAccessExpression = readWrapped(
        state,
        Ast.NodeKind.ItemAccessExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace),
        () => parser.readExpression(state, parser),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace),
        true,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return itemAccessExpression;
}

// -------------------------------------------------------
// ---------- 12.2.3.20 Field access expression ----------
// -------------------------------------------------------

export function readFieldSelection(state: ParseState, parser: Parser): Ast.FieldSelector {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldSelection.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const fieldSelector: Ast.FieldSelector = readFieldSelector(state, parser, true);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldSelector;
}

export function readFieldProjection(state: ParseState, parser: Parser): Ast.FieldProjection {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldProjection.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const fieldProjection: Ast.FieldProjection = readWrapped(
        state,
        Ast.NodeKind.FieldProjection,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket),
        () =>
            readCsvArray(
                state,
                () => parser.readFieldSelector(state, parser, false),
                true,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstant.RightBracket),
        true,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldProjection;
}

export function readFieldSelector(state: ParseState, parser: Parser, allowOptional: boolean): Ast.FieldSelector {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldSelector.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const fieldSelector: Ast.FieldSelector = readWrapped(
        state,
        Ast.NodeKind.FieldSelector,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket),
        () => parser.readGeneralizedIdentifier(state, parser),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstant.RightBracket),
        allowOptional,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldSelector;
}

// ---------------------------------------------------
// ---------- 12.2.3.21 Function expression ----------
// ---------------------------------------------------

export function readFunctionExpression(state: ParseState, parser: Parser): Ast.FunctionExpression {
    const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFunctionExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const parameters: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = parser.readParameterList(
        state,
        parser,
    );
    const maybeFunctionReturnType: Ast.AsNullablePrimitiveType | undefined = maybeReadAsNullablePrimitiveType(
        state,
        parser,
    );
    const fatArrowConstant: Ast.IConstant<Constant.MiscConstant.FatArrow> = readTokenKindAsConstant(
        state,
        Token.TokenKind.FatArrow,
        Constant.MiscConstant.FatArrow,
    );
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const functionExpression: Ast.FunctionExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        parameters,
        maybeFunctionReturnType,
        fatArrowConstant,
        expression,
    };
    ParseStateUtils.endContext(state, functionExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return functionExpression;
}

export function readParameterList(
    state: ParseState,
    parser: Parser,
): Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readParameterList.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const parameterList: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = genericReadParameterList(
        state,
        parser,
        () => maybeReadAsNullablePrimitiveType(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return parameterList;
}

function maybeReadAsNullablePrimitiveType(state: ParseState, parser: Parser): Ast.AsNullablePrimitiveType | undefined {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, maybeReadAsNullablePrimitiveType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const maybeAsNullablePrimitiveType: Ast.AsNullablePrimitiveType | undefined = maybeReadPairedConstant(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => ParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordAs, Constant.KeywordConstant.As),
        () => parser.readNullablePrimitiveType(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return maybeAsNullablePrimitiveType;
}

export function readAsType(state: ParseState, parser: Parser): Ast.AsType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAsType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const asType: Ast.AsType = readPairedConstant(
        state,
        Ast.NodeKind.AsType,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordAs, Constant.KeywordConstant.As),
        () => parser.readType(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return asType;
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

export function readEachExpression(state: ParseState, parser: Parser): Ast.EachExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readEachExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const eachExpression: Ast.EachExpression = readPairedConstant(
        state,
        Ast.NodeKind.EachExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordEach, Constant.KeywordConstant.Each),
        () => parser.readExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return eachExpression;
}

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

export function readLetExpression(state: ParseState, parser: Parser): Ast.LetExpression {
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readLetExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const letConstant: Ast.IConstant<Constant.KeywordConstant.Let> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordLet,
        Constant.KeywordConstant.Let,
    );
    const identifierPairedExpression: Ast.ICsvArray<Ast.IdentifierPairedExpression> =
        parser.readIdentifierPairedExpressions(
            state,
            parser,
            !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.KeywordIn),
            ParseStateUtils.testCsvContinuationLetExpression,
        );
    const inConstant: Ast.IConstant<Constant.KeywordConstant.In> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordIn,
        Constant.KeywordConstant.In,
    );
    const expression: Ast.TExpression = parser.readExpression(state, parser);

    const letExpression: Ast.LetExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: Ast.NodeKind.LetExpression,
        isLeaf: false,
        letConstant,
        variableList: identifierPairedExpression,
        inConstant,
        expression,
    };
    ParseStateUtils.endContext(state, letExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return letExpression;
}

// ---------------------------------------------
// ---------- 12.2.3.24 If expression ----------
// ---------------------------------------------

export function readIfExpression(state: ParseState, parser: Parser): Ast.IfExpression {
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIfExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const ifConstant: Ast.IConstant<Constant.KeywordConstant.If> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordIf,
        Constant.KeywordConstant.If,
    );
    const condition: Ast.TExpression = parser.readExpression(state, parser);

    const thenConstant: Ast.IConstant<Constant.KeywordConstant.Then> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordThen,
        Constant.KeywordConstant.Then,
    );
    const trueExpression: Ast.TExpression = parser.readExpression(state, parser);

    const elseConstant: Ast.IConstant<Constant.KeywordConstant.Else> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordElse,
        Constant.KeywordConstant.Else,
    );
    const falseExpression: Ast.TExpression = parser.readExpression(state, parser);

    const ifExpression: Ast.IfExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        ifConstant,
        condition,
        thenConstant,
        trueExpression,
        elseConstant,
        falseExpression,
    };
    ParseStateUtils.endContext(state, ifExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return ifExpression;
}

// -----------------------------------------------
// ---------- 12.2.3.25 Type expression ----------
// -----------------------------------------------

export function readTypeExpression(state: ParseState, parser: Parser): Ast.TTypeExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readTypeExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    let typeExpression: Ast.TTypeExpression;
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordType)) {
        typeExpression = readPairedConstant(
            state,
            Ast.NodeKind.TypePrimaryType,
            () => readTokenKindAsConstant(state, Token.TokenKind.KeywordType, Constant.KeywordConstant.Type),
            () => parser.readPrimaryType(state, parser),
        );
    } else {
        typeExpression = parser.readPrimaryExpression(state, parser);
    }
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return typeExpression;
}

export function readType(state: ParseState, parser: Parser): Ast.TType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);
    if (ResultUtils.isOk(triedReadPrimaryType)) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: false,
        });

        return triedReadPrimaryType.value;
    } else {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        return parser.readPrimaryExpression(state, parser);
    }
}

export function readPrimaryType(state: ParseState, parser: Parser): Ast.TPrimaryType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPrimaryType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = tryReadPrimaryType(state, parser);
    if (ResultUtils.isOk(triedReadPrimaryType)) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: false,
        });

        return triedReadPrimaryType.value;
    } else {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        throw triedReadPrimaryType.error;
    }
}

export function readRecordType(state: ParseState, parser: Parser): Ast.RecordType {
    const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecordType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const fields: Ast.FieldSpecificationList = parser.readFieldSpecificationList(
        state,
        parser,
        true,
        testCsvContinuationDanglingCommaForBracket,
    );

    const recordType: Ast.RecordType = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        fields,
    };
    ParseStateUtils.endContext(state, recordType);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return recordType;
}

export function readTableType(state: ParseState, parser: Parser): Ast.TableType {
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readTableType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const tableConstant: Ast.IConstant<Constant.PrimitiveTypeConstant.Table> = readConstantKind(
        state,
        Constant.PrimitiveTypeConstant.Table,
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

    const tableType: Ast.TableType = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tableConstant,
        rowType,
    };
    ParseStateUtils.endContext(state, tableType);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return tableType;
}

export function readFieldSpecificationList(
    state: ParseState,
    parser: Parser,
    allowOpenMarker: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
): Ast.FieldSpecificationList {
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldSpecificationList.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const leftBracketConstant: Ast.IConstant<Constant.WrapperConstant.LeftBracket> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftBracket,
        Constant.WrapperConstant.LeftBracket,
    );
    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = true;
    let isOnOpenRecordMarker: boolean = false;

    const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, fieldArrayNodeKind);

    while (continueReadingValues) {
        const maybeError: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeError) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });
            throw maybeError;
        }

        if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.Ellipsis)) {
            if (allowOpenMarker) {
                if (isOnOpenRecordMarker) {
                    trace.exit({
                        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                        [TraceConstant.IsThrowing]: true,
                    });

                    throw fieldSpecificationListReadError(state, false);
                } else {
                    isOnOpenRecordMarker = true;
                    continueReadingValues = false;
                }
            } else {
                trace.exit({
                    [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                    [TraceConstant.IsThrowing]: true,
                });

                throw fieldSpecificationListReadError(state, allowOpenMarker);
            }
        } else if (ParseStateUtils.isOnGeneralizedIdentifierStart(state)) {
            const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
            ParseStateUtils.startContext(state, csvNodeKind);

            const fieldSpecificationNodeKind: Ast.NodeKind.FieldSpecification = Ast.NodeKind.FieldSpecification;
            ParseStateUtils.startContext(state, fieldSpecificationNodeKind);

            const maybeOptionalConstant: Ast.IConstant<Constant.LanguageConstant.Optional> | undefined =
                maybeReadConstantKind(state, Constant.LanguageConstant.Optional);

            const name: Ast.GeneralizedIdentifier = parser.readGeneralizedIdentifier(state, parser);

            const maybeFieldTypeSpecification: Ast.FieldTypeSpecification | undefined = maybeReadFieldTypeSpecification(
                state,
                parser,
            );

            const field: Ast.FieldSpecification = {
                ...ParseStateUtils.assertGetContextNodeMetadata(state),
                kind: fieldSpecificationNodeKind,
                isLeaf: false,
                maybeOptionalConstant,
                name,
                maybeFieldTypeSpecification,
            };
            ParseStateUtils.endContext(state, field);

            const maybeCommaConstant: Ast.IConstant<Constant.MiscConstant.Comma> | undefined =
                maybeReadTokenKindAsConstant(state, Token.TokenKind.Comma, Constant.MiscConstant.Comma);
            continueReadingValues = maybeCommaConstant !== undefined;

            const csv: Ast.ICsv<Ast.FieldSpecification> = {
                ...ParseStateUtils.assertGetContextNodeMetadata(state),
                kind: csvNodeKind,
                isLeaf: false,
                node: field,
                maybeCommaConstant,
            };
            ParseStateUtils.endContext(state, csv);
            fields.push(csv);
        } else {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

            throw fieldSpecificationListReadError(state, allowOpenMarker);
        }
    }

    const fieldArray: Ast.ICsvArray<Ast.FieldSpecification> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: fieldArrayNodeKind,
        elements: fields,
        isLeaf: false,
    };
    ParseStateUtils.endContext(state, fieldArray);

    let maybeOpenRecordMarkerConstant: Ast.IConstant<Constant.MiscConstant.Ellipsis> | undefined = undefined;
    if (isOnOpenRecordMarker) {
        maybeOpenRecordMarkerConstant = readTokenKindAsConstant(
            state,
            Token.TokenKind.Ellipsis,
            Constant.MiscConstant.Ellipsis,
        );
    }

    const rightBracketConstant: Ast.IConstant<Constant.WrapperConstant.RightBracket> = readTokenKindAsConstant(
        state,
        Token.TokenKind.RightBracket,
        Constant.WrapperConstant.RightBracket,
    );

    const fieldSpecificationList: Ast.FieldSpecificationList = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftBracketConstant,
        content: fieldArray,
        maybeOpenRecordMarkerConstant,
        closeWrapperConstant: rightBracketConstant,
    };
    ParseStateUtils.endContext(state, fieldSpecificationList);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldSpecificationList;
}

function maybeReadFieldTypeSpecification(state: ParseState, parser: Parser): Ast.FieldTypeSpecification | undefined {
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, maybeReadFieldTypeSpecification.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeEqualConstant: Ast.IConstant<Constant.MiscConstant.Equal> | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstant.Equal,
    );
    if (maybeEqualConstant) {
        const fieldType: Ast.TType = parser.readType(state, parser);

        const fieldTypeSpecification: Ast.FieldTypeSpecification = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.FieldTypeSpecification,
            isLeaf: false,
            equalConstant: maybeEqualConstant,
            fieldType,
        };
        ParseStateUtils.endContext(state, fieldTypeSpecification);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsFieldTypeSpecification]: true,
        });

        return fieldTypeSpecification;
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
        ParseStateUtils.deleteContext(state, undefined);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsFieldTypeSpecification]: false,
        });

        return undefined;
    }
}

function fieldSpecificationListReadError(state: ParseState, allowOpenMarker: boolean): Error | undefined {
    if (allowOpenMarker) {
        const expectedTokenKinds: ReadonlyArray<Token.TokenKind> = [
            Token.TokenKind.Identifier,
            Token.TokenKind.Ellipsis,
        ];
        return ParseStateUtils.testIsOnAnyTokenKind(state, expectedTokenKinds);
    } else {
        return ParseStateUtils.testIsOnTokenKind(state, Token.TokenKind.Identifier);
    }
}

export function readListType(state: ParseState, parser: Parser): Ast.ListType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const listType: Ast.ListType = readWrapped(
        state,
        Ast.NodeKind.ListType,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace),
        () => parser.readType(state, parser),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace),
        false,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listType;
}

export function readFunctionType(state: ParseState, parser: Parser): Ast.FunctionType {
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFunctionType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const functionConstant: Ast.IConstant<Constant.PrimitiveTypeConstant.Function> = readConstantKind(
        state,
        Constant.PrimitiveTypeConstant.Function,
    );
    const parameters: Ast.IParameterList<Ast.AsType> = parser.readParameterSpecificationList(state, parser);
    const functionReturnType: Ast.AsType = parser.readAsType(state, parser);

    const functionType: Ast.FunctionType = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        functionConstant,
        parameters,
        functionReturnType,
    };
    ParseStateUtils.endContext(state, functionType);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return functionType;
}

function tryReadPrimaryType(state: ParseState, parser: Parser): TriedReadPrimaryType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, tryReadPrimaryType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    const isTableTypeNext: boolean =
        ParseStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstant.Table) &&
        (ParseStateUtils.isNextTokenKind(state, Token.TokenKind.LeftBracket) ||
            ParseStateUtils.isNextTokenKind(state, Token.TokenKind.LeftParenthesis) ||
            ParseStateUtils.isNextTokenKind(state, Token.TokenKind.AtSign) ||
            ParseStateUtils.isNextTokenKind(state, Token.TokenKind.Identifier));
    const isFunctionTypeNext: boolean =
        ParseStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstant.Function) &&
        ParseStateUtils.isNextTokenKind(state, Token.TokenKind.LeftParenthesis);

    let attempt: TriedReadPrimaryType;
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        attempt = ResultUtils.boxOk(parser.readRecordType(state, parser));
    } else if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        attempt = ResultUtils.boxOk(parser.readListType(state, parser));
    } else if (isTableTypeNext) {
        attempt = ResultUtils.boxOk(parser.readTableType(state, parser));
    } else if (isFunctionTypeNext) {
        attempt = ResultUtils.boxOk(parser.readFunctionType(state, parser));
    } else if (ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Nullable)) {
        attempt = ResultUtils.boxOk(parser.readNullableType(state, parser));
    } else {
        const checkpoint: ParseStateCheckpoint = parser.createCheckpoint(state);
        const triedReadPrimitiveType: TriedReadPrimaryType = tryReadPrimitiveType(state, parser);

        if (ResultUtils.isError(triedReadPrimitiveType)) {
            parser.restoreCheckpoint(state, checkpoint);
        }
        attempt = triedReadPrimitiveType;
    }
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return attempt;
}

export function readParameterSpecificationList(state: ParseState, parser: Parser): Ast.IParameterList<Ast.AsType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readParameterSpecificationList.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const parameterList: Ast.IParameterList<Ast.AsType> = genericReadParameterList(state, parser, () =>
        parser.readAsType(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return parameterList;
}

export function readNullableType(state: ParseState, parser: Parser): Ast.NullableType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readNullableType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const nullableType: Ast.NullableType = readPairedConstant(
        state,
        Ast.NodeKind.NullableType,
        () => readConstantKind(state, Constant.LanguageConstant.Nullable),
        () => parser.readType(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return nullableType;
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export function readErrorRaisingExpression(state: ParseState, parser: Parser): Ast.ErrorRaisingExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readErrorRaisingExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const errorRaisingExpression: Ast.ErrorRaisingExpression = readPairedConstant(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordError, Constant.KeywordConstant.Error),
        () => parser.readExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return errorRaisingExpression;
}

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

export function readErrorHandlingExpression(state: ParseState, parser: Parser): Ast.ErrorHandlingExpression {
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readErrorHandlingExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const tryConstant: Ast.IConstant<Constant.KeywordConstant.Try> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordTry,
        Constant.KeywordConstant.Try,
    );
    const protectedExpression: Ast.TExpression = parser.readExpression(state, parser);

    const otherwiseExpressionNodeKind: Ast.NodeKind.OtherwiseExpression = Ast.NodeKind.OtherwiseExpression;
    const maybeOtherwiseExpression: Ast.OtherwiseExpression | undefined = maybeReadPairedConstant(
        state,
        otherwiseExpressionNodeKind,
        () => ParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordOtherwise),
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordOtherwise, Constant.KeywordConstant.Otherwise),
        () => parser.readExpression(state, parser),
    );

    const errorHandlingExpression: Ast.ErrorHandlingExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        tryConstant,
        protectedExpression,
        maybeOtherwiseExpression,
    };
    ParseStateUtils.endContext(state, errorHandlingExpression);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return errorHandlingExpression;
}

// -----------------------------------------------
// ---------- 12.2.4 Literal Attributes ----------
// -----------------------------------------------

export function readRecordLiteral(state: ParseState, parser: Parser): Ast.RecordLiteral {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecordLiteral.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.RecordLiteral,
        Constant.WrapperConstant.LeftBracket,
        Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>,
        Constant.WrapperConstant.RightBracket
    > = readWrapped(
        state,
        Ast.NodeKind.RecordLiteral,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket),
        () =>
            parser.readFieldNamePairedAnyLiterals(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBracket, Constant.WrapperConstant.RightBracket),
        false,
    );

    const recordLiteral: Ast.RecordLiteral = {
        literalKind: Ast.LiteralKind.Record,
        ...wrappedRead,
    };
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return recordLiteral;
}

export function readFieldNamePairedAnyLiterals(
    state: ParseState,
    parser: Parser,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldNamePairedAnyLiterals.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const csvArray: Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> = readCsvArray(
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
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return csvArray;
}

export function readListLiteral(state: ParseState, parser: Parser): Ast.ListLiteral {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListLiteral.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);
    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.ListLiteral,
        Constant.WrapperConstant.LeftBrace,
        Ast.ICsvArray<Ast.TAnyLiteral>,
        Constant.WrapperConstant.RightBrace
    > = readWrapped(
        state,
        Ast.NodeKind.ListLiteral,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace),
        () =>
            readCsvArray<Ast.TAnyLiteral>(
                state,
                () => parser.readAnyLiteral(state, parser),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace),
        false,
    );

    const listLiteral: Ast.ListLiteral = {
        literalKind: Ast.LiteralKind.List,
        ...wrappedRead,
    };
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listLiteral;
}

export function readAnyLiteral(state: ParseState, parser: Parser): Ast.TAnyLiteral {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAnyLiteral.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    let anyLiteral: Ast.TAnyLiteral;
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        anyLiteral = parser.readRecordLiteral(state, parser);
    } else if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        anyLiteral = parser.readListLiteral(state, parser);
    } else {
        anyLiteral = parser.readLiteralExpression(state, parser);
    }
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return anyLiteral;
}

export function readPrimitiveType(state: ParseState, parser: Parser): Ast.PrimitiveType {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPrimitiveType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimitiveType: TriedReadPrimitiveType = tryReadPrimitiveType(state, parser);
    if (ResultUtils.isOk(triedReadPrimitiveType)) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: false,
        });

        return triedReadPrimitiveType.value;
    } else {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        throw triedReadPrimitiveType.error;
    }
}

function tryReadPrimitiveType(state: ParseState, parser: Parser): TriedReadPrimitiveType {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, tryReadPrimitiveType.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

    const checkpoint: ParseStateCheckpoint = parser.createCheckpoint(state);
    const expectedTokenKinds: ReadonlyArray<Token.TokenKind> = [
        Token.TokenKind.Identifier,
        Token.TokenKind.KeywordType,
        Token.TokenKind.NullLiteral,
    ];
    const maybeError: ParseError.ExpectedAnyTokenKindError | undefined = ParseStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );
    if (maybeError) {
        const error: ParseError.ExpectedAnyTokenKindError = maybeError;
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        return ResultUtils.boxError(error);
    }

    let primitiveTypeKind: Constant.PrimitiveTypeConstant;
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.Identifier)) {
        const currentTokenData: string = state.lexerSnapshot.tokens[state.tokenIndex].data;

        switch (currentTokenData) {
            case Constant.PrimitiveTypeConstant.Action:
            case Constant.PrimitiveTypeConstant.Any:
            case Constant.PrimitiveTypeConstant.AnyNonNull:
            case Constant.PrimitiveTypeConstant.Binary:
            case Constant.PrimitiveTypeConstant.Date:
            case Constant.PrimitiveTypeConstant.DateTime:
            case Constant.PrimitiveTypeConstant.DateTimeZone:
            case Constant.PrimitiveTypeConstant.Duration:
            case Constant.PrimitiveTypeConstant.Function:
            case Constant.PrimitiveTypeConstant.List:
            case Constant.PrimitiveTypeConstant.Logical:
            case Constant.PrimitiveTypeConstant.None:
            case Constant.PrimitiveTypeConstant.Number:
            case Constant.PrimitiveTypeConstant.Record:
            case Constant.PrimitiveTypeConstant.Table:
            case Constant.PrimitiveTypeConstant.Text:
            case Constant.PrimitiveTypeConstant.Time:
                primitiveTypeKind = currentTokenData;
                readToken(state);
                break;

            default: {
                const token: Token.Token = ParseStateUtils.assertGetTokenAt(state, state.tokenIndex);
                parser.restoreCheckpoint(state, checkpoint);

                return ResultUtils.boxError(
                    new ParseError.InvalidPrimitiveTypeError(
                        state.locale,
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                    ),
                );
            }
        }
    } else if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordType)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstant.Type;
        readToken(state);
    } else if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.NullLiteral)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstant.Null;
        readToken(state);
    } else {
        const details: { tokenKind: Token.TokenKind | undefined } = { tokenKind: state.maybeCurrentTokenKind };
        parser.restoreCheckpoint(state, checkpoint);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        return ResultUtils.boxError(
            new CommonError.InvariantError(`unknown currentTokenKind, not found in [${expectedTokenKinds}]`, details),
        );
    }

    const primitiveType: Ast.PrimitiveType = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        primitiveTypeKind,
    };
    ParseStateUtils.endContext(state, primitiveType);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsError]: false,
    });

    return ResultUtils.boxOk(primitiveType);
}

// -------------------------------------
// ---------- key-value pairs ----------
// -------------------------------------

export function readIdentifierPairedExpressions(
    state: ParseState,
    parser: Parser,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.IdentifierPairedExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIdentifierPairedExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const csvArray: Ast.ICsvArray<Ast.IdentifierPairedExpression> = readCsvArray(
        state,
        () => parser.readIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return csvArray;
}

export function readGeneralizedIdentifierPairedExpressions(
    state: ParseState,
    parser: Parser,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
): Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifierPairedExpressions.name,
    );
    state.maybeCancellationToken?.throwIfCancelled();

    const csvArray: Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> = readCsvArray(
        state,
        () => parser.readGeneralizedIdentifierPairedExpression(state, parser),
        continueReadingValues,
        testPostCommaError,
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return csvArray;
}

export function readGeneralizedIdentifierPairedExpression(
    state: ParseState,
    parser: Parser,
): Ast.GeneralizedIdentifierPairedExpression {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifierPairedExpression.name,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );
    state.maybeCancellationToken?.throwIfCancelled();

    const generalizedIdentifierPairedExpression: Ast.GeneralizedIdentifierPairedExpression = readKeyValuePair<
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.GeneralizedIdentifier,
        Ast.TExpression
    >(
        state,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        () => parser.readGeneralizedIdentifier(state, parser),
        () => parser.readExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return generalizedIdentifierPairedExpression;
}

export function readIdentifierPairedExpression(state: ParseState, parser: Parser): Ast.IdentifierPairedExpression {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIdentifierPairedExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();

    const identifierPairedExpression: Ast.IdentifierPairedExpression = readKeyValuePair<
        Ast.NodeKind.IdentifierPairedExpression,
        Ast.Identifier,
        Ast.TExpression
    >(
        state,
        Ast.NodeKind.IdentifierPairedExpression,
        () => parser.readIdentifier(state, parser),
        () => parser.readExpression(state, parser),
    );
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return identifierPairedExpression;
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
    Kind extends Ast.TBinOpExpressionNodeKind,
    Left,
    Op extends Constant.TBinOpExpressionOperator,
    Right,
>(
    state: ParseState,
    nodeKind: Kind,
    leftReader: () => Left,
    maybeOperatorFrom: (tokenKind: Token.TokenKind | undefined) => Op | undefined,
    rightReader: () => Right,
): Left | Ast.IBinOpExpression<Kind, Left, Op, Right> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, recursiveReadBinOpExpression.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);
    const left: Left = leftReader();

    // If no operator, return Left
    const maybeOperator: Op | undefined = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });
        ParseStateUtils.deleteContext(state, undefined);

        return left;
    }
    const operatorConstant: Ast.TConstant & Ast.IConstant<Op> = readTokenKindAsConstant(
        state,
        Assert.asDefined(state.maybeCurrentTokenKind),
        maybeOperator,
    );
    const right: Right | Ast.IBinOpExpression<Kind, Right, Op, Right> = recursiveReadBinOpExpressionHelper<
        Kind,
        Op,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const binOpExpression: Ast.IBinOpExpression<Kind, Left, Op, Right> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left,
        operatorConstant,
        right,
    };
    ParseStateUtils.endContext(state, binOpExpression as unknown as Ast.TNode);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [NaiveTraceConstant.IsOperatorPresent]: true,
    });

    return binOpExpression;
}

// Given the string `1 + 2 + 3` the function will recursively parse 2 Ast nodes,
// where their TokenRange's are represented by brackets:
// 1 + [2 + [3]]
function recursiveReadBinOpExpressionHelper<
    Kind extends Ast.TBinOpExpressionNodeKind,
    OperatorKind extends Constant.TBinOpExpressionOperator,
    Right,
>(
    state: ParseState,
    nodeKind: Kind,
    maybeOperatorFrom: (tokenKind: Token.TokenKind | undefined) => OperatorKind | undefined,
    rightReader: () => Right,
): Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, recursiveReadBinOpExpressionHelper.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);
    const rightAsLeft: Right = rightReader();

    const maybeOperator: OperatorKind | undefined = maybeOperatorFrom(state.maybeCurrentTokenKind);
    if (maybeOperator === undefined) {
        ParseStateUtils.deleteContext(state, undefined);
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });

        return rightAsLeft;
    }
    const operatorConstant: Ast.TConstant & Ast.IConstant<OperatorKind> = readTokenKindAsConstant(
        state,
        Assert.asDefined(state.maybeCurrentTokenKind),
        maybeOperator,
    );
    const right: Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> = recursiveReadBinOpExpressionHelper<
        Kind,
        OperatorKind,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader);

    const binOpExpression: Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        left: rightAsLeft,
        operatorConstant,
        right,
    };
    ParseStateUtils.endContext(state, binOpExpression as unknown as Ast.TNode);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [NaiveTraceConstant.IsOperatorPresent]: true,
    });

    return binOpExpression;
}

function readCsvArray<T extends Ast.TCsvType>(
    state: ParseState,
    valueReader: () => T,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
): Ast.TCsvArray & Ast.ICsvArray<T> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readCsvArray.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

    const elements: Ast.ICsv<T>[] = [];

    while (continueReadingValues) {
        const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
        ParseStateUtils.startContext(state, csvNodeKind);

        const maybeError: ParseError.TInnerParseError | undefined = testPostCommaError(state);
        if (maybeError) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

            throw maybeError;
        }

        const node: T = valueReader();
        const maybeCommaConstant: Ast.IConstant<Constant.MiscConstant.Comma> | undefined = maybeReadTokenKindAsConstant(
            state,
            Token.TokenKind.Comma,
            Constant.MiscConstant.Comma,
        );

        const element: Ast.TCsv & Ast.ICsv<T> = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: csvNodeKind,
            isLeaf: false,
            node,
            maybeCommaConstant,
        };
        ParseStateUtils.endContext(state, element);
        elements.push(element);

        continueReadingValues = maybeCommaConstant !== undefined;
    }

    const csvArray: Ast.ICsvArray<T> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        elements,
    };
    ParseStateUtils.endContext(state, csvArray);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsThrowing]: false,
    });

    return csvArray;
}

function readKeyValuePair<Kind extends Ast.TKeyValuePairNodeKind, Key, Value>(
    state: ParseState,
    nodeKind: Kind,
    keyReader: () => Key,
    valueReader: () => Value,
): Ast.IKeyValuePair<Kind, Key, Value> {
    ParseStateUtils.startContext(state, nodeKind);
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readKeyValuePair.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    const key: Key = keyReader();
    const equalConstant: Ast.IConstant<Constant.MiscConstant.Equal> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstant.Equal,
    );
    const value: Value = valueReader();

    const keyValuePair: Ast.IKeyValuePair<Kind, Key, Value> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        key,
        equalConstant,
        value,
    };
    ParseStateUtils.endContext(state, keyValuePair as unknown as Ast.TKeyValuePair);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return keyValuePair;
}

function readPairedConstant<Kind extends Ast.TPairedConstantNodeKind, ConstantKind extends Constant.TConstant, Paired>(
    state: ParseState,
    nodeKind: Kind,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, ConstantKind, Paired> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPairedConstant.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

    const constant: Ast.TConstant & Ast.IConstant<ConstantKind> = constantReader();
    const paired: Paired = pairedReader();

    const pairedConstant: Ast.IPairedConstant<Kind, ConstantKind, Paired> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        constant,
        paired,
    };
    ParseStateUtils.endContext(state, pairedConstant as unknown as Ast.TPairedConstant);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return pairedConstant;
}

function maybeReadPairedConstant<
    Kind extends Ast.TPairedConstantNodeKind,
    ConstantKind extends Constant.TConstant,
    Paired,
>(
    state: ParseState,
    nodeKind: Kind,
    condition: () => boolean,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Paired,
): Ast.IPairedConstant<Kind, ConstantKind, Paired> | undefined {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, maybeReadPairedConstant.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    let pairedConstant: Ast.IPairedConstant<Kind, ConstantKind, Paired> | undefined;
    if (condition()) {
        pairedConstant = readPairedConstant<Kind, ConstantKind, Paired>(state, nodeKind, constantReader, pairedReader);
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
        pairedConstant = undefined;
    }
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [NaiveTraceConstant.IsOperatorPresent]: pairedConstant !== undefined,
    });

    return pairedConstant;
}

function genericReadParameterList<T extends Ast.TParameterType>(
    state: ParseState,
    parser: Parser,
    typeReader: () => T,
): Ast.IParameterList<T> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, genericReadParameterList.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.IConstant<Constant.WrapperConstant.LeftParenthesis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftParenthesis,
        Constant.WrapperConstant.LeftParenthesis,
    );
    let continueReadingValues: boolean = !ParseStateUtils.isOnTokenKind(state, Token.TokenKind.RightParenthesis);
    let reachedOptionalParameter: boolean = false;

    const paramterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, paramterArrayNodeKind);

    const parameters: Ast.ICsv<Ast.IParameter<T>>[] = [];
    while (continueReadingValues) {
        ParseStateUtils.startContext(state, Ast.NodeKind.Csv);
        ParseStateUtils.startContext(state, Ast.NodeKind.Parameter);

        const maybeError: ParseError.TInnerParseError | undefined =
            testCsvContinuationDanglingCommaForParenthesis(state);
        if (maybeError) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

            throw maybeError;
        }

        const maybeOptionalConstant: Ast.IConstant<Constant.LanguageConstant.Optional> | undefined =
            maybeReadConstantKind(state, Constant.LanguageConstant.Optional);

        if (reachedOptionalParameter && !maybeOptionalConstant) {
            const token: Token.Token = ParseStateUtils.assertGetTokenAt(state, state.tokenIndex);
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

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
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Parameter,
            isLeaf: false,
            maybeOptionalConstant,
            name,
            maybeParameterType,
        };
        ParseStateUtils.endContext(state, parameter);

        const maybeCommaConstant: Ast.IConstant<Constant.MiscConstant.Comma> | undefined = maybeReadTokenKindAsConstant(
            state,
            Token.TokenKind.Comma,
            Constant.MiscConstant.Comma,
        );
        continueReadingValues = maybeCommaConstant !== undefined;

        const csv: Ast.ICsv<Ast.IParameter<T>> = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Csv,
            isLeaf: false,
            node: parameter,
            maybeCommaConstant,
        };
        ParseStateUtils.endContext(state, csv);

        parameters.push(csv);
    }

    const parameterArray: Ast.ICsvArray<Ast.IParameter<T>> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: paramterArrayNodeKind,
        elements: parameters,
        isLeaf: false,
    };
    ParseStateUtils.endContext(state, parameterArray);

    const rightParenthesisConstant: Ast.IConstant<Constant.WrapperConstant.RightParenthesis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.RightParenthesis,
        Constant.WrapperConstant.RightParenthesis,
    );

    const parameterList: Ast.IParameterList<T> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftParenthesisConstant,
        content: parameterArray,
        closeWrapperConstant: rightParenthesisConstant,
    };
    ParseStateUtils.endContext(state, parameterList);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsThrowing]: false,
    });

    return parameterList;
}

function readWrapped<
    Kind extends Ast.TWrappedNodeKind,
    Open extends Constant.WrapperConstant,
    Content,
    Close extends Constant.WrapperConstant,
>(
    state: ParseState,
    nodeKind: Kind,
    openConstantReader: () => Ast.IConstant<Open>,
    contentReader: () => Content,
    closeConstantReader: () => Ast.IConstant<Close>,
    allowOptionalConstant: boolean,
): WrappedRead<Kind, Open, Content, Close> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readWrapped.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    ParseStateUtils.startContext(state, nodeKind);

    const openWrapperConstant: Ast.IConstant<Open> = openConstantReader();
    const content: Content = contentReader();
    const closeWrapperConstant: Ast.IConstant<Close> = closeConstantReader();

    let maybeOptionalConstant: Ast.IConstant<Constant.MiscConstant.QuestionMark> | undefined;
    if (allowOptionalConstant) {
        maybeOptionalConstant = maybeReadTokenKindAsConstant(
            state,
            Token.TokenKind.QuestionMark,
            Constant.MiscConstant.QuestionMark,
        );
    }

    const wrapped: WrappedRead<Kind, Open, Content, Close> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant,
        content,
        closeWrapperConstant,
        maybeOptionalConstant,
    };
    ParseStateUtils.endContext(state, wrapped as unknown as Ast.TWrapped);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return wrapped;
}

// ---------------------------------------------
// ---------- Helper functions (read) ----------
// ---------------------------------------------

export function readToken(state: ParseState): string {
    state.maybeCancellationToken?.throwIfCancelled();

    const tokens: ReadonlyArray<Token.Token> = state.lexerSnapshot.tokens;
    Assert.isFalse(state.tokenIndex >= tokens.length, `index is beyond tokens.length`, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
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

export function readTokenKindAsConstant<ConstantKind extends Constant.TConstant>(
    state: ParseState,
    tokenKind: Token.TokenKind,
    constantKind: ConstantKind,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readTokenKindAsConstant.name, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });
    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, Ast.NodeKind.Constant);

    const maybeError: ParseError.ExpectedTokenKindError | undefined = ParseStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeError !== undefined) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        throw maybeError;
    }

    const tokenData: string = readToken(state);
    Assert.isTrue(tokenData === constantKind, `expected tokenData to equal constantKind`, { tokenData, constantKind });

    const constant: Ast.TConstant & Ast.IConstant<ConstantKind> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: Ast.NodeKind.Constant,
        isLeaf: true,
        constantKind,
    };
    ParseStateUtils.endContext(state, constant);
    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsError]: true,
    });

    return constant;
}

export function maybeReadTokenKindAsConstant<ConstantKind extends Constant.TConstant>(
    state: ParseState,
    tokenKind: Token.TokenKind,
    constantKind: ConstantKind,
): (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined {
    state.maybeCancellationToken?.throwIfCancelled();

    let maybeConstant: (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined;
    if (ParseStateUtils.isOnTokenKind(state, tokenKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        ParseStateUtils.startContext(state, nodeKind);

        const tokenData: string = readToken(state);
        Assert.isTrue(tokenData === constantKind, `expected tokenData to equal constantKind`, {
            tokenData,
            constantKind,
        });

        const constant: Ast.TConstant & Ast.IConstant<ConstantKind> = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            constantKind,
        };
        ParseStateUtils.endContext(state, constant);

        maybeConstant = constant;
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
        maybeConstant = undefined;
    }

    return maybeConstant;
}

function readTokenKind(state: ParseState, tokenKind: Token.TokenKind): string {
    const maybeError: ParseError.ExpectedTokenKindError | undefined = ParseStateUtils.testIsOnTokenKind(
        state,
        tokenKind,
    );
    if (maybeError) {
        throw maybeError;
    }

    return readToken(state);
}

function readConstantKind<ConstantKind extends Constant.TConstant>(
    state: ParseState,
    constantKind: ConstantKind,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    return Assert.asDefined(maybeReadConstantKind(state, constantKind), `couldn't conver constantKind`, {
        constantKind,
    });
}

function maybeReadConstantKind<ConstantKind extends Constant.TConstant>(
    state: ParseState,
    constantKind: ConstantKind,
): (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined {
    if (ParseStateUtils.isOnConstantKind(state, constantKind)) {
        const nodeKind: Ast.NodeKind.Constant = Ast.NodeKind.Constant;
        ParseStateUtils.startContext(state, nodeKind);

        readToken(state);
        const constant: Ast.TConstant & Ast.IConstant<ConstantKind> = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: true,
            constantKind,
        };
        ParseStateUtils.endContext(state, constant);
        return constant;
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

function maybeReadLiteralAttributes(state: ParseState, parser: Parser): Ast.RecordLiteral | undefined {
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser);
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
        return undefined;
    }
}

// -------------------------------------------------------
// ---------- Helper functions (test functions) ----------
// -------------------------------------------------------

function testCsvContinuationDanglingCommaForBrace(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return ParseStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightBrace);
}

function testCsvContinuationDanglingCommaForBracket(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return ParseStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightBracket);
}

function testCsvContinuationDanglingCommaForParenthesis(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return ParseStateUtils.testCsvContinuationDanglingComma(state, Token.TokenKind.RightParenthesis);
}
