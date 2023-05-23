// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, MapUtils, TypeScriptUtils } from "../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../language";
import { Disambiguation, DisambiguationUtils } from "../disambiguation";
import { NodeIdMap, ParseContextUtils } from "..";
import { Parser, ParserUtils } from "../parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { NaiveParseSteps } from ".";
import { Trace } from "../../common/trace";

// If the Naive parser were to parse the expression '1' it would need to recurse down a dozen or so constructs,
// which at each step would create a new context node, parse LiteralExpression, then traverse back up while
// cleaning the no-op context nodes along the way. Two key optimizations are used to prevent that.
//
// 1)
// The reading of binary expressions (expressions linked by TBinOpExpressionOperator) has been flattened.
// A TUnaryExpression read first, then while a TBinOpExpressionOperator is next it will read the operator
// constant and then the right hand of the TBinOpExpression. All expressions read will be placed in a flat list.
// Once no more expressions can be read the flat list will be shaped into a proper Ast.
// This eliminates several no-op functions calls on the call stack when reading a bare TUnaryExpression (eg. `1`).
//
// 2)
// readUnaryExpression uses limited look ahead to eliminate several function calls on the call stack.
export const CombinatorialParser: Parser = {
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

const enum CombinatorialParserV1TraceConstant {
    CombinatorialParseV1 = "CombinatorialParseV1",
}

async function readBinOpExpression(
    state: ParseState,
    parser: Parser,
    nodeKind: Ast.NodeKind,
    correlationId: number | undefined,
): Promise<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV1TraceConstant.CombinatorialParseV1,
        readBinOpExpression.name,
        correlationId,
    );

    state.cancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);
    const placeholderContextId: number = Assert.asDefined(state.currentContextNode).id;

    // operators/operatorConstants are of length N
    // expressions are of length N + 1
    let operators: Constant.TBinOpExpressionOperator[] = [];
    let operatorConstants: Ast.IConstant<Constant.TBinOpExpressionOperator>[] = [];

    let expressions: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [
        await parser.readUnaryExpression(state, parser, trace.id),
    ];

    let operator: Constant.TBinOpExpressionOperator | undefined = ConstantUtils.binOpExpressionOperatorKindFrom(
        state.currentTokenKind,
    );

    while (operator !== undefined) {
        operators.push(operator);

        operatorConstants.push(
            NaiveParseSteps.readTokenKindAsConstant<Constant.TBinOpExpressionOperator>(
                state,
                Assert.asDefined(state.currentTokenKind),
                operator,
                trace.id,
            ),
        );

        switch (operator) {
            case Constant.KeywordConstant.As:
            case Constant.KeywordConstant.Is:
                // eslint-disable-next-line no-await-in-loop
                expressions.push(await parser.readNullablePrimitiveType(state, parser, trace.id));
                break;

            default:
                // eslint-disable-next-line no-await-in-loop
                expressions.push(await parser.readUnaryExpression(state, parser, trace.id));
        }

        operator = ConstantUtils.binOpExpressionOperatorKindFrom(state.currentTokenKind);
    }

    // There was a single TUnaryExpression, not a TBinOpExpression.
    if (expressions.length === 1) {
        ParseStateUtils.deleteContext(state);
        trace.exit();

        return expressions[0];
    }

    // Build up the Ast by using the lowest precedence operator and the two adjacent expressions,
    // which might be previously built TBinOpExpression nodes.
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const newNodeThreshold: number = state.contextState.idCounter;

    let placeholderContextChildren: ReadonlyArray<number> = MapUtils.assertGet(
        nodeIdMapCollection.childIdsById,
        placeholderContextId,
    );

    while (operators.length) {
        const newBinOpExpressionId: number = ParseContextUtils.nextId(state.contextState);
        const minPrecedenceIndex: number = findMinOperatorPrecedenceIndex(operators);

        const left: TypeScriptUtils.StripReadonly<
            Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType
        > = expressions[minPrecedenceIndex];

        const operator: Constant.TBinOpExpressionOperator = operators[minPrecedenceIndex];

        const operatorConstant: TypeScriptUtils.StripReadonly<Ast.IConstant<Constant.TBinOpExpressionOperator>> =
            operatorConstants[minPrecedenceIndex];

        const right: TypeScriptUtils.StripReadonly<
            Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType
        > = expressions[minPrecedenceIndex + 1];

        left.attributeIndex = 0;
        operatorConstant.attributeIndex = 1;
        right.attributeIndex = 2;

        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;

        const newBinOpExpression: Ast.TBinOpExpression = {
            kind: binOpExpressionNodeKindFrom(operator),
            id: newBinOpExpressionId,
            // attributeIndex is fixed after all TBinOpExpressions have been created.
            attributeIndex: 0,
            tokenRange: {
                tokenIndexStart: leftTokenRange.tokenIndexStart,
                tokenIndexEnd: rightTokenRange.tokenIndexEnd,
                positionStart: leftTokenRange.positionStart,
                positionEnd: rightTokenRange.positionEnd,
            },
            isLeaf: false,
            left: left as Ast.TBinOpExpression,
            operator,
            operatorConstant,
            right,
        } as Ast.TBinOpExpression;

        operators = ArrayUtils.assertRemoveAtIndex(operators, minPrecedenceIndex);
        operatorConstants = ArrayUtils.assertRemoveAtIndex(operatorConstants, minPrecedenceIndex);

        expressions = expressions = [
            ...expressions.slice(0, minPrecedenceIndex),
            newBinOpExpression,
            ...expressions.slice(minPrecedenceIndex + 2),
        ];

        // Correct the parentIds for the nodes combined into newBinOpExpression.
        nodeIdMapCollection.parentIdById.set(left.id, newBinOpExpressionId);
        nodeIdMapCollection.parentIdById.set(operatorConstant.id, newBinOpExpressionId);
        nodeIdMapCollection.parentIdById.set(right.id, newBinOpExpressionId);

        // Assign the nodeIdMap values for newBinOpExpression.
        nodeIdMapCollection.childIdsById.set(newBinOpExpressionId, [left.id, operatorConstant.id, right.id]);
        nodeIdMapCollection.astNodeById.set(newBinOpExpressionId, newBinOpExpression);

        const idsForSpecificNodeKind: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
            newBinOpExpression.kind,
        );

        if (idsForSpecificNodeKind) {
            idsForSpecificNodeKind.add(newBinOpExpression.id);
        } else {
            nodeIdMapCollection.idsByNodeKind.set(newBinOpExpression.kind, new Set([newBinOpExpression.id]));
        }

        // All TUnaryExpression and operatorConstants start by being placed under the context node.
        // They need to be removed for deleteContext(placeholderContextId) to succeed.
        placeholderContextChildren = ArrayUtils.assertRemoveFirstInstance(
            placeholderContextChildren,
            operatorConstant.id,
        );

        if (left.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.assertRemoveFirstInstance(placeholderContextChildren, left.id);
        }

        if (right.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.assertRemoveFirstInstance(placeholderContextChildren, right.id);
        }

        nodeIdMapCollection.childIdsById.set(placeholderContextId, placeholderContextChildren);
    }

    const lastExpression: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType = expressions[0];

    Assert.isTrue(AstUtils.isTBinOpExpression(lastExpression), `lastExpression should be a TBinOpExpression`, {
        lastExpressionId: lastExpression.id,
        lastExpressionKind: lastExpression.kind,
    });

    nodeIdMapCollection.childIdsById.set(placeholderContextId, [lastExpression.id]);
    nodeIdMapCollection.parentIdById.set(lastExpression.id, placeholderContextId);

    ParseStateUtils.deleteContext(state, placeholderContextId);
    trace.exit();

    return lastExpression;
}

function binOpExpressionNodeKindFrom(operator: Constant.TBinOpExpressionOperator): Ast.TBinOpExpressionNodeKind {
    switch (operator) {
        case Constant.KeywordConstant.Meta:
            return Ast.NodeKind.MetadataExpression;

        case Constant.ArithmeticOperator.Multiplication:
        case Constant.ArithmeticOperator.Division:
        case Constant.ArithmeticOperator.Addition:
        case Constant.ArithmeticOperator.Subtraction:
        case Constant.ArithmeticOperator.And:
            return Ast.NodeKind.ArithmeticExpression;

        case Constant.RelationalOperator.GreaterThan:
        case Constant.RelationalOperator.GreaterThanEqualTo:
        case Constant.RelationalOperator.LessThan:
        case Constant.RelationalOperator.LessThanEqualTo:
            return Ast.NodeKind.RelationalExpression;

        case Constant.EqualityOperator.EqualTo:
        case Constant.EqualityOperator.NotEqualTo:
            return Ast.NodeKind.EqualityExpression;

        case Constant.KeywordConstant.As:
            return Ast.NodeKind.AsExpression;

        case Constant.KeywordConstant.Is:
            return Ast.NodeKind.IsExpression;

        case Constant.LogicalOperator.And:
        case Constant.LogicalOperator.Or:
            return Ast.NodeKind.LogicalExpression;

        case Constant.MiscConstant.NullCoalescingOperator:
            return Ast.NodeKind.NullCoalescingExpression;

        default:
            throw Assert.isNever(operator);
    }
}

function findMinOperatorPrecedenceIndex(operators: ReadonlyArray<Constant.TBinOpExpressionOperator>): number {
    const numOperators: number = operators.length;
    let minPrecedenceIndex: number = -1;
    let minPrecedence: number = Number.MAX_SAFE_INTEGER;

    for (let index: number = 0; index < numOperators; index += 1) {
        const currentPrecedence: number = ConstantUtils.binOpExpressionOperatorPrecedence(operators[index]);

        if (minPrecedence > currentPrecedence) {
            minPrecedence = currentPrecedence;
            minPrecedenceIndex = index;
        }
    }

    Assert.isTrue(minPrecedenceIndex !== -1, `minPrecedenceIndex !== -1`);

    return minPrecedenceIndex;
}

async function readUnaryExpression(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.TUnaryExpression> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV1TraceConstant.CombinatorialParseV1,
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
