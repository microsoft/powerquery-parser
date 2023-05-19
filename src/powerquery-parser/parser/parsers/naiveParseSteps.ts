// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Result, ResultUtils } from "../../common";
import { Ast, AstUtils, Constant, ConstantUtils, TextUtils, Token } from "../../language";
import { Disambiguation, DisambiguationUtils } from "../disambiguation";
import { NaiveParseSteps, ParseContext, ParseContextUtils, ParseError } from "..";
import { Parser, ParseStateCheckpoint } from "../parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { Trace, TraceConstant } from "../../common/trace";
import { LexerSnapshot } from "../../lexer";
import { TokenKind } from "../../language/token";

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
    readonly optionalConstant: Ast.IConstant<Constant.MiscConstant.QuestionMark> | undefined;
}

const GeneralizedIdentifierTerminatorTokenKinds: ReadonlyArray<TokenKind> = [
    TokenKind.Comma,
    TokenKind.Equal,
    TokenKind.RightBracket,
];

// ----------------------------------------
// ---------- 12.1.6 Identifiers ----------
// ----------------------------------------

export function readIdentifier(
    state: ParseState,
    _parser: Parser,
    identifierContextKind: Ast.IdentifierContextKind,
    correlationId: number | undefined,
): Ast.Identifier {
    const nodeKind: Ast.NodeKind.Identifier = Ast.NodeKind.Identifier;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIdentifier.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    ParseStateUtils.startContext(state, nodeKind);

    const literal: string = readTokenKind(state, TokenKind.Identifier);

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
    correlationId: number | undefined,
): Promise<Ast.GeneralizedIdentifier> {
    const nodeKind: Ast.NodeKind.GeneralizedIdentifier = Ast.NodeKind.GeneralizedIdentifier;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifier.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    ParseStateUtils.startContext(state, nodeKind);

    const tokenRangeStartIndex: number = state.tokenIndex;
    let tokenRangeEndIndex: number = tokenRangeStartIndex;

    while (state.currentTokenKind && GeneralizedIdentifierTerminatorTokenKinds.indexOf(state.currentTokenKind) === -1) {
        readToken(state);
        tokenRangeEndIndex = state.tokenIndex;
    }

    if (tokenRangeStartIndex === tokenRangeEndIndex) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsThrowing]: true,
        });

        throw new ParseError.ExpectedGeneralizedIdentifierError(
            ParseStateUtils.tokenWithColumnNumber(state, state.tokenIndex + 1),
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
            ParseStateUtils.tokenWithColumnNumber(state, state.tokenIndex + 1),
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
    correlationId: number | undefined,
): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readKeyword.name, correlationId, {
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
        inclusiveConstant: undefined,
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
    correlationId: number | undefined,
): Promise<Ast.TDocument> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readDocument.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    let document: Ast.TDocument;

    // Try parsing as an Expression document first.
    // If Expression document fails (including UnusedTokensRemainError) then try parsing a SectionDocument.
    // If both fail then return the error which parsed more tokens.
    try {
        document = await parser.readExpression(state, parser, trace.id);
        ParseStateUtils.assertIsDoneParsing(state);
    } catch (expressionError: unknown) {
        Assert.isInstanceofError(expressionError);
        CommonError.throwIfCancellationError(expressionError);

        // Fast backup deletes context state, but we want to preserve it for the case
        // where both parsing an expression and section document error out.
        const expressionCheckpoint: ParseStateCheckpoint = await parser.checkpoint(state);
        const expressionErrorContextState: ParseContext.State = state.contextState;

        // Reset the parser's state.
        state.tokenIndex = 0;
        state.contextState = ParseContextUtils.newState();
        state.currentContextNode = undefined;

        if (state.lexerSnapshot.tokens.length) {
            state.currentToken = state.lexerSnapshot.tokens[0];
            state.currentTokenKind = state.currentToken?.kind;
        }

        try {
            document = await readSectionDocument(state, parser, trace.id);
            ParseStateUtils.assertIsDoneParsing(state);
        } catch (sectionError: unknown) {
            Assert.isInstanceofError(sectionError);
            CommonError.throwIfCancellationError(sectionError);

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
    correlationId: number | undefined,
): Promise<Ast.Section> {
    const nodeKind: Ast.NodeKind.Section = Ast.NodeKind.Section;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readSectionDocument.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const literalAttributes: Ast.RecordLiteral | undefined = await readLiteralAttributes(state, parser, trace.id);

    const sectionConstant: Ast.IConstant<Constant.KeywordConstant.Section> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordSection,
        Constant.KeywordConstant.Section,
        trace.id,
    );

    let name: Ast.Identifier | undefined;

    if (ParseStateUtils.isOnTokenKind(state, TokenKind.Identifier)) {
        name = parser.readIdentifier(state, parser, Ast.IdentifierContextKind.Key, trace.id);
    } else {
        ParseStateUtils.incrementAttributeCounter(state);
    }

    const semicolonConstant: Ast.IConstant<Constant.MiscConstant.Semicolon> = readTokenKindAsConstant(
        state,
        TokenKind.Semicolon,
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
        literalAttributes,
        sectionConstant,
        name,
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
    correlationId: number | undefined,
): Promise<Ast.IArrayWrapper<Ast.SectionMember>> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readSectionMembers.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
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
    correlationId: number | undefined,
): Promise<Ast.SectionMember> {
    const nodeKind: Ast.NodeKind.SectionMember = Ast.NodeKind.SectionMember;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readSectionMember.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const literalAttributes: Ast.RecordLiteral | undefined = await readLiteralAttributes(state, parser, trace.id);

    const sharedConstant: Ast.IConstant<Constant.KeywordConstant.Shared> | undefined =
        readTokenKindAsConstantOrUndefined(state, TokenKind.KeywordShared, Constant.KeywordConstant.Shared);

    const namePairedExpression: Ast.IdentifierPairedExpression = await parser.readIdentifierPairedExpression(
        state,
        parser,
        trace.id,
    );

    const semicolonConstant: Ast.IConstant<Constant.MiscConstant.Semicolon> = readTokenKindAsConstant(
        state,
        TokenKind.Semicolon,
        Constant.MiscConstant.Semicolon,
        trace.id,
    );

    const sectionMember: Ast.SectionMember = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        literalAttributes,
        sharedConstant,
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
    correlationId: number | undefined,
): Promise<Ast.TExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readNullCoalescingExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const expression: Ast.TExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.NullCoalescingExpression,
        Ast.TLogicalExpression,
        Constant.MiscConstant.NullCoalescingOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.NullCoalescingExpression,
        () => parser.readLogicalExpression(state, parser, trace.id),
        (currentTokenKind: TokenKind | undefined) =>
            currentTokenKind === TokenKind.NullCoalescingOperator
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
    correlationId: number | undefined,
): Promise<Ast.TExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    let expression: Ast.TExpression;

    switch (state.currentTokenKind) {
        case TokenKind.KeywordEach:
            expression = await parser.readEachExpression(state, parser, trace.id);
            break;

        case TokenKind.KeywordLet:
            expression = await parser.readLetExpression(state, parser, trace.id);
            break;

        case TokenKind.KeywordIf:
            expression = await parser.readIfExpression(state, parser, trace.id);
            break;

        case TokenKind.KeywordError:
            expression = await parser.readErrorRaisingExpression(state, parser, trace.id);
            break;

        case TokenKind.KeywordTry:
            expression = await parser.readErrorHandlingExpression(state, parser, trace.id);
            break;

        case TokenKind.LeftParenthesis:
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
    correlationId: number | undefined,
): Promise<Ast.TLogicalExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readLogicalExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const logicalExpression: Ast.TLogicalExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.LogicalExpression,
        Ast.TLogicalExpression,
        Constant.LogicalOperator,
        Ast.TLogicalExpression
    >(
        state,
        Ast.NodeKind.LogicalExpression,
        () => parser.readIsExpression(state, parser, trace.id),
        (currentTokenKind: TokenKind | undefined) => ConstantUtils.logicalOperatorKindFrom(currentTokenKind),
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
    correlationId: number | undefined,
): Promise<Ast.TIsExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIsExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const isExpression: Ast.TIsExpression = await readRecursivelyEitherAsExpressionOrIsExpression<Ast.IsExpression>(
        state,
        parser,
        Ast.NodeKind.IsExpression,
        await parser.readAsExpression(state, parser, correlationId),
        TokenKind.KeywordIs,
        Constant.KeywordConstant.Is,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return isExpression;
}

// sub-item of 12.2.3.3 Is expression
export async function readNullablePrimitiveType(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.TNullablePrimitiveType> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readNullablePrimitiveType.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<Ast.TAsExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAsExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const asExpression: Ast.TAsExpression = await readRecursivelyEitherAsExpressionOrIsExpression<Ast.AsExpression>(
        state,
        parser,
        Ast.NodeKind.AsExpression,
        await parser.readEqualityExpression(state, parser, correlationId),
        TokenKind.KeywordAs,
        Constant.KeywordConstant.As,
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
    correlationId: number | undefined,
): Promise<Ast.TEqualityExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readEqualityExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const equalityExpression: Ast.TEqualityExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.EqualityExpression,
        Ast.TEqualityExpression,
        Constant.EqualityOperator,
        Ast.TEqualityExpression
    >(
        state,
        Ast.NodeKind.EqualityExpression,
        () => parser.readRelationalExpression(state, parser, trace.id),
        (currentTokenKind: TokenKind | undefined) => ConstantUtils.equalityOperatorKindFrom(currentTokenKind),
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
    correlationId: number | undefined,
): Promise<Ast.TRelationalExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readRelationalExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const relationalExpression: Ast.TRelationalExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.RelationalExpression,
        Ast.TArithmeticExpression,
        Constant.RelationalOperator,
        Ast.TArithmeticExpression
    >(
        state,
        Ast.NodeKind.RelationalExpression,
        () => parser.readArithmeticExpression(state, parser, trace.id),
        (currentTokenKind: TokenKind | undefined) => ConstantUtils.relationalOperatorKindFrom(currentTokenKind),
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
    correlationId: number | undefined,
): Promise<Ast.TArithmeticExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readArithmeticExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const arithmeticExpression: Ast.TArithmeticExpression = await recursiveReadBinOpExpression<
        Ast.NodeKind.ArithmeticExpression,
        Ast.TMetadataExpression,
        Constant.ArithmeticOperator,
        Ast.TMetadataExpression
    >(
        state,
        Ast.NodeKind.ArithmeticExpression,
        () => parser.readMetadataExpression(state, parser, trace.id),
        (currentTokenKind: TokenKind | undefined) => ConstantUtils.arithmeticOperatorKindFrom(currentTokenKind),
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
    correlationId: number | undefined,
): Promise<Ast.TMetadataExpression> {
    const nodeKind: Ast.NodeKind.MetadataExpression = Ast.NodeKind.MetadataExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readMetadataExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TUnaryExpression = await parser.readUnaryExpression(state, parser, trace.id);

    const metaConstant: Ast.IConstant<Constant.KeywordConstant.Meta> | undefined = readTokenKindAsConstantOrUndefined(
        state,
        TokenKind.KeywordMeta,
        Constant.KeywordConstant.Meta,
    );

    if (metaConstant !== undefined) {
        const operatorConstant: Ast.IConstant<Constant.KeywordConstant.Meta> = metaConstant;
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
        ParseStateUtils.deleteContext(state);

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
    correlationId: number | undefined,
): Promise<Ast.TUnaryExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readUnaryExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    let operator: Constant.UnaryOperator | undefined = ConstantUtils.unaryOperatorKindFrom(state.currentTokenKind);

    if (operator === undefined) {
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

    while (operator) {
        operatorConstants.push(readTokenKindAsConstant(state, state.currentTokenKind as TokenKind, operator, trace.id));

        operator = ConstantUtils.unaryOperatorKindFrom(state.currentTokenKind);
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
    correlationId: number | undefined,
): Promise<Ast.TPrimaryExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPrimaryExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    let primaryExpression: Ast.TPrimaryExpression | undefined;
    const currentTokenKind: TokenKind | undefined = state.currentTokenKind;

    const isIdentifierExpressionNext: boolean =
        currentTokenKind === TokenKind.AtSign || currentTokenKind === TokenKind.Identifier;

    if (isIdentifierExpressionNext) {
        primaryExpression = parser.readIdentifierExpression(state, parser, trace.id);
    } else {
        switch (currentTokenKind) {
            case TokenKind.LeftParenthesis:
                primaryExpression = await parser.readParenthesizedExpression(state, parser, trace.id);
                break;

            case TokenKind.LeftBracket:
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

            case TokenKind.LeftBrace:
                primaryExpression = await parser.readListExpression(state, parser, trace.id);
                break;

            case TokenKind.Ellipsis:
                primaryExpression = parser.readNotImplementedExpression(state, parser, trace.id);
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
    correlationId: number | undefined,
): Promise<Ast.RecursivePrimaryExpression> {
    const nodeKind: Ast.NodeKind.RecursivePrimaryExpression = Ast.NodeKind.RecursivePrimaryExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readRecursivePrimaryExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    state.currentContextNode = ParseStateUtils.startContextAsParent(state, nodeKind, head.id, trace.id);

    const recursiveArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, recursiveArrayNodeKind);

    const recursiveExpressions: (Ast.InvokeExpression | Ast.ItemAccessExpression | Ast.TFieldAccessExpression)[] = [];
    let continueReadingValues: boolean = true;

    while (continueReadingValues) {
        const currentTokenKind: TokenKind | undefined = state.currentTokenKind;

        if (currentTokenKind === TokenKind.LeftParenthesis) {
            // eslint-disable-next-line no-await-in-loop
            recursiveExpressions.push(await parser.readInvokeExpression(state, parser, trace.id));
        } else if (currentTokenKind === TokenKind.LeftBrace) {
            // eslint-disable-next-line no-await-in-loop
            recursiveExpressions.push(await parser.readItemAccessExpression(state, parser, trace.id));
        } else if (currentTokenKind === TokenKind.LeftBracket) {
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
    correlationId: number | undefined,
): Ast.LiteralExpression {
    const nodeKind: Ast.NodeKind.LiteralExpression = Ast.NodeKind.LiteralExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readLiteralExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.HexLiteral,
        TokenKind.KeywordFalse,
        TokenKind.KeywordHashInfinity,
        TokenKind.KeywordHashNan,
        TokenKind.KeywordTrue,
        TokenKind.NumericLiteral,
        TokenKind.NullLiteral,
        TokenKind.TextLiteral,
    ];

    const error: ParseError.ExpectedAnyTokenKindError | undefined = ParseStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );

    if (error) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsThrowing]: true,
        });

        throw error;
    }

    const literalKind: Ast.LiteralKind = Assert.asDefined(
        AstUtils.literalKindFrom(state.currentTokenKind),
        `couldn't convert TokenKind into LiteralKind`,
        { currentTokenKind: state.currentTokenKind },
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
    correlationId: number | undefined,
): Ast.IdentifierExpression {
    const nodeKind: Ast.NodeKind.IdentifierExpression = Ast.NodeKind.IdentifierExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readIdentifierExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const inclusiveConstant: Ast.IConstant<Constant.MiscConstant.AtSign> | undefined =
        readTokenKindAsConstantOrUndefined(state, TokenKind.AtSign, Constant.MiscConstant.AtSign);

    const identifier: Ast.Identifier = parser.readIdentifier(state, parser, Ast.IdentifierContextKind.Value, trace.id);

    const identifierExpression: Ast.IdentifierExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        inclusiveConstant,
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
    correlationId: number | undefined,
): Promise<Ast.ParenthesizedExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readParenthesizedExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const parenthesizedExpression: Ast.ParenthesizedExpression = await readWrapped(
        state,
        Ast.NodeKind.ParenthesizedExpression,
        () =>
            readTokenKindAsConstant(
                state,
                TokenKind.LeftParenthesis,
                Constant.WrapperConstant.LeftParenthesis,
                trace.id,
            ),
        () => parser.readExpression(state, parser, trace.id),
        () =>
            readTokenKindAsConstant(
                state,
                TokenKind.RightParenthesis,
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
    correlationId: number | undefined,
): Ast.NotImplementedExpression {
    const nodeKind: Ast.NodeKind.NotImplementedExpression = Ast.NodeKind.NotImplementedExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readNotImplementedExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const ellipsisConstant: Ast.IConstant<Constant.MiscConstant.Ellipsis> = readTokenKindAsConstant(
        state,
        TokenKind.Ellipsis,
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
    correlationId: number | undefined,
): Promise<Ast.InvokeExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readInvokeExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, TokenKind.RightParenthesis);

    const invokeExpression: Ast.InvokeExpression = await readWrapped(
        state,
        Ast.NodeKind.InvokeExpression,
        () =>
            readTokenKindAsConstant(
                state,
                TokenKind.LeftParenthesis,
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
                TokenKind.RightParenthesis,
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
    correlationId: number | undefined,
): Promise<Ast.ListExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, TokenKind.RightBrace);

    const listExpression: Ast.ListExpression = await readWrapped(
        state,
        Ast.NodeKind.ListExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        async () =>
            await readCsvArray<Ast.TListItem>(
                state,
                async () => await parser.readListItem(state, parser, trace.id),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
                trace.id,
            ),
        () =>
            readClosingTokenKindAsConstant(state, TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
        false,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listExpression;
}

export async function readListItem(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.TListItem> {
    const nodeKind: Ast.NodeKind.RangeExpression = Ast.NodeKind.RangeExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListItem.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const left: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    if (ParseStateUtils.isOnTokenKind(state, TokenKind.DotDot)) {
        const rangeConstant: Ast.IConstant<Constant.MiscConstant.DotDot> = readTokenKindAsConstant(
            state,
            TokenKind.DotDot,
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
        ParseStateUtils.deleteContext(state);

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
    correlationId: number | undefined,
): Promise<Ast.RecordExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecordExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, TokenKind.RightBracket);

    const recordExpression: Ast.RecordExpression = await readWrapped(
        state,
        Ast.NodeKind.RecordExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () =>
            parser.readGeneralizedIdentifierPairedExpressions(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
                trace.id,
            ),
        () =>
            readClosingTokenKindAsConstant(
                state,
                TokenKind.RightBracket,
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
    correlationId: number | undefined,
): Promise<Ast.ItemAccessExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readItemAccessExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const itemAccessExpression: Ast.ItemAccessExpression = await readWrapped(
        state,
        Ast.NodeKind.ItemAccessExpression,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        async () => await parser.readExpression(state, parser, trace.id),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.FieldSelector> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldSelection.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const fieldSelector: Ast.FieldSelector = await readFieldSelector(state, parser, true, trace.id);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldSelector;
}

export async function readFieldProjection(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.FieldProjection> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldProjection.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const fieldProjection: Ast.FieldProjection = await readWrapped(
        state,
        Ast.NodeKind.FieldProjection,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () =>
            readCsvArray(
                state,
                () => parser.readFieldSelector(state, parser, false, trace.id),
                true,
                testCsvContinuationDanglingCommaForBracket,
                trace.id,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket, Constant.WrapperConstant.RightBracket, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.FieldSelector> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFieldSelector.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const fieldSelector: Ast.FieldSelector = await readWrapped(
        state,
        Ast.NodeKind.FieldSelector,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () => parser.readGeneralizedIdentifier(state, parser, trace.id),
        () => readTokenKindAsConstant(state, TokenKind.RightBracket, Constant.WrapperConstant.RightBracket, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.FunctionExpression> {
    const nodeKind: Ast.NodeKind.FunctionExpression = Ast.NodeKind.FunctionExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFunctionExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const parameters: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = await parser.readParameterList(
        state,
        parser,
        trace.id,
    );

    const functionReturnType: Ast.AsNullablePrimitiveType | undefined = await readAsNullablePrimitiveType(
        state,
        parser,
        trace.id,
    );

    const fatArrowConstant: Ast.IConstant<Constant.MiscConstant.FatArrow> = readTokenKindAsConstant(
        state,
        TokenKind.FatArrow,
        Constant.MiscConstant.FatArrow,
        trace.id,
    );

    const expression: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    const functionExpression: Ast.FunctionExpression = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        parameters,
        functionReturnType,
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
    correlationId: number | undefined,
): Promise<Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readParameterList.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const parameterList: Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined> = await genericReadParameterList(
        state,
        parser,
        () => readAsNullablePrimitiveType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return parameterList;
}

async function readAsNullablePrimitiveType(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.AsNullablePrimitiveType | undefined> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readAsNullablePrimitiveType.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const asNullablePrimitiveType: Ast.AsNullablePrimitiveType | undefined = await readPairedConstantOrUndefined(
        state,
        Ast.NodeKind.AsNullablePrimitiveType,
        () => ParseStateUtils.isOnTokenKind(state, TokenKind.KeywordAs),
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs, Constant.KeywordConstant.As, trace.id),
        () => parser.readNullablePrimitiveType(state, parser, trace.id),
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return asNullablePrimitiveType;
}

export async function readAsType(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.AsType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAsType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const asType: Ast.AsType = await readPairedConstant(
        state,
        Ast.NodeKind.AsType,
        () => readTokenKindAsConstant(state, TokenKind.KeywordAs, Constant.KeywordConstant.As, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.EachExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readEachExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const eachExpression: Ast.EachExpression = await readPairedConstant(
        state,
        Ast.NodeKind.EachExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordEach, Constant.KeywordConstant.Each, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.LetExpression> {
    const nodeKind: Ast.NodeKind.LetExpression = Ast.NodeKind.LetExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readLetExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const letConstant: Ast.IConstant<Constant.KeywordConstant.Let> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordLet,
        Constant.KeywordConstant.Let,
        trace.id,
    );

    const identifierPairedExpression: Ast.ICsvArray<Ast.IdentifierPairedExpression> =
        await parser.readIdentifierPairedExpressions(
            state,
            parser,
            !ParseStateUtils.isNextTokenKind(state, TokenKind.KeywordIn),
            ParseStateUtils.testCsvContinuationLetExpression,
            trace.id,
        );

    const inConstant: Ast.IConstant<Constant.KeywordConstant.In> = readClosingTokenKindAsConstant(
        state,
        TokenKind.KeywordIn,
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
    correlationId: number | undefined,
): Promise<Ast.IfExpression> {
    const nodeKind: Ast.NodeKind.IfExpression = Ast.NodeKind.IfExpression;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readIfExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const ifConstant: Ast.IConstant<Constant.KeywordConstant.If> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordIf,
        Constant.KeywordConstant.If,
        trace.id,
    );

    const condition: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    const thenConstant: Ast.IConstant<Constant.KeywordConstant.Then> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordThen,
        Constant.KeywordConstant.Then,
        trace.id,
    );

    const trueExpression: Ast.TExpression = await parser.readExpression(state, parser, trace.id);

    const elseConstant: Ast.IConstant<Constant.KeywordConstant.Else> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordElse,
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
    correlationId: number | undefined,
): Promise<Ast.TTypeExpression> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readTypeExpression.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    let typeExpression: Ast.TTypeExpression;

    if (ParseStateUtils.isOnTokenKind(state, TokenKind.KeywordType)) {
        typeExpression = await readPairedConstant(
            state,
            Ast.NodeKind.TypePrimaryType,
            () => readTokenKindAsConstant(state, TokenKind.KeywordType, Constant.KeywordConstant.Type, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.TType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<Ast.TPrimaryType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPrimaryType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<Ast.RecordType> {
    const nodeKind: Ast.NodeKind.RecordType = Ast.NodeKind.RecordType;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecordType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
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
    correlationId: number | undefined,
): Promise<Ast.TableType> {
    const nodeKind: Ast.NodeKind.TableType = Ast.NodeKind.TableType;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readTableType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const tableConstant: Ast.IConstant<Constant.PrimitiveTypeConstant.Table> = readConstantKind(
        state,
        Constant.PrimitiveTypeConstant.Table,
    );

    const currentTokenKind: TokenKind | undefined = state.currentTokenKind;

    const isPrimaryExpressionExpected: boolean =
        currentTokenKind === TokenKind.AtSign ||
        currentTokenKind === TokenKind.Identifier ||
        currentTokenKind === TokenKind.LeftParenthesis;

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
    correlationId: number | undefined,
): Promise<Ast.FieldSpecificationList> {
    const nodeKind: Ast.NodeKind.FieldSpecificationList = Ast.NodeKind.FieldSpecificationList;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldSpecificationList.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const leftBracketConstant: Ast.IConstant<Constant.WrapperConstant.LeftBracket> = readTokenKindAsConstant(
        state,
        TokenKind.LeftBracket,
        Constant.WrapperConstant.LeftBracket,
        trace.id,
    );

    const fields: Ast.ICsv<Ast.FieldSpecification>[] = [];
    let continueReadingValues: boolean = !ParseStateUtils.isOnTokenKind(state, TokenKind.RightBracket);
    let isOnOpenRecordMarker: boolean = false;

    const fieldArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, fieldArrayNodeKind);

    while (continueReadingValues) {
        const error: ParseError.TInnerParseError | undefined = testPostCommaError(state);

        if (error) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

            throw error;
        }

        if (ParseStateUtils.isOnTokenKind(state, TokenKind.Ellipsis)) {
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

            const optionalConstant: Ast.IConstant<Constant.LanguageConstant.Optional> | undefined =
                readConstantKindOrUndefined(state, Constant.LanguageConstant.Optional);

            // eslint-disable-next-line no-await-in-loop
            const name: Ast.GeneralizedIdentifier = await parser.readGeneralizedIdentifier(state, parser, trace.id);

            const fieldTypeSpecification: Ast.FieldTypeSpecification | undefined =
                // eslint-disable-next-line no-await-in-loop
                await readFieldTypeSpecification(state, parser, trace.id);

            const field: Ast.FieldSpecification = {
                ...ParseStateUtils.assertGetContextNodeMetadata(state),
                kind: fieldSpecificationNodeKind,
                isLeaf: false,
                optionalConstant,
                name,
                fieldTypeSpecification,
            };

            ParseStateUtils.endContext(state, field);

            const commaConstant: Ast.IConstant<Constant.MiscConstant.Comma> | undefined =
                readTokenKindAsConstantOrUndefined(state, TokenKind.Comma, Constant.MiscConstant.Comma);

            continueReadingValues = commaConstant !== undefined;

            const csv: Ast.ICsv<Ast.FieldSpecification> = {
                ...ParseStateUtils.assertGetContextNodeMetadata(state),
                kind: csvNodeKind,
                isLeaf: false,
                node: field,
                commaConstant,
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

    const openRecordMarkerConstant: Ast.IConstant<Constant.MiscConstant.Ellipsis> | undefined = isOnOpenRecordMarker
        ? readTokenKindAsConstant(state, TokenKind.Ellipsis, Constant.MiscConstant.Ellipsis, trace.id)
        : undefined;

    const rightBracketConstant: Ast.IConstant<Constant.WrapperConstant.RightBracket> = readClosingTokenKindAsConstant(
        state,
        TokenKind.RightBracket,
        Constant.WrapperConstant.RightBracket,
        trace.id,
    );

    const fieldSpecificationList: Ast.FieldSpecificationList = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        openWrapperConstant: leftBracketConstant,
        content: fieldArray,
        openRecordMarkerConstant,
        closeWrapperConstant: rightBracketConstant,
    };

    ParseStateUtils.endContext(state, fieldSpecificationList);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return fieldSpecificationList;
}

async function readFieldTypeSpecification(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.FieldTypeSpecification | undefined> {
    const nodeKind: Ast.NodeKind.FieldTypeSpecification = Ast.NodeKind.FieldTypeSpecification;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldTypeSpecification.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const equalConstant: Ast.IConstant<Constant.MiscConstant.Equal> | undefined = readTokenKindAsConstantOrUndefined(
        state,
        TokenKind.Equal,
        Constant.MiscConstant.Equal,
    );

    if (equalConstant) {
        const fieldType: Ast.TType = await parser.readType(state, parser, trace.id);

        const fieldTypeSpecification: Ast.FieldTypeSpecification = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.FieldTypeSpecification,
            isLeaf: false,
            equalConstant,
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
        ParseStateUtils.deleteContext(state);

        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsFieldTypeSpecification]: false,
        });

        return undefined;
    }
}

function fieldSpecificationListReadError(state: ParseState, allowOpenMarker: boolean): Error | undefined {
    if (allowOpenMarker) {
        const expectedTokenKinds: ReadonlyArray<TokenKind> = [TokenKind.Identifier, TokenKind.Ellipsis];

        return ParseStateUtils.testIsOnAnyTokenKind(state, expectedTokenKinds);
    } else {
        return ParseStateUtils.testIsOnTokenKind(state, TokenKind.Identifier);
    }
}

export async function readListType(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.ListType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const listType: Ast.ListType = await readWrapped(
        state,
        Ast.NodeKind.ListType,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        () => parser.readType(state, parser, trace.id),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
        false,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return listType;
}

export async function readFunctionType(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.FunctionType> {
    const nodeKind: Ast.NodeKind.FunctionType = Ast.NodeKind.FunctionType;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readFunctionType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();
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
    correlationId: number | undefined,
): Promise<TriedReadPrimaryType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, tryReadPrimaryType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    const isTableTypeNext: boolean =
        ParseStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstant.Table) &&
        (ParseStateUtils.isNextTokenKind(state, TokenKind.LeftBracket) ||
            ParseStateUtils.isNextTokenKind(state, TokenKind.LeftParenthesis) ||
            ParseStateUtils.isNextTokenKind(state, TokenKind.AtSign) ||
            ParseStateUtils.isNextTokenKind(state, TokenKind.Identifier));

    const isFunctionTypeNext: boolean =
        ParseStateUtils.isOnConstantKind(state, Constant.PrimitiveTypeConstant.Function) &&
        ParseStateUtils.isNextTokenKind(state, TokenKind.LeftParenthesis);

    let attempt: TriedReadPrimaryType;

    if (ParseStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        attempt = ResultUtils.ok(await parser.readRecordType(state, parser, trace.id));
    } else if (ParseStateUtils.isOnTokenKind(state, TokenKind.LeftBrace)) {
        attempt = ResultUtils.ok(await parser.readListType(state, parser, trace.id));
    } else if (isTableTypeNext) {
        attempt = ResultUtils.ok(await parser.readTableType(state, parser, trace.id));
    } else if (isFunctionTypeNext) {
        attempt = ResultUtils.ok(await parser.readFunctionType(state, parser, trace.id));
    } else if (ParseStateUtils.isOnConstantKind(state, Constant.LanguageConstant.Nullable)) {
        attempt = ResultUtils.ok(await parser.readNullableType(state, parser, trace.id));
    } else {
        const checkpoint: ParseStateCheckpoint = await parser.checkpoint(state);
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
    correlationId: number | undefined,
): Promise<Ast.IParameterList<Ast.AsType>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readParameterSpecificationList.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<Ast.NullableType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readNullableType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<Ast.ErrorRaisingExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readErrorRaisingExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const errorRaisingExpression: Ast.ErrorRaisingExpression = await readPairedConstant(
        state,
        Ast.NodeKind.ErrorRaisingExpression,
        () => readTokenKindAsConstant(state, TokenKind.KeywordError, Constant.KeywordConstant.Error, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.TErrorHandlingExpression> {
    const nodeKind: Ast.NodeKind.ErrorHandlingExpression = Ast.NodeKind.ErrorHandlingExpression;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readErrorHandlingExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);

    const tryConstant: Ast.IConstant<Constant.KeywordConstant.Try> = readTokenKindAsConstant(
        state,
        TokenKind.KeywordTry,
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
            () => readTokenKindAsConstant(state, TokenKind.Identifier, Constant.LanguageConstant.Catch, trace.id),
            () => parser.readFunctionExpression(state, parser, trace.id),
            trace.id,
        );

        const error: ParseError.InvalidCatchFunctionError | undefined = testCatchFunction(
            state,
            catchExpression.paired,
        );

        if (error) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsError]: true,
            });

            throw error;
        }

        const errorHandlingCatchExpression: Ast.ErrorHandlingCatchExpression = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            handlerKind: Ast.ErrorHandlerKind.Catch,
            isLeaf: false,
            tryConstant,
            protectedExpression,
            handler: catchExpression,
        };

        result = errorHandlingCatchExpression;
    }
    // optionally read OtherwiseExpression
    else {
        const otherwiseExpression: Ast.OtherwiseExpression | undefined = await readPairedConstantOrUndefined(
            state,
            Ast.NodeKind.OtherwiseExpression,
            () => ParseStateUtils.isOnTokenKind(state, TokenKind.KeywordOtherwise),
            () =>
                readTokenKindAsConstant(
                    state,
                    TokenKind.KeywordOtherwise,
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
            handler: otherwiseExpression,
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
    correlationId: number | undefined,
): Promise<Ast.RecordLiteral> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readRecordLiteral.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, TokenKind.RightBracket);

    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.RecordLiteral,
        Constant.WrapperConstant.LeftBracket,
        Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>,
        Constant.WrapperConstant.RightBracket
    > = await readWrapped(
        state,
        Ast.NodeKind.RecordLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBracket, Constant.WrapperConstant.LeftBracket, trace.id),
        () =>
            parser.readFieldNamePairedAnyLiterals(
                state,
                parser,
                continueReadingValues,
                testCsvContinuationDanglingCommaForBracket,
                trace.id,
            ),
        () =>
            readClosingTokenKindAsConstant(
                state,
                TokenKind.RightBracket,
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
    correlationId: number | undefined,
): Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readFieldNamePairedAnyLiterals.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const csvArray: Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral> = await readCsvArray(
        state,
        () =>
            readKeyValuePair<Ast.GeneralizedIdentifierPairedAnyLiteral>(
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
    correlationId: number | undefined,
): Promise<Ast.ListLiteral> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readListLiteral.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    const continueReadingValues: boolean = !ParseStateUtils.isNextTokenKind(state, TokenKind.RightBrace);

    const wrappedRead: Ast.IWrapped<
        Ast.NodeKind.ListLiteral,
        Constant.WrapperConstant.LeftBrace,
        Ast.ICsvArray<Ast.TAnyLiteral>,
        Constant.WrapperConstant.RightBrace
    > = await readWrapped(
        state,
        Ast.NodeKind.ListLiteral,
        () => readTokenKindAsConstant(state, TokenKind.LeftBrace, Constant.WrapperConstant.LeftBrace, trace.id),
        () =>
            readCsvArray<Ast.TAnyLiteral>(
                state,
                () => parser.readAnyLiteral(state, parser, trace.id),
                continueReadingValues,
                testCsvContinuationDanglingCommaForBrace,
                trace.id,
            ),
        () => readTokenKindAsConstant(state, TokenKind.RightBrace, Constant.WrapperConstant.RightBrace, trace.id),
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
    correlationId: number | undefined,
): Promise<Ast.TAnyLiteral> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readAnyLiteral.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

    let anyLiteral: Ast.TAnyLiteral;

    if (ParseStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        anyLiteral = await parser.readRecordLiteral(state, parser, trace.id);
    } else if (ParseStateUtils.isOnTokenKind(state, TokenKind.LeftBrace)) {
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
    correlationId: number | undefined,
): Promise<Ast.PrimitiveType> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readPrimitiveType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<TriedReadPrimitiveType> {
    const nodeKind: Ast.NodeKind.PrimitiveType = Ast.NodeKind.PrimitiveType;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, tryReadPrimitiveType.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    ParseStateUtils.startContext(state, nodeKind);

    const checkpoint: ParseStateCheckpoint = await parser.checkpoint(state);

    const expectedTokenKinds: ReadonlyArray<TokenKind> = [
        TokenKind.Identifier,
        TokenKind.KeywordType,
        TokenKind.NullLiteral,
    ];

    const error: ParseError.ExpectedAnyTokenKindError | undefined = ParseStateUtils.testIsOnAnyTokenKind(
        state,
        expectedTokenKinds,
    );

    if (error) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        return ResultUtils.error(error);
    }

    let primitiveTypeKind: Constant.PrimitiveTypeConstant;

    if (ParseStateUtils.isOnTokenKind(state, TokenKind.Identifier)) {
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

                return ResultUtils.error(
                    new ParseError.InvalidPrimitiveTypeError(
                        token,
                        state.lexerSnapshot.graphemePositionStartFrom(token),
                        state.locale,
                    ),
                );
            }
        }
    } else if (ParseStateUtils.isOnTokenKind(state, TokenKind.KeywordType)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstant.Type;
        readToken(state);
    } else if (ParseStateUtils.isOnTokenKind(state, TokenKind.NullLiteral)) {
        primitiveTypeKind = Constant.PrimitiveTypeConstant.Null;
        readToken(state);
    } else {
        const details: { tokenKind: TokenKind | undefined } = { tokenKind: state.currentTokenKind };
        await parser.restoreCheckpoint(state, checkpoint);

        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        return ResultUtils.error(
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

    return ResultUtils.ok(primitiveType);
}

// -------------------------------------
// ---------- key-value pairs ----------
// -------------------------------------

export async function readIdentifierPairedExpressions(
    state: ParseState,
    parser: Parser,
    continueReadingValues: boolean,
    testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    correlationId: number | undefined,
): Promise<Ast.ICsvArray<Ast.IdentifierPairedExpression>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readIdentifierPairedExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifierPairedExpressions.name,
        correlationId,
    );

    state.cancellationToken?.throwIfCancelled();

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
    correlationId: number | undefined,
): Promise<Ast.GeneralizedIdentifierPairedExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readGeneralizedIdentifierPairedExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const generalizedIdentifierPairedExpression: Ast.GeneralizedIdentifierPairedExpression =
        await readKeyValuePair<Ast.GeneralizedIdentifierPairedExpression>(
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
    correlationId: number | undefined,
): Promise<Ast.IdentifierPairedExpression> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readIdentifierPairedExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();

    const identifierPairedExpression: Ast.IdentifierPairedExpression =
        await readKeyValuePair<Ast.IdentifierPairedExpression>(
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

interface AsIsTokenKindMap {
    [Ast.NodeKind.AsExpression]: TokenKind.KeywordAs;
    [Ast.NodeKind.IsExpression]: TokenKind.KeywordIs;
}

// We need to be able to parse nested AsExpressions/IsExpressions, such as `1 as number as logical`.
// If we didn't have to worry about types or keeping our state in order we could use something like:
//
// let left = readEqualityExpression();
// while (currentTokenKind == TokenKind.As)
// {
//     const operator Read(TokenKind.As);
//     const right = ReadNullablePrimitiveType();
//     left = new BinOp(left, operator, right);
// }
// return left;
//
// One problem with the pseudo-code above is that we can't know what what we just parsed
// belongs under another AsExpression/IsExpression until after it's parsed. This means each
// iteration of the while-loop needs to create a new ParseContext as the parent of
// the previously parsed node.
export async function readRecursivelyEitherAsExpressionOrIsExpression<
    Node extends Ast.AsExpression | Ast.IsExpression,
    OperatorTokenKind extends AsIsTokenKindMap[Node["kind"]] = AsIsTokenKindMap[Node["kind"]],
>(
    state: ParseState,
    parser: Parser,
    nodeKind: Node["kind"],
    initialLeft: Node["left"],
    operatorTokenKind: OperatorTokenKind,
    operatorConstantKind: Node["operatorConstant"]["constantKind"],
    correlationId: number | undefined,
): Promise<Node | Node["left"]> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readRecursivelyEitherAsExpressionOrIsExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    let left: Node | Node["left"] = initialLeft;

    while (state.currentTokenKind === operatorTokenKind) {
        ParseStateUtils.startContextAsParent(state, nodeKind, left.id, trace.id);

        const operatorConstant: Ast.IConstant<Node["operatorConstant"]["constantKind"]> =
            NaiveParseSteps.readTokenKindAsConstant(state, operatorTokenKind, operatorConstantKind, trace.id);

        // eslint-disable-next-line no-await-in-loop
        const right: Ast.TNullablePrimitiveType = await parser.readNullablePrimitiveType(state, parser, trace.id);

        left = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: nodeKind,
            isLeaf: false,
            left,
            operatorConstant,
            right,
        } as Node;
    }

    trace.exit();

    return left;
}

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
    operatorFrom: (tokenKind: TokenKind | undefined) => Op | undefined,
    rightReader: () => Promise<Right>,
    correlationId: number | undefined,
): Promise<Left | Ast.IBinOpExpression<Kind, Left, Op, Right>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        recursiveReadBinOpExpression.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    ParseStateUtils.startContext(state, nodeKind);
    const left: Left = await leftReader();

    // If no operator, return Left
    const operator: Op | undefined = operatorFrom(state.currentTokenKind);

    if (operator === undefined) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });

        ParseStateUtils.deleteContext(state);

        return left;
    }

    const operatorConstant: Ast.TConstant & Ast.IConstant<Op> = readTokenKindAsConstant(
        state,
        Assert.asDefined(state.currentTokenKind),
        operator,
        trace.id,
    );

    const right: Right | Ast.IBinOpExpression<Kind, Right, Op, Right> = await recursiveReadBinOpExpressionHelper<
        Kind,
        Op,
        Right
    >(state, nodeKind, operatorFrom, rightReader, trace.id);

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
    operatorFrom: (tokenKind: TokenKind | undefined) => OperatorKind | undefined,
    rightReader: () => Promise<Right>,
    correlationId: number | undefined,
): Promise<Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right>> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        recursiveReadBinOpExpressionHelper.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    ParseStateUtils.startContext(state, nodeKind);
    const rightAsLeft: Right = await rightReader();

    const operator: OperatorKind | undefined = operatorFrom(state.currentTokenKind);

    if (operator === undefined) {
        ParseStateUtils.deleteContext(state);

        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [NaiveTraceConstant.IsOperatorPresent]: false,
        });

        return rightAsLeft;
    }

    const operatorConstant: Ast.TConstant & Ast.IConstant<OperatorKind> = readTokenKindAsConstant(
        state,
        Assert.asDefined(state.currentTokenKind),
        operator,
        trace.id,
    );

    const right: Right | Ast.IBinOpExpression<Kind, Right, OperatorKind, Right> =
        await recursiveReadBinOpExpressionHelper<Kind, OperatorKind, Right>(
            state,
            nodeKind,
            operatorFrom,
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
    correlationId: number | undefined,
): Promise<Ast.TCsvArray & Ast.ICsvArray<T>> {
    const nodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readCsvArray.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    ParseStateUtils.startContext(state, nodeKind);

    const elements: Ast.ICsv<T>[] = [];

    while (continueReadingValues) {
        const csvNodeKind: Ast.NodeKind.Csv = Ast.NodeKind.Csv;
        ParseStateUtils.startContext(state, csvNodeKind);

        const error: ParseError.TInnerParseError | undefined = testPostCommaError(state);

        if (error) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

            throw error;
        }

        // eslint-disable-next-line no-await-in-loop
        const node: T = await valueReader();

        const commaConstant: Ast.IConstant<Constant.MiscConstant.Comma> | undefined =
            readTokenKindAsConstantOrUndefined(state, TokenKind.Comma, Constant.MiscConstant.Comma);

        const element: Ast.TCsv & Ast.ICsv<T> = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: csvNodeKind,
            isLeaf: false,
            node,
            commaConstant,
        };

        ParseStateUtils.endContext(state, element);
        elements.push(element);

        continueReadingValues = commaConstant !== undefined;
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

async function readKeyValuePair<KVP extends Ast.TKeyValuePair>(
    state: ParseState,
    nodeKind: KVP["kind"],
    keyReader: () => Promise<KVP["key"]>,
    valueReader: () => Promise<KVP["value"]>,
    correlationId: number | undefined,
): Promise<KVP> {
    ParseStateUtils.startContext(state, nodeKind);

    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readKeyValuePair.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    const key: KVP["key"] = await keyReader();

    const equalConstant: Ast.IConstant<Constant.MiscConstant.Equal> = readTokenKindAsConstant(
        state,
        TokenKind.Equal,
        Constant.MiscConstant.Equal,
        trace.id,
    );

    const value: KVP["value"] = await valueReader();

    const keyValuePair: KVP = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: nodeKind,
        isLeaf: false,
        key,
        equalConstant,
        value,
    } as KVP;

    ParseStateUtils.endContext(state, keyValuePair);
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

async function readPairedConstantOrUndefined<
    Kind extends Ast.TPairedConstantNodeKind,
    ConstantKind extends Constant.TConstant,
    Paired,
>(
    state: ParseState,
    nodeKind: Kind,
    condition: () => boolean,
    constantReader: () => Ast.TConstant & Ast.IConstant<ConstantKind>,
    pairedReader: () => Promise<Paired>,
    correlationId: number | undefined,
): Promise<Ast.IPairedConstant<Kind, ConstantKind, Paired> | undefined> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readPairedConstantOrUndefined.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
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
    correlationId: number | undefined,
): Promise<Ast.IParameterList<T>> {
    const nodeKind: Ast.NodeKind.ParameterList = Ast.NodeKind.ParameterList;

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        genericReadParameterList.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    ParseStateUtils.startContext(state, nodeKind);

    const leftParenthesisConstant: Ast.IConstant<Constant.WrapperConstant.LeftParenthesis> = readTokenKindAsConstant(
        state,
        TokenKind.LeftParenthesis,
        Constant.WrapperConstant.LeftParenthesis,
        trace.id,
    );

    let continueReadingValues: boolean = !ParseStateUtils.isOnTokenKind(state, TokenKind.RightParenthesis);
    let reachedOptionalParameter: boolean = false;

    const paramterArrayNodeKind: Ast.NodeKind.ArrayWrapper = Ast.NodeKind.ArrayWrapper;
    ParseStateUtils.startContext(state, paramterArrayNodeKind);

    const parameters: Ast.ICsv<Ast.IParameter<T>>[] = [];

    while (continueReadingValues) {
        ParseStateUtils.startContext(state, Ast.NodeKind.Csv);
        ParseStateUtils.startContext(state, Ast.NodeKind.Parameter);

        const error: ParseError.TInnerParseError | undefined = testCsvContinuationDanglingCommaForParenthesis(state);

        if (error) {
            trace.exit({
                [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
                [TraceConstant.IsThrowing]: true,
            });

            throw error;
        }

        const optionalConstant: Ast.IConstant<Constant.LanguageConstant.Optional> | undefined =
            readConstantKindOrUndefined(state, Constant.LanguageConstant.Optional);

        if (reachedOptionalParameter && !optionalConstant) {
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
        } else if (optionalConstant) {
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
        const parameterType: T = await typeReader();

        const parameter: Ast.IParameter<T> = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Parameter,
            isLeaf: false,
            optionalConstant,
            name,
            parameterType,
        };

        ParseStateUtils.endContext(state, parameter);

        const commaConstant: Ast.IConstant<Constant.MiscConstant.Comma> | undefined =
            readTokenKindAsConstantOrUndefined(state, TokenKind.Comma, Constant.MiscConstant.Comma);

        continueReadingValues = commaConstant !== undefined;

        const csv: Ast.ICsv<Ast.IParameter<T>> = {
            ...ParseStateUtils.assertGetContextNodeMetadata(state),
            kind: Ast.NodeKind.Csv,
            isLeaf: false,
            node: parameter,
            commaConstant,
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
        TokenKind.RightParenthesis,
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
    correlationId: number | undefined,
): Promise<WrappedRead<Kind, Open, Content, Close>> {
    const trace: Trace = state.traceManager.entry(NaiveTraceConstant.Parse, readWrapped.name, correlationId, {
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
    });

    ParseStateUtils.startContext(state, nodeKind);

    const openWrapperConstant: Ast.IConstant<Open> = openConstantReader();
    const content: Content = await contentReader();
    const closeWrapperConstant: Ast.IConstant<Close> = closeConstantReader();

    let optionalConstant: Ast.IConstant<Constant.MiscConstant.QuestionMark> | undefined;

    if (allowOptionalConstant) {
        optionalConstant = readTokenKindAsConstantOrUndefined(
            state,
            TokenKind.QuestionMark,
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
        optionalConstant,
    };

    ParseStateUtils.endContext(state, wrapped as unknown as Ast.TWrapped);
    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return wrapped;
}

// ---------------------------------------------
// ---------- Helper functions (read) ----------
// ---------------------------------------------

export function readToken(state: ParseState): string {
    state.cancellationToken?.throwIfCancelled();

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
        // So, for now when a IParseState is Eof when currentTokenKind === undefined.
        state.currentTokenKind = undefined;
    } else {
        state.currentToken = tokens[state.tokenIndex];
        state.currentTokenKind = state.currentToken.kind;
    }

    return data;
}

export function readClosingTokenKindAsConstant<C extends Constant.TConstant>(
    state: ParseState,
    tokenKind: TokenKind,
    constantKind: C,
    correlationId: number | undefined,
): Ast.TConstant & Ast.IConstant<C> {
    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, Ast.NodeKind.Constant);

    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readTokenKindAsConstant.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    const error: ParseError.ExpectedClosingTokenKind | undefined = ParseStateUtils.testClosingTokenKind(
        state,
        tokenKind,
    );

    if (error !== undefined) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsThrowing]: true,
        });

        throw error;
    }

    const result: Ast.TConstant & Ast.IConstant<C> = readTokenKindAsConstantInternal<C>(
        state,
        tokenKind,
        constantKind,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return result;
}

export function readTokenKindAsConstant<C extends Constant.TConstant>(
    state: ParseState,
    tokenKind: TokenKind,
    constantKind: C,
    correlationId: number | undefined,
): Ast.TConstant & Ast.IConstant<C> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readTokenKindAsConstant.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, Ast.NodeKind.Constant);

    const result: Ast.TConstant & Ast.IConstant<C> = readTokenKindAsConstantInternal(
        state,
        tokenKind,
        constantKind,
        trace.id,
    );

    trace.exit({ [NaiveTraceConstant.TokenIndex]: state.tokenIndex });

    return result;
}

// Shares logic common to readTokenKindAsConstant and readClosingTokenKindAsConstant.
// Assumes the caller started a context for `Ast.NodeKInd.Constant`.
function readTokenKindAsConstantInternal<C extends Constant.TConstant>(
    state: ParseState,
    tokenKind: TokenKind,
    constantKind: C,
    correlationId: number,
): Ast.TConstant & Ast.IConstant<C> {
    const trace: Trace = state.traceManager.entry(
        NaiveTraceConstant.Parse,
        readTokenKindAsConstant.name,
        correlationId,
        { [NaiveTraceConstant.TokenIndex]: state.tokenIndex },
    );

    const error: ParseError.ExpectedTokenKindError | undefined = ParseStateUtils.testIsOnTokenKind(state, tokenKind);

    if (error !== undefined) {
        trace.exit({
            [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
            [TraceConstant.IsError]: true,
        });

        throw error;
    }

    const tokenData: string = readToken(state);
    Assert.isTrue(tokenData === constantKind, `expected tokenData to equal constantKind`, { tokenData, constantKind });

    const constant: Ast.TConstant & Ast.IConstant<C> = {
        ...ParseStateUtils.assertGetContextNodeMetadata(state),
        kind: Ast.NodeKind.Constant,
        isLeaf: true,
        constantKind,
    };

    ParseStateUtils.endContext(state, constant);

    trace.exit({
        [NaiveTraceConstant.TokenIndex]: state.tokenIndex,
        [TraceConstant.IsError]: false,
    });

    return constant;
}

export function readTokenKindAsConstantOrUndefined<ConstantKind extends Constant.TConstant>(
    state: ParseState,
    tokenKind: TokenKind,
    constantKind: ConstantKind,
): (Ast.TConstant & Ast.IConstant<ConstantKind>) | undefined {
    state.cancellationToken?.throwIfCancelled();

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

        return constant;
    } else {
        ParseStateUtils.incrementAttributeCounter(state);

        return undefined;
    }
}

function readTokenKind(state: ParseState, tokenKind: TokenKind): string {
    const error: ParseError.ExpectedTokenKindError | undefined = ParseStateUtils.testIsOnTokenKind(state, tokenKind);

    if (error) {
        throw error;
    }

    return readToken(state);
}

function readConstantKind<ConstantKind extends Constant.TConstant>(
    state: ParseState,
    constantKind: ConstantKind,
): Ast.TConstant & Ast.IConstant<ConstantKind> {
    return Assert.asDefined(readConstantKindOrUndefined(state, constantKind), `couldn't conver constantKind`, {
        constantKind,
    });
}

function readConstantKindOrUndefined<ConstantKind extends Constant.TConstant>(
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

function readLiteralAttributes(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.RecordLiteral | undefined> {
    if (ParseStateUtils.isOnTokenKind(state, TokenKind.LeftBracket)) {
        return parser.readRecordLiteral(state, parser, correlationId);
    } else {
        ParseStateUtils.incrementAttributeCounter(state);

        return Promise.resolve(undefined);
    }
}

// -------------------------------------------------------
// ---------- Helper functions (test functions) ----------
// -------------------------------------------------------

function testCsvContinuationDanglingCommaForBrace(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return ParseStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightBrace);
}

function testCsvContinuationDanglingCommaForBracket(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return ParseStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightBracket);
}

function testCsvContinuationDanglingCommaForParenthesis(
    state: ParseState,
): ParseError.ExpectedCsvContinuationError | undefined {
    return ParseStateUtils.testCsvContinuationDanglingComma(state, TokenKind.RightParenthesis);
}

// It must:
//  - have [0, 1] arguments
//  - no typing for either the argument or return
function testCatchFunction(
    state: ParseState,
    catchFunction: Ast.FunctionExpression,
): ParseError.InvalidCatchFunctionError | undefined {
    const parameters: ReadonlyArray<Ast.ICsv<Ast.IParameter<Ast.AsNullablePrimitiveType | undefined>>> =
        catchFunction.parameters.content.elements;

    if (
        parameters.length > 1 ||
        (parameters.length === 1 && parameters[0].node.parameterType) ||
        catchFunction.functionReturnType
    ) {
        const tokenStart: Token.Token = Assert.asDefined(
            state.lexerSnapshot.tokens[catchFunction.tokenRange.tokenIndexStart],
        );

        return new ParseError.InvalidCatchFunctionError(
            tokenStart,
            state.lexerSnapshot.graphemePositionStartFrom(tokenStart),
            state.locale,
        );
    }

    return undefined;
}
