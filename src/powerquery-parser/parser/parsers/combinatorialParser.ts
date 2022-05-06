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
    ...NaiveParseSteps,
    applyState: ParseStateUtils.applyState,
    copyState: ParseStateUtils.copyState,
    createCheckpoint: ParserUtils.createCheckpoint,
    restoreCheckpoint: ParserUtils.restoreCheckpoint,

    // 12.2.3.2 Logical expressions
    readLogicalExpression: (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            maybeCorrelationId,
            Ast.NodeKind.LogicalExpression,
        ) as Promise<Ast.TLogicalExpression>,

    // 12.2.3.3 Is expression
    readIsExpression: (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) =>
        readBinOpExpression(state, parser, maybeCorrelationId, Ast.NodeKind.IsExpression) as Promise<Ast.TIsExpression>,

    // 12.2.3.4 As expression
    readAsExpression: (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) =>
        readBinOpExpression(state, parser, maybeCorrelationId, Ast.NodeKind.AsExpression) as Promise<Ast.TAsExpression>,

    // 12.2.3.5 Equality expression
    readEqualityExpression: (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            maybeCorrelationId,
            Ast.NodeKind.EqualityExpression,
        ) as Promise<Ast.TEqualityExpression>,

    // 12.2.3.6 Relational expression
    readRelationalExpression: (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            maybeCorrelationId,
            Ast.NodeKind.RelationalExpression,
        ) as Promise<Ast.TRelationalExpression>,

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            maybeCorrelationId,
            Ast.NodeKind.ArithmeticExpression,
        ) as Promise<Ast.TArithmeticExpression>,

    // 12.2.3.8 Metadata expression
    readMetadataExpression: (state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            maybeCorrelationId,
            Ast.NodeKind.MetadataExpression,
        ) as Promise<Ast.TMetadataExpression>,

    // 12.2.3.9 Unary expression
    readUnaryExpression,
};

const enum CombinatorialTraceConstant {
    CombinatorialParse = "CombinatorialParse",
}

async function readBinOpExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
    nodeKind: Ast.NodeKind,
): Promise<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialTraceConstant.CombinatorialParse,
        readBinOpExpression.name,
        maybeCorrelationId,
    );

    state.maybeCancellationToken?.throwIfCancelled();
    ParseStateUtils.startContext(state, nodeKind);
    const placeholderContextId: number = Assert.asDefined(state.maybeCurrentContextNode).id;

    // operators/operatorConstants are of length N
    // expressions are of length N + 1
    let operators: Constant.TBinOpExpressionOperator[] = [];
    let operatorConstants: Ast.IConstant<Constant.TBinOpExpressionOperator>[] = [];

    let expressions: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [
        await parser.readUnaryExpression(state, parser, trace.id),
    ];

    let maybeOperator: Constant.TBinOpExpressionOperator | undefined =
        ConstantUtils.maybeBinOpExpressionOperatorKindFrom(state.maybeCurrentTokenKind);

    while (maybeOperator !== undefined) {
        const operator: Constant.TBinOpExpressionOperator = maybeOperator;
        operators.push(operator);

        operatorConstants.push(
            NaiveParseSteps.readTokenKindAsConstant<Constant.TBinOpExpressionOperator>(
                state,
                trace.id,
                Assert.asDefined(state.maybeCurrentTokenKind),
                maybeOperator,
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

        maybeOperator = ConstantUtils.maybeBinOpExpressionOperatorKindFrom(state.maybeCurrentTokenKind);
    }

    // There was a single TUnaryExpression, not a TBinOpExpression.
    if (expressions.length === 1) {
        ParseStateUtils.deleteContext(state, placeholderContextId);
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
        let minPrecedenceIndex: number = -1;
        let minPrecedence: number = Number.MAX_SAFE_INTEGER;

        for (let index: number = 0; index < operators.length; index += 1) {
            const currentPrecedence: number = ConstantUtils.binOpExpressionOperatorPrecedence(operators[index]);

            if (minPrecedence > currentPrecedence) {
                minPrecedence = currentPrecedence;
                minPrecedenceIndex = index;
            }
        }

        const newBinOpExpressionId: number = ParseContextUtils.nextId(state.contextState);

        const left: TypeScriptUtils.StripReadonly<
            Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType
        > = expressions[minPrecedenceIndex];

        const operator: Constant.TBinOpExpressionOperator = operators[minPrecedenceIndex];

        const operatorConstant: TypeScriptUtils.StripReadonly<Ast.IConstant<Constant.TBinOpExpressionOperator>> =
            operatorConstants[minPrecedenceIndex];

        const right: TypeScriptUtils.StripReadonly<
            Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType
        > = expressions[minPrecedenceIndex + 1];

        left.maybeAttributeIndex = 0;
        operatorConstant.maybeAttributeIndex = 1;
        right.maybeAttributeIndex = 2;

        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;

        const newBinOpExpression: Ast.TBinOpExpression = {
            kind: binOpExpressionNodeKindFrom(operator),
            id: newBinOpExpressionId,
            // maybeAttributeIndex is fixed after all TBinOpExpressions have been created.
            maybeAttributeIndex: 0,
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

        operators = ArrayUtils.removeAtIndex(operators, minPrecedenceIndex);
        operatorConstants = ArrayUtils.removeAtIndex(operatorConstants, minPrecedenceIndex);

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

        const maybeIdsForSpecificNodeKind: Set<number> | undefined = nodeIdMapCollection.idsByNodeKind.get(
            newBinOpExpression.kind,
        );

        if (maybeIdsForSpecificNodeKind) {
            maybeIdsForSpecificNodeKind.add(newBinOpExpression.id);
        } else {
            nodeIdMapCollection.idsByNodeKind.set(newBinOpExpression.kind, new Set([newBinOpExpression.id]));
        }

        // All TUnaryExpression and operatorConstants start by being placed under the context node.
        // They need to be removed for deleteContext(placeholderContextId) to succeed.
        placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, operatorConstant.id);

        if (left.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, left.id);
        }

        if (right.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, right.id);
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

async function readUnaryExpression(
    state: ParseState,
    parser: Parser,
    maybeCorrelationId: number | undefined,
): Promise<Ast.TUnaryExpression> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialTraceConstant.CombinatorialParse,
        readUnaryExpression.name,
        maybeCorrelationId,
    );

    state.maybeCancellationToken?.throwIfCancelled();

    let maybePrimaryExpression: Ast.TPrimaryExpression | undefined;

    // LL(1)
    switch (state.maybeCurrentTokenKind) {
        // PrimaryExpression
        case Token.TokenKind.AtSign:
        case Token.TokenKind.Identifier:
            maybePrimaryExpression = NaiveParseSteps.readIdentifierExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.LeftParenthesis:
            maybePrimaryExpression = await NaiveParseSteps.readParenthesizedExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.LeftBracket:
            maybePrimaryExpression = await DisambiguationUtils.readAmbiguousBracket(state, parser, trace.id, [
                Disambiguation.BracketDisambiguation.RecordExpression,
                Disambiguation.BracketDisambiguation.FieldSelection,
                Disambiguation.BracketDisambiguation.FieldProjection,
            ]);

            break;

        case Token.TokenKind.LeftBrace:
            maybePrimaryExpression = await NaiveParseSteps.readListExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.Ellipsis:
            maybePrimaryExpression = NaiveParseSteps.readNotImplementedExpression(state, parser, trace.id);
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

            return await NaiveParseSteps.readTypeExpression(state, parser, trace.id);

        case Token.TokenKind.KeywordHashSections:
        case Token.TokenKind.KeywordHashShared:
        case Token.TokenKind.KeywordHashBinary:
        case Token.TokenKind.KeywordHashDate:
        case Token.TokenKind.KeywordHashDateTime:
        case Token.TokenKind.KeywordHashDateTimeZone:
        case Token.TokenKind.KeywordHashDuration:
        case Token.TokenKind.KeywordHashTable:
        case Token.TokenKind.KeywordHashTime:
            maybePrimaryExpression = parser.readKeyword(state, parser, trace.id);
            break;

        // Let Naive throw an error.
        default:
            trace.exit();

            return await NaiveParseSteps.readUnaryExpression(state, parser, trace.id);
    }

    // We should only reach this code block if a primary expression was read.
    const primaryExpression: Ast.TPrimaryExpression = maybePrimaryExpression;

    if (ParseStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex)) {
        trace.exit();

        return await parser.readRecursivePrimaryExpression(state, parser, trace.id, primaryExpression);
    } else {
        trace.exit();

        return primaryExpression;
    }
}
