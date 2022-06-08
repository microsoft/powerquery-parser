// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils, Result, ResultUtils, TypeScriptUtils } from "../../common";
import { Ast, AstUtils, Constant, ConstantUtils, TextUtils, Token } from "../../language";
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

export function readIdentifier(
    state: ParseState,
    _parser: Parser,
    identifierContextKind: Ast.IdentifierContextKind,
    maybeCorrelationId: number | undefined,
): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIdentifier.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    ParseStateUtils.startContext(state, nodeKind);

    const literal: string = readTokenKind(state, Token.TokenKind.Identifier);

    const identifier: Ast.Identifier = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: true,
        identifierContextKind,
        literal,
    };

    ParseStateUtils.endContext(state, identifier);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return identifier;
}

// This behavior matches the C# parser and not the language specification.
// eslint-disable-next-line require-await
export async function readGeneralizedIdentifier(
    state: ParseState,
    _parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.GeneralizedIdentifier> {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifier.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

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
            ParseStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
            state.locale,
        );
    }

    const lexerSnapshot: LexerSnapshot = state.lexerSnapshot;
    const tokens: ReadonlyArray<Token.Token> = lexerSnapshot.tokens;
    const contiguousIdentifierStartIndex: number = tokens[tokenRangeStartIndex].positionStart.codeUnit;
    const contiguousIdentifierEndIndex: number = tokens[tokenRangeEndIndex - 1].positionEnd.codeUnit;
    const literal: string = lexerSnapshot.text.slice(contiguousIdentifierStartIndex, contiguousIdentifierEndIndex);
    const literalKind: TextUtils.IdentifierKind = TextUtils.identifierKind(literal, true);

    if (literalKind === TextUtils.IdentifierKind.Invalid) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsThrowing]: true,
        });

        throw new ParseError.ExpectedGeneralizedIdentifierError(
            ParseStateUtils.maybeTokenWithColumnNumber(state, state.tokenIndex + 1),
            state.locale,
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

export function readKeyword(
    state: ParseState,
    _parser: Parser,
    maybeCorrelationId: number | undefined,
): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readKeyword.name, maybeCorrelationId, {
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
        identifierContextKind: Ast.IdentifierContextKind.Keyword,
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

export async function readDocument(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TDocument> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readDocument.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    let document: Ast.TDocument;

    // Try parsing as an Expression document first.
    // If Expression document fails (including UnusedTokensRemainError) then try parsing a SectionDocument.
    // If both fail then return the error which parsed more tokens.
    try {
        document = await parser.readExpression(state, parser, trace.id);
        ParseStateUtils.assertIsDoneParsing(state);
    } catch (expressionError) {
        Assert.isInstanceofError(expressionError);

        // Fast backup deletes context state, but we want to preserve it for the case
        // where both parsing an expression and section document error out.
        const expressionCheckpoint: ParseStateCheckpoint = await parser.createCheckpoint(state);
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
            document = await readSectionDocument(state, parser, trace.id);
            ParseStateUtils.assertIsDoneParsing(state);
        } catch (sectionError) {
            Assert.isInstanceofError(sectionError);

            let triedError: Error;

            if (expressionCheckpoint.tokenIndex > /* sectionErrorState */ state.tokenIndex) {
                triedError = expressionError;
                await parser.restoreCheckpoint(state, expressionCheckpoint);
                // eslint-disable-next-line require-atomic-updates
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

export async function readSectionDocument(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.Section> {
    const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readSectionDocument.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = await maybeReadLiteralAttributes(
        state,
        parser,
        trace.id,
    );

    const sectionConstant: Ast.IConstant<Constant.KeywordConstant.Section> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordSection,
        Constant.KeywordConstant.Section,
        trace.id,
    );

    let maybeName: Ast.Identifier | undefined;

    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.Identifier)) {
        maybeName = parser.readIdentifier(state, parser, Ast.IdentifierContextKind.Key, trace.id);
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
    }

    const semicolonConstant: Ast.IConstant<Constant.MiscConstant.Semicolon> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Semicolon,
        Constant.MiscConstant.Semicolon,
        trace.id,
    );

    const sectionMembers: Ast.IArrayWrapper<Ast.SectionMember> = await parser.readSectionMembers(
        state,
        parser,
        trace.id,
    );

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

export async function readSectionMembers(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IArrayWrapper<Ast.SectionMember>> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readSectionMembers.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const totalTokens: number = state.lexerSnapshot.tokens.length;
    const sectionMembers: Ast.SectionMember[] = [];

    while (state.tokenIndex < totalTokens) {
        // eslint-disable-next-line no-await-in-loop
        sectionMembers.push(await parser.readSectionMember(state, parser, trace.id));
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

export async function readSectionMember(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.SectionMember> {
    const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readSectionMember.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeLiteralAttributes: Ast.RecordLiteral | undefined = await maybeReadLiteralAttributes(
        state,
        parser,
        trace.id,
    );

    const maybeSharedConstant: Ast.IConstant<Constant.KeywordConstant.Shared> | undefined =
        maybeReadTokenKindAsConstant(state, Token.TokenKind.KeywordShared, Constant.KeywordConstant.Shared);

    const namePairedExpression: Ast.IdentifierPairedExpression = await parser.readIdentifierPairedExpression(
        state,
        parser,
        trace.id,
    );

    const semicolonConstant: Ast.IConstant<Constant.MiscConstant.Semicolon> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Semicolon,
        Constant.MiscConstant.Semicolon,
        trace.id,
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

export async function readNullCoalescingExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readNullCoalescingExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const expression: Ast.TExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.NullCoalescingExpression,
        Ast.TLogicalExpression,
        Constant.MiscConstant.NullCoalescingOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.NullCoalescingExpression,
        () => parser.readLogicalExpression(state, parser, trace.id),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            maybeCurrentTokenKind === Token.TokenKind.NullCoalescingOperator
                ? Constant.MiscConstant.NullCoalescingOperator
                : undefined,
        () => parser.readLogicalExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return expression;
}

export async function readExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readExpression.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    let expression: Ast.TExpression;

    switch (state.maybeCurrentTokenKind) {
        case Token.TokenKind.KeywordEach:
            expression = await parser.readEachExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.KeywordLet:
            expression = await parser.readLetExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.KeywordIf:
            expression = await parser.readIfExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.KeywordError:
            expression = await parser.readErrorRaisingExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.KeywordTry:
            expression = await parser.readErrorHandlingExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.LeftParenthesis:
            expression = await DisambiguationUtils.readAmbiguousParenthesis(state, parser, trace.id);
            break;

        default:
            expression = await parser.readNullCoalescingExpression(state, parser, trace.id);
            break;
    }

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return expression;
}

// --------------------------------------------------
// ---------- 12.2.3.2 Logical expressions ----------
// --------------------------------------------------

export async function readLogicalExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TLogicalExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readLogicalExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const logicalExpression: Ast.TLogicalExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.LogicalExpression,
        Ast.TLogicalExpression,
        Constant.LogicalOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.LogicalExpression,
        () => parser.readIsExpression(state, parser, trace.id),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeLogicalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readIsExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return logicalExpression;
}

// --------------------------------------------
// ---------- 12.2.3.3 Is expression ----------
// --------------------------------------------

export async function readIsExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TIsExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIsExpression.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const isExpression: Ast.TIsExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.IsExpression,
        Ast.TAsExpression,
        Constant.KeywordConstant.Is,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.IsExpression,
        () => parser.readAsExpression(state, parser, trace.id),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            maybeCurrentTokenKind === Token.TokenKind.KeywordIs ? Constant.KeywordConstant.Is : undefined,
        () => parser.readNullablePrimitiveType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return isExpression;
}

// sub-item of 12.2.3.3 Is expression
export async function readNullablePrimitiveType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TNullablePrimitiveType> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readNullablePrimitiveType.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    let nullablePrimitiveType: Ast.TNullablePrimitiveType;

    if (ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Nullable)) {
        nullablePrimitiveType = await readPairedConstant(
            state,
            Ast.NodeKind.NullablePrimitiveType,
            () => readConstantKind(state, Constant.LanguageConstant.Nullable),
            () => parser.readPrimitiveType(state, parser, trace.id),
            trace.id,
        );
    } else {
        nullablePrimitiveType = await parser.readPrimitiveType(state, parser, trace.id);
    }

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return nullablePrimitiveType;
}

// --------------------------------------------
// ---------- 12.2.3.4 As expression ----------
// --------------------------------------------

export async function readAsExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TAsExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAsExpression.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const asExpression: Ast.TAsExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.AsExpression,
        Ast.TEqualityExpression,
        Constant.KeywordConstant.As,
        Ast.TNullablePrimitiveType
    >(
        state,
        Ast.NodeKind.AsExpression,
        () => parser.readEqualityExpression(state, parser, trace.id),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            maybeCurrentTokenKind === Token.TokenKind.KeywordAs ? Constant.KeywordConstant.As : undefined,
        () => parser.readNullablePrimitiveType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return asExpression;
}

// --------------------------------------------------
// ---------- 12.2.3.5 Equality expression ----------
// --------------------------------------------------

export async function readEqualityExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TEqualityExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readEqualityExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const equalityExpression: Ast.TEqualityExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.EqualityExpression,
        Ast.TEqualityExpression,
        Constant.EqualityOperator,
        Ast.TEqualityExpression
    >(
        state,
        Ast.NodeKind.EqualityExpression,
        () => parser.readRelationalExpression(state, parser, trace.id),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeEqualityOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readRelationalExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return equalityExpression;
}

// ----------------------------------------------------
// ---------- 12.2.3.6 Relational expression ----------
// ----------------------------------------------------

export async function readRelationalExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TRelationalExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readRelationalExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const relationalExpression: Ast.TRelationalExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.RelationalExpression,
        Ast.TArithmeticExpression,
        Constant.RelationalOperator,
        Ast.TArithmeticExpression
    >(
        state,
        Ast.NodeKind.RelationalExpression,
        () => parser.readArithmeticExpression(state, parser, trace.id),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeRelationalOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readArithmeticExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return relationalExpression;
}

// -----------------------------------------------------
// ---------- 12.2.3.7 Arithmetic expressions ----------
// -----------------------------------------------------

export async function readArithmeticExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TArithmeticExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readArithmeticExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const arithmeticExpression: Ast.TArithmeticExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.ArithmeticExpression,
        Ast.TMetadataExpression,
        Constant.ArithmeticOperator,
        Ast.TMetadataExpression
    >(
        state,
        Ast.NodeKind.ArithmeticExpression,
        () => parser.readMetadataExpression(state, parser, trace.id),
        (maybeCurrentTokenKind: Token.TokenKind | undefined) =>
            ConstantUtils.maybeArithmeticOperatorKindFrom(maybeCurrentTokenKind),
        () => parser.readMetadataExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return arithmeticExpression;
}

// --------------------------------------------------
// ---------- 12.2.3.8 Metadata expression ----------
// --------------------------------------------------

export async function readMetadataExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TMetadataExpression> {
    const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readMetadataExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TUnaryExpression = await parser.readUnaryExpression(state, parser, trace.id);

    const maybeMetaConstant: Ast.IConstant<Constant.KeywordConstant.Meta> | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordMeta,
        Constant.KeywordConstant.Meta,
    );

    if (maybeMetaConstant !== undefined) {
        const operatorConstant: Ast.IConstant<Constant.KeywordConstant.Meta> = maybeMetaConstant;
        const right: Ast.TUnaryExpression = await parser.readUnaryExpression(state, parser, trace.id);

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

export async function readUnaryExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TUnaryExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readUnaryExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    let maybeOperator: Constant.UnaryOperator | undefined = ConstantUtils.maybeUnaryOperatorKindFrom(
        state.maybeCurrentTokenKind,
    );

    if (maybeOperator === undefined) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });

        return parser.readTypeExpression(state, parser, trace.id);
    }

    const unaryNodeKind: Ast.NodeKind.UnaryExpression = Ast.NodeKind.UnaryExpression;
    ParseStateUtils.startContext(state, unaryNodeKind);

    const arrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, arrayNodeKind);

    const operatorConstants: Ast.IConstant<Constant.UnaryOperator>[] = [];

    while (maybeOperator) {
        operatorConstants.push(
            readTokenKindAsConstant(state, state.maybeCurrentTokenKind as Token.TokenKind, maybeOperator, trace.id),
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

    const typeExpression: Ast.TTypeExpression = await parser.readTypeExpression(state, parser, trace.id);

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

export async function readPrimaryExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TPrimaryExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readPrimaryExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    let primaryExpression: Ast.TPrimaryExpression | undefined;
    const maybeCurrentTokenKind: Token.TokenKind | undefined = state.maybeCurrentTokenKind;

    const isIdentifierExpressionNext: boolean =
        maybeCurrentTokenKind === Token.TokenKind.AtSign || maybeCurrentTokenKind === Token.TokenKind.Identifier;

    if (isIdentifierExpressionNext) {
        primaryExpression = parser.readIdentifierExpression(state, parser, trace.id);
    } else {
        switch (maybeCurrentTokenKind) {
            case Token.TokenKind.LeftParenthesis:
                primaryExpression = await parser.readParenthesizedExpression(state, parser, trace.id);
                break;

            case Token.TokenKind.LeftBracket:
                primaryExpression = await DisambiguationUtils.readAmbiguousBracket(
                    state,
                    parser,
                    [
                        Disambiguation.BracketDisambiguation.FieldProjection,
                        Disambiguation.BracketDisambiguation.FieldSelection,
                        Disambiguation.BracketDisambiguation.RecordExpression,
                    ],
                    trace.id,
                );

                break;

            case Token.TokenKind.LeftBrace:
                primaryExpression = await parser.readListExpression(state, parser, trace.id);
                break;

            case Token.TokenKind.Ellipsis:
                primaryExpression = parser.readNotImplementedExpression(state, parser, trace.id);
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
                primaryExpression = parser.readKeyword(state, parser, trace.id);
                break;

            default:
                primaryExpression = parser.readLiteralExpression(state, parser, trace.id);
        }
    }

    if (ParseStateUtils.isRecursivePrimaryExpressionNext(state)) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsRecursive]: true,
        });

        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression, trace.id);
    } else {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsRecursive]: false,
        });

        return primaryExpression;
    }
}

export async function readRecursivePrimaryExpression(
    state: ParseState,
    parser: Parser,
    head: Ast.TPrimaryExpression,
    maybeCorrelationId: number | undefined,
): Promise<Ast.RecursivePrimaryExpression> {
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readRecursivePrimaryExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

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
        state.traceManager,
        trace.id,
    );

    NodeIdMapUtils.updateNodeIds(nodeIdMapCollection, newNodeIdByOldNodeId, state.traceManager, trace.id);

    // Begin normal parsing.
    const recursiveArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, recursiveArrayNodeKind);

    const recursiveExpressions: (Ast.InvokeExpression | Ast.ItemAccessExpression | Ast.TFieldAccessExpression)[] = [];
    let continueReadingValues: boolean = true;

    while (continueReadingValues) {
        const maybeCurrentTokenKind: Token.TokenKind | undefined = state.maybeCurrentTokenKind;

        if (maybeCurrentTokenKind === Token.TokenKind.LeftParenthesis) {
            // eslint-disable-next-line no-await-in-loop
            recursiveExpressions.push(await parser.readInvokeExpression(state, parser, trace.id));
        } else if (maybeCurrentTokenKind === Token.TokenKind.LeftBrace) {
            // eslint-disable-next-line no-await-in-loop
            recursiveExpressions.push(await parser.readItemAccessExpression(state, parser, trace.id));
        } else if (maybeCurrentTokenKind === Token.TokenKind.LeftBracket) {
            // eslint-disable-next-line no-await-in-loop
            const bracketExpression: Ast.TFieldAccessExpression = (await DisambiguationUtils.readAmbiguousBracket(
                state,
                parser,
                [
                    Disambiguation.BracketDisambiguation.FieldSelection,
                    Disambiguation.BracketDisambiguation.FieldProjection,
                ],
                trace.id,
            )) as Ast.TFieldAccessExpression;

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

export function readLiteralExpression(
    state: ParseState,
    _parser: Parser,
    maybeCorrelationId: number | undefined,
): Ast.LiteralExpression {
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readLiteralExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

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

export function readIdentifierExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readIdentifierExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeInclusiveConstant: Ast.IConstant<Constant.MiscConstant.AtSign> | undefined =
        maybeReadTokenKindAsConstant(state, Token.TokenKind.AtSign, Constant.MiscConstant.AtSign);

    const identifier: Ast.Identifier = parser.readIdentifier(state, parser, Ast.IdentifierContextKind.Value, trace.id);

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

export async function readParenthesizedExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ParenthesizedExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readParenthesizedExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const parenthesizedExpression: Ast.ParenthesizedExpression = await readWrapped(
        state,
        Ast.NodeKind.ParenthesizedExpression,
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.LeftParenthesis,
                Constant.WrapperConstant.LeftParenthesis,
                trace.id,
            ),
        () => parser.readExpression(state, parser, trace.id),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightParenthesis,
                Constant.WrapperConstant.RightParenthesis,
                trace.id,
            ),
        false,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return parenthesizedExpression;
}

// ----------------------------------------------------------
// ---------- 12.2.3.15 Not-implemented expression ----------
// ----------------------------------------------------------

export function readNotImplementedExpression(
    state: ParseState,
    _parser: Parser,
    maybeCorrelationId: number | undefined,
): Ast.NotImplementedExpression {
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readNotImplementedExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const ellipsisConstant: Ast.IConstant<Constant.MiscConstant.Ellipsis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Ellipsis,
        Constant.MiscConstant.Ellipsis,
        trace.id,
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

export async function readInvokeExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.InvokeExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readInvokeExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightParenthesis);

    const invokeExpression: Ast.InvokeExpression = await readWrapped(
        state,
        Ast.NodeKind.InvokeExpression,
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.LeftParenthesis,
                Constant.WrapperConstant.LeftParenthesis,
                trace.id,
            ),
        () =>
            // The type inference in VSCode considers the lambda below a type error, but it compiles just fine.
            // I'm adding an explicit type to stop it from (incorrectly) saying it's an error.
            readCsvArray<Ast.TExpression>(
                state,
                () => parser.readExpression(state, parser, trace.id),
                continueReadingValues,
                testCsvContinuationDanglingCommaForParenthesis,
                trace.id,
            ),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightParenthesis,
                Constant.WrapperConstant.RightParenthesis,
                trace.id,
            ),
        false,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return invokeExpression;
}

// -----------------------------------------------
// ---------- 12.2.3.17 List expression ----------
// -----------------------------------------------

export async function readListExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ListExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readListExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);

    const listExpression: Ast.ListExpression = await readWrapped(
        state,
        Ast.NodeKind.ListExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        async () =>
            await readCsvArray<Ast.TListItem>(
                state,
                async () => await parser.readListItem(state, parser, trace.id),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
                trace.id,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
        false,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listExpression;
}

export async function readListItem(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TListItem> {
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListItem.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.DotDot)) {
        const rangeConstant: Ast.IConstant<Constant.MiscConstant.DotDot> = readTokenKindAsConstant(
            state,
            Token.TokenKind.DotDot,
            Constant.MiscConstant.DotDot,
            trace.id,
        );

        const right: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

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

export async function readRecordExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.RecordExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readRecordExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);

    const recordExpression: Ast.RecordExpression = await readWrapped(
        state,
        Ast.NodeKind.RecordExpression,
        () =>
            readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () =>
            parser.readGeneralizedIdentifierPairedExpressions(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
                trace.id,
            ),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightBracket,
                Constant.WrapperConstant.RightBracket,
                trace.id,
            ),
        false,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return recordExpression;
}

// ------------------------------------------------------
// ---------- 12.2.3.19 Item access expression ----------
// ------------------------------------------------------

export async function readItemAccessExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ItemAccessExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readItemAccessExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const itemAccessExpression: Ast.ItemAccessExpression = await readWrapped(
        state,
        Ast.NodeKind.ItemAccessExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        async () => await parser.readExpression(state, parser, trace.id),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
        true,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return itemAccessExpression;
}

// -------------------------------------------------------
// ---------- 12.2.3.20 Field access expression ----------
// -------------------------------------------------------

export async function readFieldSelection(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.FieldSelector> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldSelection.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const fieldSelector: Ast.FieldSelector = await readFieldSelector(state, parser, true, trace.id);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldSelector;
}

export async function readFieldProjection(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.FieldProjection> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldProjection.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const fieldProjection: Ast.FieldProjection = await readWrapped(
        state,
        Ast.NodeKind.FieldProjection,
        () =>
            readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () =>
            readCsvArray(
                state,
                () => parser.readFieldSelector(state, parser, false, trace.id),
                true,
                testCsvContinuationDanglingCommaForBracket,
                trace.id,
            ),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightBracket,
                Constant.WrapperConstant.RightBracket,
                trace.id,
            ),
        true,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldProjection;
}

export async function readFieldSelector(
    state: ParseState,
    parser: Parser,
    allowOptional: boolean,
    maybeCorrelationId: number | undefined,
): Promise<Ast.FieldSelector> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldSelector.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const fieldSelector: Ast.FieldSelector = await readWrapped(
        state,
        Ast.NodeKind.FieldSelector,
        () =>
            readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () => parser.readGeneralizedIdentifier(state, parser, trace.id),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightBracket,
                Constant.WrapperConstant.RightBracket,
                trace.id,
            ),
        allowOptional,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldSelector;
}

// ---------------------------------------------------
// ---------- 12.2.3.21 Function expression ----------
// ---------------------------------------------------

export async function readFunctionExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.FunctionExpression> {
    const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFunctionExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const parameters: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = await parser.readParameterList(
        state,
        parser,
        trace.id,
    );

    const maybeFunctionReturnType: Ast.AsNullablePrimitiveType | undefined = await maybeReadAsNullablePrimitiveType(
        state,
        parser,
        trace.id,
    );

    const fatArrowConstant: Ast.IConstant<Constant.MiscConstant.FatArrow> = readTokenKindAsConstant(
        state,
        Token.TokenKind.FatArrow,
        Constant.MiscConstant.FatArrow,
        trace.id,
    );

    const expression: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

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

export async function readParameterList(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readParameterList.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const parameterList: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = await genericReadParameterList(
        state,
        parser,
        () => maybeReadAsNullablePrimitiveType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return parameterList;
}

async function maybeReadAsNullablePrimitiveType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.AsNullablePrimitiveType | undefined> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        maybeReadAsNullablePrimitiveType.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const maybeAsNullablePrimitiveType: Ast.AsNullablePrimitiveType | undefined = await maybeReadPairedConstant(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => ParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordAs, Constant.KeywordConstant.As, trace.id),
        () => parser.readNullablePrimitiveType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return maybeAsNullablePrimitiveType;
}

export async function readAsType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.AsType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAsType.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const asType: Ast.AsType = await readPairedConstant(
        state,
        Ast.NodeKind.AsType,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordAs, Constant.KeywordConstant.As, trace.id),
        () => parser.readType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return asType;
}

// -----------------------------------------------
// ---------- 12.2.3.22 Each expression ----------
// -----------------------------------------------

export async function readEachExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.EachExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readEachExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const eachExpression: Ast.EachExpression = await readPairedConstant(
        state,
        Ast.NodeKind.EachExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordEach, Constant.KeywordConstant.Each, trace.id),
        () => parser.readExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return eachExpression;
}

// ----------------------------------------------
// ---------- 12.2.3.23 Let expression ----------
// ----------------------------------------------

export async function readLetExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.LetExpression> {
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readLetExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const letConstant: Ast.IConstant<Constant.KeywordConstant.Let> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordLet,
        Constant.KeywordConstant.Let,
        trace.id,
    );

    const identifierPairedExpression: Ast.ICsvArray<Ast.IdentifierPairedExpression> =
        await parser.readIdentifierPairedExpressions(
            state,
            parser,
            !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.KeywordIn),
            ParseStateUtils.testCsvContinuationLetExpression,
            trace.id,
        );

    const inConstant: Ast.IConstant<Constant.KeywordConstant.In> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordIn,
        Constant.KeywordConstant.In,
        trace.id,
    );

    const expression: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

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

export async function readIfExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IfExpression> {
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIfExpression.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const ifConstant: Ast.IConstant<Constant.KeywordConstant.If> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordIf,
        Constant.KeywordConstant.If,
        trace.id,
    );

    const condition: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    const thenConstant: Ast.IConstant<Constant.KeywordConstant.Then> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordThen,
        Constant.KeywordConstant.Then,
        trace.id,
    );

    const trueExpression: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    const elseConstant: Ast.IConstant<Constant.KeywordConstant.Else> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordElse,
        Constant.KeywordConstant.Else,
        trace.id,
    );

    const falseExpression: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

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

export async function readTypeExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TTypeExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readTypeExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    let typeExpression: Ast.TTypeExpression;

    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordType)) {
        typeExpression = await readPairedConstant(
            state,
            Ast.NodeKind.TypePrimaryType,
            () => readTokenKindAsConstant(state, Token.TokenKind.KeywordType, Constant.KeywordConstant.Type, trace.id),
            () => parser.readPrimaryType(state, parser, trace.id),
            trace.id,
        );
    } else {
        typeExpression = await parser.readPrimaryExpression(state, parser, trace.id);
    }

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return typeExpression;
}

export async function readType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readType.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = await tryReadPrimaryType(state, parser, trace.id);

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

        return parser.readPrimaryExpression(state, parser, trace.id);
    }
}

export async function readPrimaryType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TPrimaryType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPrimaryType.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimaryType: TriedReadPrimaryType = await tryReadPrimaryType(state, parser, trace.id);

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

export async function readRecordType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.RecordType> {
    const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecordType.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const fields: Ast.FieldSpecificationList = await parser.readFieldSpecificationList(
        state,
        parser,
        true,
        testCsvContinuationDanglingCommaForBracket,
        trace.id,
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

export async function readTableType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TableType> {
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readTableType.name, maybeCorrelationId, {
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
        rowType = await parser.readPrimaryExpression(state, parser, trace.id);
    } else {
        rowType = await parser.readFieldSpecificationList(
            state,
            parser,
            false,
            testCsvContinuationDanglingCommaForBracket,
            trace.id,
        );
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

export async function readFieldSpecificationList(
    state: ParseState,
    parser: Parser,
    allowOpenMarker: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    maybeCorrelationId: number | undefined,
): Promise<Ast.FieldSpecificationList> {
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldSpecificationList.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const leftBracketConstant: Ast.IConstant<Constant.WrapperConstant.LeftBracket> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftBracket,
        Constant.WrapperConstant.LeftBracket,
        trace.id,
    );

    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = !ParseStateUtils.isOnTokenKind(state, Token.TokenKind.RightBracket);
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

            // eslint-disable-next-line no-await-in-loop
            const name: Ast.GeneralizedIdentifier = await parser.readGeneralizedIdentifier(state, parser, trace.id);

            const maybeFieldTypeSpecification: Ast.FieldTypeSpecification | undefined =
                // eslint-disable-next-line no-await-in-loop
                await maybeReadFieldTypeSpecification(state, parser, trace.id);

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
            trace.id,
        );
    }

    const rightBracketConstant: Ast.IConstant<Constant.WrapperConstant.RightBracket> = readTokenKindAsConstant(
        state,
        Token.TokenKind.RightBracket,
        Constant.WrapperConstant.RightBracket,
        trace.id,
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

async function maybeReadFieldTypeSpecification(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.FieldTypeSpecification | undefined> {
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        maybeReadFieldTypeSpecification.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const maybeEqualConstant: Ast.IConstant<Constant.MiscConstant.Equal> | undefined = maybeReadTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstant.Equal,
    );

    if (maybeEqualConstant) {
        const fieldType: Ast.TType = await parser.readType(state, parser, trace.id);

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

export async function readListType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ListType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListType.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const listType: Ast.ListType = await readWrapped(
        state,
        Ast.NodeKind.ListType,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        () => parser.readType(state, parser, trace.id),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
        false,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listType;
}

export async function readFunctionType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.FunctionType> {
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFunctionType.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const functionConstant: Ast.IConstant<Constant.PrimitiveTypeConstant.Function> = readConstantKind(
        state,
        Constant.PrimitiveTypeConstant.Function,
    );

    const parameters: Ast.IParameterList<Ast.AsType> = await parser.readParameterSpecificationList(
        state,
        parser,
        trace.id,
    );

    const functionReturnType: Ast.AsType = await parser.readAsType(state, parser, trace.id);

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

async function tryReadPrimaryType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<TriedReadPrimaryType> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        tryReadPrimaryType.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

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
        attempt = ResultUtils.boxOk(await parser.readRecordType(state, parser, trace.id));
    } else if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        attempt = ResultUtils.boxOk(await parser.readListType(state, parser, trace.id));
    } else if (isTableTypeNext) {
        attempt = ResultUtils.boxOk(await parser.readTableType(state, parser, trace.id));
    } else if (isFunctionTypeNext) {
        attempt = ResultUtils.boxOk(await parser.readFunctionType(state, parser, trace.id));
    } else if (ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Nullable)) {
        attempt = ResultUtils.boxOk(await parser.readNullableType(state, parser, trace.id));
    } else {
        const checkpoint: ParseStateCheckpoint = await parser.createCheckpoint(state);
        const triedReadPrimitiveType: TriedReadPrimaryType = await tryReadPrimitiveType(state, parser, trace.id);

        if (ResultUtils.isError(triedReadPrimitiveType)) {
            await parser.restoreCheckpoint(state, checkpoint);
        }

        attempt = triedReadPrimitiveType;
    }

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return attempt;
}

export async function readParameterSpecificationList(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IParameterList<Ast.AsType>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readParameterSpecificationList.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const parameterList: Ast.IParameterList<Ast.AsType> = await genericReadParameterList(
        state,
        parser,
        async () => await parser.readAsType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return parameterList;
}

export async function readNullableType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.NullableType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readNullableType.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const nullableType: Ast.NullableType = await readPairedConstant(
        state,
        Ast.NodeKind.NullableType,
        () => readConstantKind(state, Constant.LanguageConstant.Nullable),
        () => parser.readType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return nullableType;
}

// --------------------------------------------------------
// ---------- 12.2.3.26 Error raising expression ----------
// --------------------------------------------------------

export async function readErrorRaisingExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ErrorRaisingExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readErrorRaisingExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const errorRaisingExpression: Ast.ErrorRaisingExpression = await readPairedConstant(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, Token.TokenKind.KeywordError, Constant.KeywordConstant.Error, trace.id),
        () => parser.readExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return errorRaisingExpression;
}

// ---------------------------------------------------------
// ---------- 12.2.3.27 Error handling expression ----------
// ---------------------------------------------------------

export async function readErrorHandlingExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TErrorHandlingExpression> {
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readErrorHandlingExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const tryConstant: Ast.IConstant<Constant.KeywordConstant.Try> = readTokenKindAsConstant(
        state,
        Token.TokenKind.KeywordTry,
        Constant.KeywordConstant.Try,
        trace.id,
    );

    const protectedExpression: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    let result: Ast.TErrorHandlingExpression;

    // If the literal "catch" is present then read it as a CatchExpression
    if (ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Catch)) {
        const catchExpression: Ast.CatchExpression = await readPairedConstant(
            state,
            Ast.NodeKind.CatchExpression,
            () => readTokenKindAsConstant(state, Token.TokenKind.Identifier, Constant.LanguageConstant.Catch, trace.id),
            () => parser.readFunctionExpression(state, parser, trace.id),
            trace.id,
        );

        const maybeError: ParseError.InvalidCatchExpression | undefined = testCatchFunction(
            state,
            catchExpression.paired,
        );

        if (maybeError) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsError]: true,
            });

            throw maybeError;
        }

        const errorHandlingCatchExpression: Ast.ErrorHandlingCatchExpression = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            handlerKind: Ast.ErrorHandlerKind.Catch,
            isLeaf: false,
            tryConstant,
            protectedExpression,
            catchExpression,
        };

        result = errorHandlingCatchExpression;
    }
    // optionally read OtherwiseExpression
    else {
        const maybeOtherwiseExpression: Ast.OtherwiseExpression | undefined = await maybeReadPairedConstant(
            state,
            Ast.NodeKind.OtherwiseExpression,
            () => ParseStateUtils.isOnTokenKind(state, Token.TokenKind.KeywordOtherwise),
            () =>
                readTokenKindAsConstant(
                    state,
                    Token.TokenKind.KeywordOtherwise,
                    Constant.KeywordConstant.Otherwise,
                    trace.id,
                ),
            () => parser.readExpression(state, parser, trace.id),
            trace.id,
        );

        const errorHandlingOtherwiseExpression: Ast.ErrorHandlingOtherwiseExpression = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            handlerKind: Ast.ErrorHandlerKind.Otherwise,
            isLeaf: false,
            tryConstant,
            protectedExpression,
            maybeOtherwiseExpression,
        };

        result = errorHandlingOtherwiseExpression;
    }

    ParseStateUtils.endContext(state, result);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return result;
}

// -----------------------------------------------
// ---------- 12.2.4 Literal Attributes ----------
// -----------------------------------------------

export async function readRecordLiteral(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.RecordLiteral> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readRecordLiteral.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBracket);

    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.RecordLiteral,
        Constant.WrapperConstant.LeftBracket,
        Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>,
        Constant.WrapperConstant.RightBracket
    > = await readWrapped(
        state,
        Ast.NodeKind.RecordLiteral,
        () =>
            readTokenKindAsConstant(state, Token.TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () =>
            parser.readFieldNamePairedAnyLiterals(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
                trace.id,
            ),
        () =>
            readTokenKindAsConstant(
                state,
                Token.TokenKind.RightBracket,
                Constant.WrapperConstant.RightBracket,
                trace.id,
            ),
        false,
        trace.id,
    );

    const recordLiteral: Ast.RecordLiteral = {
        literalKind: Ast.LiteralKind.Record,
        ...wrappedRead,
    };

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return recordLiteral;
}

export async function readFieldNamePairedAnyLiterals(
    state: ParseState,
    parser: Parser,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldNamePairedAnyLiterals.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const csvArray: Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> = await readCsvArray(
        state,
        () =>
            readKeyValuePair<
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                Ast.GeneralizedIdentifier,
                Ast.TAnyLiteral
            >(
                state,
                Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral,
                () => parser.readGeneralizedIdentifier(state, parser, trace.id),
                () => parser.readAnyLiteral(state, parser, trace.id),
                trace.id,
            ),
        continueReadingValues,
        testPostCommaError,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return csvArray;
}

export async function readListLiteral(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ListLiteral> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListLiteral.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, Token.TokenKind.RightBrace);

    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.ListLiteral,
        Constant.WrapperConstant.LeftBrace,
        Ast.ICsvArray<Ast.TAnyLiteral>,
        Constant.WrapperConstant.RightBrace
    > = await readWrapped(
        state,
        Ast.NodeKind.ListLiteral,
        () => readTokenKindAsConstant(state, Token.TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        () =>
            readCsvArray<Ast.TAnyLiteral>(
                state,
                () => parser.readAnyLiteral(state, parser, trace.id),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
                trace.id,
            ),
        () => readTokenKindAsConstant(state, Token.TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
        false,
        trace.id,
    );

    const listLiteral: Ast.ListLiteral = {
        literalKind: Ast.LiteralKind.List,
        ...wrappedRead,
    };

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listLiteral;
}

export async function readAnyLiteral(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TAnyLiteral> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAnyLiteral.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.maybeCancellationToken?.throwIfCancelled();

    let anyLiteral: Ast.TAnyLiteral;

    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        anyLiteral = await parser.readRecordLiteral(state, parser, trace.id);
    } else if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBrace)) {
        anyLiteral = await parser.readListLiteral(state, parser, trace.id);
    } else {
        anyLiteral = parser.readLiteralExpression(state, parser, trace.id);
    }

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return anyLiteral;
}

export async function readPrimitiveType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.PrimitiveType> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readPrimitiveType.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const triedReadPrimitiveType: TriedReadPrimitiveType = await tryReadPrimitiveType(state, parser, trace.id);

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

async function tryReadPrimitiveType(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<TriedReadPrimitiveType> {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        tryReadPrimitiveType.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    ParseStateUtils.startContext(state, nodeKind);

    const checkpoint: ParseStateCheckpoint = await parser.createCheckpoint(state);

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
                await parser.restoreCheckpoint(state, checkpoint);

                return ResultUtils.boxError(
                    new ParseError.InvalidPrimitiveTypeError(
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                        state.locale,
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
        await parser.restoreCheckpoint(state, checkpoint);

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

export async function readIdentifierPairedExpressions(
    state: ParseState,
    parser: Parser,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ICsvArray<Ast.IdentifierPairedExpression>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readIdentifierPairedExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const csvArray: Ast.ICsvArray<Ast.IdentifierPairedExpression> = await readCsvArray(
        state,
        () => parser.readIdentifierPairedExpression(state, parser, trace.id),
        continueReadingValues,
        testPostCommaError,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return csvArray;
}

export async function readGeneralizedIdentifierPairedExpressions(
    state: ParseState,
    parser: Parser,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    maybeCorrelationId: number | undefined,
): Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifierPairedExpressions.name,
        maybeCorrelationId,
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const csvArray: Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression> = await readCsvArray(
        state,
        () => parser.readGeneralizedIdentifierPairedExpression(state, parser, trace.id),
        continueReadingValues,
        testPostCommaError,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return csvArray;
}

export async function readGeneralizedIdentifierPairedExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.GeneralizedIdentifierPairedExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifierPairedExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const generalizedIdentifierPairedExpression: Ast.GeneralizedIdentifierPairedExpression = await readKeyValuePair<
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        Ast.GeneralizedIdentifier,
        Ast.TExpression
    >(
        state,
        Ast.NodeKind.GeneralizedIdentifierPairedExpression,
        () => parser.readGeneralizedIdentifier(state, parser, trace.id),
        () => parser.readExpression(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return generalizedIdentifierPairedExpression;
}

export async function readIdentifierPairedExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IdentifierPairedExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readIdentifierPairedExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    state.maybeCancellationToken?.throwIfCancelled();

    const identifierPairedExpression: Ast.IdentifierPairedExpression = await readKeyValuePair<
        Ast.NodeKind.IdentifierPairedExpression,
        Ast.Identifier,
        Ast.TExpression
    >(
        state,
        Ast.NodeKind.IdentifierPairedExpression,
        // eslint-disable-next-line require-await
        async () => parser.readIdentifier(state, parser, Ast.IdentifierContextKind.Key, trace.id),
        async () => await parser.readExpression(state, parser, trace.id),
        trace.id,
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
async function recursiveReadBinOpExpression<
    Kind extends Ast.TBinOpExpressionNodeKind,
    Left,
    Op extends Constant.TBinOpExpressionOperator,
    Right,
>(
    state: ParseState,
    nodeKind: Kind,
    leftReader: () => Promise<Left>,
    maybeOperatorFrom: (tokenKind: Token.TokenKind | undefined) => Op | undefined,
    rightReader: () => Promise<Right>,
    maybeCorrelationId: number | undefined,
): Promise<Left | Ast.IBinOpExpression<Kind, Left, Op, Right>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        recursiveReadBinOpExpression.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    ParseStateUtils.startContext(state, nodeKind);
    const left: Left = await leftReader();

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
        trace.id,
    );

    const right: Right | Ast.IBinOpExpression<Kind, Right, Op, Right> = await recursiveReadBinOpExpressionHelper<
        Kind,
        Op,
        Right
    >(state, nodeKind, maybeOperatorFrom, rightReader, trace.id);

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
async function recursiveReadBinOpExpressionHelper<
    Kind extends Ast.TBinOpExpressionNodeKind,
    OperatorKind extends Constant.TBinOpExpressionOperator,
    Right,
>(
    state: ParseState,
    nodeKind: Kind,
    maybeOperatorFrom: (tokenKind: Token.TokenKind | undefined) => OperatorKind | undefined,
    rightReader: () => Promise<Right>,
    maybeCorrelationId: number | undefined,
): Promise<Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        recursiveReadBinOpExpressionHelper.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    ParseStateUtils.startContext(state, nodeKind);
    const rightAsLeft: Right = await rightReader();

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
        trace.id,
    );

    const right: Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> =
        await recursiveReadBinOpExpressionHelper<Kind, OperatorKind, Right>(
            state,
            nodeKind,
            maybeOperatorFrom,
            rightReader,
            trace.id,
        );

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

async function readCsvArray<T extends Ast.TCsvType>(
    state: ParseState,
    valueReader: () => Promise<T>,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TCsvArray & Ast.ICsvArray<T>> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readCsvArray.name, maybeCorrelationId, {
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

        // eslint-disable-next-line no-await-in-loop
        const node: T = await valueReader();

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

async function readKeyValuePair<Kind extends Ast.TKeyValuePairNodeKind, Key, Value>(
    state: ParseState,
    nodeKind: Kind,
    keyReader: () => Promise<Key>,
    valueReader: () => Promise<Value>,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IKeyValuePair<Kind, Key, Value>> {
    ParseStateUtils.startContext(state, nodeKind);

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readKeyValuePair.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    const key: Key = await keyReader();

    const equalConstant: Ast.IConstant<Constant.MiscConstant.Equal> = readTokenKindAsConstant(
        state,
        Token.TokenKind.Equal,
        Constant.MiscConstant.Equal,
        trace.id,
    );

    const value: Value = await valueReader();

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

async function readPairedConstant<
    Kind extends Ast.TPairedConstantNodeKind,
    ConstantKind extends Constant.TConstant,
    Paired,
>(
    state: ParseState,
    nodeKind: Kind,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Promise<Paired>,
    correlationId: number,
): Promise<Ast.IPairedConstant<Kind, ConstantKind, Paired>> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPairedConstant.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    ParseStateUtils.startContext(state, nodeKind);

    const constant: Ast.TConstant & Ast.IConstant<ConstantKind> = constantReader();
    const paired: Paired = await pairedReader();

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

async function maybeReadPairedConstant<
    Kind extends Ast.TPairedConstantNodeKind,
    ConstantKind extends Constant.TConstant,
    Paired,
>(
    state: ParseState,
    nodeKind: Kind,
    condition: () => boolean,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Promise<Paired>,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IPairedConstant<Kind, ConstantKind, Paired> | undefined> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        maybeReadPairedConstant.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    let pairedConstant: Ast.IPairedConstant<Kind, ConstantKind, Paired> | undefined;

    if (condition()) {
        pairedConstant = await readPairedConstant<Kind, ConstantKind, Paired>(
            state,
            nodeKind,
            constantReader,
            pairedReader,
            trace.id,
        );
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

async function genericReadParameterList<T extends Ast.TParameterType>(
    state: ParseState,
    parser: Parser,
    typeReader: () => Promise<T>,
    maybeCorrelationId: number | undefined,
): Promise<Ast.IParameterList<T>> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        genericReadParameterList.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

    ParseStateUtils.startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.IConstant<Constant.WrapperConstant.LeftParenthesis> = readTokenKindAsConstant(
        state,
        Token.TokenKind.LeftParenthesis,
        Constant.WrapperConstant.LeftParenthesis,
        trace.id,
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
                token,
                state.lexerSnapshot.graphemePositionStartFrom(token),
                state.locale,
            );
        } else if (maybeOptionalConstant) {
            reachedOptionalParameter = true;
        }

        // eslint-disable-next-line no-await-in-loop
        const name: Ast.Identifier = parser.readIdentifier(
            state,
            parser,
            Ast.IdentifierContextKind.Parameter,
            trace.id,
        );

        // eslint-disable-next-line no-await-in-loop
        const maybeParameterType: T = await typeReader();

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
        trace.id,
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

async function readWrapped<
    Kind extends Ast.TWrappedNodeKind,
    Open extends Constant.WrapperConstant,
    Content,
    Close extends Constant.WrapperConstant,
>(
    state: ParseState,
    nodeKind: Kind,
    openConstantReader: () => Ast.IConstant<Open>,
    contentReader: () => Promise<Content>,
    closeConstantReader: () => Ast.IConstant<Close>,
    allowOptionalConstant: boolean,
    maybeCorrelationId: number | undefined,
): Promise<WrappedRead<Kind, Open, Content, Close>> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readWrapped.name, maybeCorrelationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    ParseStateUtils.startContext(state, nodeKind);

    const openWrapperConstant: Ast.IConstant<Open> = openConstantReader();
    const content: Content = await contentReader();
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
    maybeCorrelationId: number | undefined,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readTokenKindAsConstant.name,
        maybeCorrelationId,
        {
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        },
    );

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

async function maybeReadLiteralAttributes(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.RecordLiteral | undefined> {
    if (ParseStateUtils.isOnTokenKind(state, Token.TokenKind.LeftBracket)) {
        return await parser.readRecordLiteral(state, parser, maybeCorrelationId);
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

// It must:
//  - have [0, 1] arguments
//  - no typing for either the argument or return
function testCatchFunction(
    state: ParseState,
    catchFunction: Ast.FunctionExpression,
): ParseError.InvalidCatchExpression | undefined {
    const parameters: ReadonlyArray<Ast.ICsv<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>> =
        catchFunction.parameters.content.elements;

    if (
        parameters.length > 1 ||
        (parameters.length === 1 && parameters[0].node.maybeParameterType) ||
        catchFunction.maybeFunctionReturnType
    ) {
        const tokenStart: Token.Token = Assert.asDefined(
            state.lexerSnapshot.tokens[catchFunction.tokenRange.tokenIndexStart],
        );

        return new ParseError.InvalidCatchExpression(
            tokenStart,
            state.lexerSnapshot.graphemePositionStartFrom(tokenStart),
            state.locale,
        );
    }

    return undefined;
}
