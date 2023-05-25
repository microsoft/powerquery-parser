// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Token } from "../../../language";
import { CombinatorialParserV2TraceConstant, TNextDuoRead } from "./commonTypes";
import { Disambiguation, DisambiguationUtils } from "../../disambiguation";
import { NodeIdMap, ParseContext } from "../..";
import { Parser, ParserUtils } from "../../parser";
import { ParseState, ParseStateUtils } from "../../parseState";
import { Assert } from "../../../common";
import { combineOperatorsAndOperands } from "./combiners";
import { NaiveParseSteps } from "..";
import { removeIdFromIdsByNodeKind } from "./utils";
import { Trace } from "../../../common/trace";

// TODO: write a summary for V2
export const CombinatorialParserV2: Parser = {
    applyState: ParseStateUtils.applyState,
    copyState: ParseStateUtils.copyState,
    checkpoint: ParserUtils.checkpoint,
    restoreCheckpoint: ParserUtils.restoreCheckpoint,

    readIdentifier: NaiveParseSteps.readIdentifier,
    readGeneralizedIdentifier: NaiveParseSteps.readGeneralizedIdentifier,
    readKeyword: NaiveParseSteps.readKeyword,

    readDocument: NaiveParseSteps.readDocument,

    readSectionDocument: NaiveParseSteps.readSectionDocument,
    readSectionMembers: NaiveParseSteps.readSectionMembers,
    readSectionMember: NaiveParseSteps.readSectionMember,

    readNullCoalescingExpression: NaiveParseSteps.readNullCoalescingExpression,
    readExpression: NaiveParseSteps.readExpression,

    readLogicalExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.LogicalExpression,
            correlationId,
        ) as Promise<Ast.TLogicalExpression>,

    readIsExpression: NaiveParseSteps.readIsExpression,
    readNullablePrimitiveType: NaiveParseSteps.readNullablePrimitiveType,

    readAsExpression: NaiveParseSteps.readAsExpression,

    readEqualityExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.EqualityExpression,
            correlationId,
        ) as Promise<Ast.TEqualityExpression>,

    readRelationalExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.RelationalExpression,
            correlationId,
        ) as Promise<Ast.TRelationalExpression>,

    readArithmeticExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.ArithmeticExpression,
            correlationId,
        ) as Promise<Ast.TArithmeticExpression>,

    readMetadataExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.MetadataExpression,
            correlationId,
        ) as Promise<Ast.TMetadataExpression>,

    readUnaryExpression,

    readPrimaryExpression: NaiveParseSteps.readPrimaryExpression,
    readRecursivePrimaryExpression: NaiveParseSteps.readRecursivePrimaryExpression,

    readLiteralExpression: NaiveParseSteps.readLiteralExpression,

    readIdentifierExpression: NaiveParseSteps.readIdentifierExpression,

    readParenthesizedExpression: NaiveParseSteps.readParenthesizedExpression,

    readNotImplementedExpression: NaiveParseSteps.readNotImplementedExpression,

    readInvokeExpression: NaiveParseSteps.readInvokeExpression,

    readListExpression: NaiveParseSteps.readListExpression,
    readListItem: NaiveParseSteps.readListItem,

    readRecordExpression: NaiveParseSteps.readRecordExpression,

    readItemAccessExpression: NaiveParseSteps.readItemAccessExpression,

    readFieldSelection: NaiveParseSteps.readFieldSelection,
    readFieldProjection: NaiveParseSteps.readFieldProjection,
    readFieldSelector: NaiveParseSteps.readFieldSelector,

    readFunctionExpression: NaiveParseSteps.readFunctionExpression,
    readParameterList: NaiveParseSteps.readParameterList,
    readAsType: NaiveParseSteps.readAsType,

    readEachExpression: NaiveParseSteps.readEachExpression,

    readLetExpression: NaiveParseSteps.readLetExpression,

    readIfExpression: NaiveParseSteps.readIfExpression,

    readTypeExpression: NaiveParseSteps.readTypeExpression,
    readType: NaiveParseSteps.readType,
    readPrimaryType: NaiveParseSteps.readPrimaryType,
    readRecordType: NaiveParseSteps.readRecordType,
    readTableType: NaiveParseSteps.readTableType,
    readFieldSpecificationList: NaiveParseSteps.readFieldSpecificationList,
    readListType: NaiveParseSteps.readListType,
    readFunctionType: NaiveParseSteps.readFunctionType,
    readParameterSpecificationList: NaiveParseSteps.readParameterSpecificationList,
    readNullableType: NaiveParseSteps.readNullableType,

    readErrorRaisingExpression: NaiveParseSteps.readErrorRaisingExpression,

    readErrorHandlingExpression: NaiveParseSteps.readErrorHandlingExpression,

    readRecordLiteral: NaiveParseSteps.readRecordLiteral,
    readFieldNamePairedAnyLiterals: NaiveParseSteps.readFieldNamePairedAnyLiterals,
    readListLiteral: NaiveParseSteps.readListLiteral,
    readAnyLiteral: NaiveParseSteps.readAnyLiteral,
    readPrimitiveType: NaiveParseSteps.readPrimitiveType,

    readIdentifierPairedExpressions: NaiveParseSteps.readIdentifierPairedExpressions,
    readIdentifierPairedExpression: NaiveParseSteps.readIdentifierPairedExpression,
    readGeneralizedIdentifierPairedExpressions: NaiveParseSteps.readGeneralizedIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpression: NaiveParseSteps.readGeneralizedIdentifierPairedExpression,
};

// First, read all of the operators and operands.
// Second, build up the tree from the read operators and operands.
// We expect N operators and N+1 operands (where N >= 0).
async function readBinOpExpression(
    state: ParseState,
    parser: Parser,
    nodeKind: Ast.NodeKind,
    correlationId: number | undefined,
): Promise<Ast.TNode> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        readBinOpExpression.name,
        correlationId,
    );

    const placeholderContextNode: ParseContext.TNode = ParseStateUtils.startContext(state, nodeKind);
    const placeholderContextNodeId: number = placeholderContextNode.id;
    const initialUnaryExpression: Ast.TUnaryExpression = await parser.readUnaryExpression(state, parser, trace.id);
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;

    const operatorConstants: Ast.TBinOpExpressionConstant[] = [];
    const operands: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [];
    let nextDuoRead: TNextDuoRead | undefined = NextDuoReadByTokenKind.get(state.currentTokenKind);

    while (nextDuoRead) {
        const iterativeParseContext: ParseContext.Node<Ast.TNode> = ParseStateUtils.startContext(
            state,
            nextDuoRead.nodeKind,
        );

        iterativeParseContext.attributeCounter = 1;

        const operatorConstant: Ast.TBinOpExpressionConstant =
            NaiveParseSteps.readTokenKindAsConstant<Constant.TBinOpExpressionOperator>(
                state,
                nextDuoRead.operatorTokenKind,
                nextDuoRead.operatorConstantKind,
                trace.id,
            );

        let operand: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType;

        switch (nextDuoRead.duoReadKind) {
            case Ast.NodeKind.UnaryExpression: {
                // eslint-disable-next-line no-await-in-loop
                operand = await parser.readUnaryExpression(state, parser, trace.id);

                break;
            }

            case Ast.NodeKind.NullablePrimitiveType:
                // eslint-disable-next-line no-await-in-loop
                operand = await parser.readNullablePrimitiveType(state, parser, trace.id);

                break;

            case Ast.NodeKind.LogicalExpression:
                // eslint-disable-next-line no-await-in-loop
                operand = await parser.readLogicalExpression(state, parser, trace.id);

                break;

            default:
                throw Assert.isNever(nextDuoRead);
        }

        operatorConstants.push(operatorConstant);
        operands.push(operand);

        for (const nodeId of [operand.id, operatorConstant.id, iterativeParseContext.id]) {
            nodeIdMapCollection.astNodeById.delete(nodeId);
            nodeIdMapCollection.parentIdById.delete(nodeId);
            nodeIdMapCollection.childIdsById.delete(nodeId);
            nodeIdMapCollection.leafIds.delete(nodeId);
        }

        nodeIdMapCollection.contextNodeById.delete(iterativeParseContext.id);

        removeIdFromIdsByNodeKind(
            nodeIdMapCollection.idsByNodeKind,
            iterativeParseContext.kind,
            iterativeParseContext.id,
        );

        removeIdFromIdsByNodeKind(nodeIdMapCollection.idsByNodeKind, Ast.NodeKind.Constant, operatorConstant.id);
        removeIdFromIdsByNodeKind(nodeIdMapCollection.idsByNodeKind, operand.kind, operand.id);

        // eslint-disable-next-line require-atomic-updates
        state.currentContextNode = placeholderContextNode;
        nextDuoRead = NextDuoReadByTokenKind.get(state.currentTokenKind);
    }

    Assert.isTrue(
        state.currentContextNode?.id === placeholderContextNodeId,
        `state.currentContextNode.id === placeholderContextNodeId failed`,
        {
            currentContextNodeId: state.currentContextNode?.id,
            placeholderContextId: placeholderContextNodeId,
        },
    );

    Assert.isTrue(operatorConstants.length === operands.length, `operators.length === operands.length failed`, {
        operatorsLength: operatorConstants.length,
        operandsLength: operands.length,
    });

    let result: Ast.TNode;

    if (!operatorConstants.length) {
        ParseStateUtils.deleteContext(state, placeholderContextNodeId);
        result = initialUnaryExpression;
    } else {
        result = combineOperatorsAndOperands(
            state,
            parser,
            placeholderContextNodeId,
            [initialUnaryExpression, ...operands],
            operatorConstants,
            trace.id,
        );

        ParseStateUtils.deleteContext(state, placeholderContextNodeId);
    }

    trace.exit();

    return result;
}

async function readUnaryExpression(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.TUnaryExpression> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        readUnaryExpression.name,
        correlationId,
    );

    state.cancellationToken?.throwIfCancelled();

    let primaryExpression: Ast.TPrimaryExpression | undefined;

    // LL(1)
    switch (state.currentTokenKind) {
        // PrimaryExpression
        case Token.TokenKind.AtSign:
        case Token.TokenKind.Identifier:
            primaryExpression = NaiveParseSteps.readIdentifierExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.LeftParenthesis:
            primaryExpression = await NaiveParseSteps.readParenthesizedExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.LeftBracket:
            primaryExpression = await DisambiguationUtils.readAmbiguousBracket(
                state,
                parser,
                [
                    Disambiguation.BracketDisambiguation.RecordExpression,
                    Disambiguation.BracketDisambiguation.FieldSelection,
                    Disambiguation.BracketDisambiguation.FieldProjection,
                ],
                trace.id,
            );

            break;

        case Token.TokenKind.LeftBrace:
            primaryExpression = await NaiveParseSteps.readListExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.Ellipsis:
            primaryExpression = NaiveParseSteps.readNotImplementedExpression(state, parser, trace.id);
            break;

        // LiteralExpression
        case Token.TokenKind.HexLiteral:
        case Token.TokenKind.KeywordFalse:
        case Token.TokenKind.KeywordTrue:
        case Token.TokenKind.NumericLiteral:
        case Token.TokenKind.NullLiteral:
        case Token.TokenKind.TextLiteral:
            trace.exit();

            return NaiveParseSteps.readLiteralExpression(state, parser, trace.id);

        // TypeExpression
        case Token.TokenKind.KeywordType:
            trace.exit();

            return NaiveParseSteps.readTypeExpression(state, parser, trace.id);

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

        // Let Naive throw an error.
        default:
            trace.exit();

            return NaiveParseSteps.readUnaryExpression(state, parser, trace.id);
    }

    if (ParseStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex)) {
        trace.exit();

        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression, trace.id);
    } else {
        trace.exit();

        return primaryExpression;
    }
}

const NextDuoReadByTokenKind: ReadonlyMap<Token.TokenKind | undefined, TNextDuoRead> = new Map<
    Token.TokenKind | undefined,
    TNextDuoRead
>([
    [
        Token.TokenKind.Asterisk,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Asterisk,
            operatorConstantKind: Constant.ArithmeticOperator.Multiplication,
        },
    ],
    [
        Token.TokenKind.Division,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Division,
            operatorConstantKind: Constant.ArithmeticOperator.Division,
        },
    ],
    [
        Token.TokenKind.Plus,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Plus,
            operatorConstantKind: Constant.ArithmeticOperator.Addition,
        },
    ],
    [
        Token.TokenKind.Minus,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Minus,
            operatorConstantKind: Constant.ArithmeticOperator.Subtraction,
        },
    ],
    [
        Token.TokenKind.Ampersand,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Ampersand,
            operatorConstantKind: Constant.ArithmeticOperator.And,
        },
    ],
    [
        Token.TokenKind.Equal,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.EqualityExpression,
            operatorTokenKind: Token.TokenKind.Equal,
            operatorConstantKind: Constant.EqualityOperator.EqualTo,
        },
    ],
    [
        Token.TokenKind.NotEqual,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.EqualityExpression,
            operatorTokenKind: Token.TokenKind.NotEqual,
            operatorConstantKind: Constant.EqualityOperator.NotEqualTo,
        },
    ],
    [
        Token.TokenKind.KeywordAnd,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.LogicalExpression,
            operatorTokenKind: Token.TokenKind.KeywordAnd,
            operatorConstantKind: Constant.LogicalOperator.And,
        },
    ],
    [
        Token.TokenKind.KeywordOr,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.LogicalExpression,
            operatorTokenKind: Token.TokenKind.KeywordOr,
            operatorConstantKind: Constant.LogicalOperator.Or,
        },
    ],
    [
        Token.TokenKind.LessThan,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.LessThan,
            operatorConstantKind: Constant.RelationalOperator.LessThan,
        },
    ],
    [
        Token.TokenKind.LessThanEqualTo,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.LessThanEqualTo,
            operatorConstantKind: Constant.RelationalOperator.LessThanEqualTo,
        },
    ],
    [
        Token.TokenKind.GreaterThan,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.GreaterThan,
            operatorConstantKind: Constant.RelationalOperator.GreaterThan,
        },
    ],
    [
        Token.TokenKind.GreaterThanEqualTo,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.GreaterThanEqualTo,
            operatorConstantKind: Constant.RelationalOperator.GreaterThanEqualTo,
        },
    ],
    [
        Token.TokenKind.KeywordAs,
        {
            duoReadKind: Ast.NodeKind.NullablePrimitiveType,
            nodeKind: Ast.NodeKind.AsExpression,
            operatorTokenKind: Token.TokenKind.KeywordAs,
            operatorConstantKind: Constant.KeywordConstant.As,
        },
    ],
    [
        Token.TokenKind.KeywordIs,
        {
            duoReadKind: Ast.NodeKind.NullablePrimitiveType,
            nodeKind: Ast.NodeKind.IsExpression,
            operatorTokenKind: Token.TokenKind.KeywordIs,
            operatorConstantKind: Constant.KeywordConstant.Is,
        },
    ],
    [
        Token.TokenKind.KeywordMeta,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.MetadataExpression,
            operatorTokenKind: Token.TokenKind.KeywordMeta,
            operatorConstantKind: Constant.KeywordConstant.Meta,
        },
    ],
    [
        Token.TokenKind.NullCoalescingOperator,
        {
            duoReadKind: Ast.NodeKind.LogicalExpression,
            nodeKind: Ast.NodeKind.NullCoalescingExpression,
            operatorTokenKind: Token.TokenKind.NullCoalescingOperator,
            operatorConstantKind: Constant.MiscConstant.NullCoalescingOperator,
        },
    ],
]);
