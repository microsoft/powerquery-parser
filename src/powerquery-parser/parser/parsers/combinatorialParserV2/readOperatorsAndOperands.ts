// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, MapUtils, SetUtils } from "../../../common";
import { Ast, Constant, Token } from "../../../language";
import { CombinatorialParserV2TraceConstant, OperatorsAndOperands } from "./commonTypes";
import { NodeIdMap, ParseContext } from "../..";
import { ParseState, ParseStateUtils } from "../../parseState";
import { IdsByNodeKind } from "../../nodeIdMap/nodeIdMap";
import { NaiveParseSteps } from "..";
import { Parser } from "../../parser";
import { Trace } from "../../../common/trace";

// Asserts that N operators and N+1 operands are read (where N >= 0).
// Both operators and operands are read in a left-to-right fashion and are returned in that order.
//
// It's possible that the reading of the operand to fail. In that case you'll see the following:
//  - a binary expression context under the initial context node
//  - it will have 2 children
//      - an Ast node for the operatorConstant
//      - a parse context node for the operand
export async function readOperatorsAndOperands(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<OperatorsAndOperands> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        readOperatorsAndOperands.name,
        correlationId,
    );

    const initialCurrentContextNode: ParseContext.TNode = Assert.asDefined(state.currentContextNode);
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const operatorConstants: Ast.TBinOpExpressionConstant[] = [];

    // The initial read will always be a TUnaryExpression.
    // Continually read an operator and operand while a valid operator constant exists.
    // A different operand reader is used depending on the operator constant.
    const operands: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [
        await parser.readUnaryExpression(state, parser, trace.id),
    ];

    let nextRead: NextOperatorAndOperandRead | undefined = NextOperatorAndOperandReadByTokenKind.get(
        state.currentTokenKind,
    );

    while (nextRead) {
        const iterativeParseContext: ParseContext.Node<Ast.TNode> = ParseStateUtils.startContext(
            state,
            nextRead.binOpExpressionNodeKind,
        );

        iterativeParseContext.attributeCounter = 1;

        const operatorConstant: Ast.TBinOpExpressionConstant =
            NaiveParseSteps.readTokenKindAsConstant<Constant.TBinOpExpressionOperator>(
                state,
                nextRead.operatorTokenKind,
                nextRead.operatorConstantKind,
                trace.id,
            );

        let operand: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType;

        switch (nextRead.operandNodeKind) {
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
                throw Assert.isNever(nextRead.operandNodeKind);
        }

        // Append the operator/operator for the result.
        operatorConstants.push(operatorConstant);
        operands.push(operand);

        // If we don't do any nodeIdMapCollection modifications it would be in a weird state.
        // Specifically, every operator/operand would be a child of the initial context node,
        // which doesn't make much sense if you had to examine the parse state downstream.
        //
        // For now we're deleting those links and will re-create them later as we combine operators/operands.
        for (const nodeId of [operand.id, operatorConstant.id, iterativeParseContext.id]) {
            nodeIdMapCollection.astNodeById.delete(nodeId);
            nodeIdMapCollection.parentIdById.delete(nodeId);
        }

        nodeIdMapCollection.contextNodeById.delete(iterativeParseContext.id);
        nodeIdMapCollection.childIdsById.delete(iterativeParseContext.id);

        removeIdFromIdsByNodeKind(
            nodeIdMapCollection.idsByNodeKind,
            iterativeParseContext.kind,
            iterativeParseContext.id,
        );

        removeIdFromIdsByNodeKind(nodeIdMapCollection.idsByNodeKind, Ast.NodeKind.Constant, operatorConstant.id);
        removeIdFromIdsByNodeKind(nodeIdMapCollection.idsByNodeKind, operand.kind, operand.id);

        // eslint-disable-next-line require-atomic-updates
        state.currentContextNode = initialCurrentContextNode;
        nextRead = NextOperatorAndOperandReadByTokenKind.get(state.currentTokenKind);
    }

    Assert.isTrue(
        state.currentContextNode?.id === initialCurrentContextNode.id,
        `state.currentContextNode.id === initialCurrentContextNode failed`,
        {
            currentContextNodeId: state.currentContextNode?.id,
            initialCurrentContextNodeId: initialCurrentContextNode.id,
        },
    );

    Assert.isTrue(
        operatorConstants.length + 1 === operands.length,
        `operatorConstants.length + 1 === operands.length failed`,
        {
            operatorsLength: operatorConstants.length,
            operandsLength: operands.length,
        },
    );

    trace.exit();

    return {
        operatorConstants,
        operands,
    };
}

interface NextOperatorAndOperandRead {
    readonly binOpExpressionNodeKind: Ast.NodeKind;
    readonly operandNodeKind:
        | Ast.NodeKind.UnaryExpression
        | Ast.NodeKind.NullablePrimitiveType
        | Ast.NodeKind.LogicalExpression;
    readonly operatorTokenKind: Token.TokenKind;
    readonly operatorConstantKind: Constant.TBinOpExpressionOperator;
}

const NextOperatorAndOperandReadByTokenKind: ReadonlyMap<Token.TokenKind | undefined, NextOperatorAndOperandRead> =
    new Map<Token.TokenKind | undefined, NextOperatorAndOperandRead>([
        [
            Token.TokenKind.Asterisk,
            {
                binOpExpressionNodeKind: Ast.NodeKind.ArithmeticExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.ArithmeticOperator.Multiplication,
                operatorTokenKind: Token.TokenKind.Asterisk,
            },
        ],
        [
            Token.TokenKind.Division,
            {
                binOpExpressionNodeKind: Ast.NodeKind.ArithmeticExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.ArithmeticOperator.Division,
                operatorTokenKind: Token.TokenKind.Division,
            },
        ],
        [
            Token.TokenKind.Plus,
            {
                binOpExpressionNodeKind: Ast.NodeKind.ArithmeticExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.ArithmeticOperator.Addition,
                operatorTokenKind: Token.TokenKind.Plus,
            },
        ],
        [
            Token.TokenKind.Minus,
            {
                binOpExpressionNodeKind: Ast.NodeKind.ArithmeticExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.ArithmeticOperator.Subtraction,
                operatorTokenKind: Token.TokenKind.Minus,
            },
        ],
        [
            Token.TokenKind.Ampersand,
            {
                binOpExpressionNodeKind: Ast.NodeKind.ArithmeticExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.ArithmeticOperator.And,
                operatorTokenKind: Token.TokenKind.Ampersand,
            },
        ],
        [
            Token.TokenKind.Equal,
            {
                binOpExpressionNodeKind: Ast.NodeKind.EqualityExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.EqualityOperator.EqualTo,
                operatorTokenKind: Token.TokenKind.Equal,
            },
        ],
        [
            Token.TokenKind.NotEqual,
            {
                binOpExpressionNodeKind: Ast.NodeKind.EqualityExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.EqualityOperator.NotEqualTo,
                operatorTokenKind: Token.TokenKind.NotEqual,
            },
        ],
        [
            Token.TokenKind.KeywordAnd,
            {
                binOpExpressionNodeKind: Ast.NodeKind.LogicalExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.LogicalOperator.And,
                operatorTokenKind: Token.TokenKind.KeywordAnd,
            },
        ],
        [
            Token.TokenKind.KeywordOr,
            {
                binOpExpressionNodeKind: Ast.NodeKind.LogicalExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.LogicalOperator.Or,
                operatorTokenKind: Token.TokenKind.KeywordOr,
            },
        ],
        [
            Token.TokenKind.LessThan,
            {
                binOpExpressionNodeKind: Ast.NodeKind.RelationalExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.RelationalOperator.LessThan,
                operatorTokenKind: Token.TokenKind.LessThan,
            },
        ],
        [
            Token.TokenKind.LessThanEqualTo,
            {
                binOpExpressionNodeKind: Ast.NodeKind.RelationalExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.RelationalOperator.LessThanEqualTo,
                operatorTokenKind: Token.TokenKind.LessThanEqualTo,
            },
        ],
        [
            Token.TokenKind.GreaterThan,
            {
                binOpExpressionNodeKind: Ast.NodeKind.RelationalExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.RelationalOperator.GreaterThan,
                operatorTokenKind: Token.TokenKind.GreaterThan,
            },
        ],
        [
            Token.TokenKind.GreaterThanEqualTo,
            {
                binOpExpressionNodeKind: Ast.NodeKind.RelationalExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.RelationalOperator.GreaterThanEqualTo,
                operatorTokenKind: Token.TokenKind.GreaterThanEqualTo,
            },
        ],
        [
            Token.TokenKind.KeywordAs,
            {
                binOpExpressionNodeKind: Ast.NodeKind.AsExpression,
                operandNodeKind: Ast.NodeKind.NullablePrimitiveType,
                operatorConstantKind: Constant.KeywordConstant.As,
                operatorTokenKind: Token.TokenKind.KeywordAs,
            },
        ],
        [
            Token.TokenKind.KeywordIs,
            {
                binOpExpressionNodeKind: Ast.NodeKind.IsExpression,
                operandNodeKind: Ast.NodeKind.NullablePrimitiveType,
                operatorConstantKind: Constant.KeywordConstant.Is,
                operatorTokenKind: Token.TokenKind.KeywordIs,
            },
        ],
        [
            Token.TokenKind.KeywordMeta,
            {
                binOpExpressionNodeKind: Ast.NodeKind.MetadataExpression,
                operandNodeKind: Ast.NodeKind.UnaryExpression,
                operatorConstantKind: Constant.KeywordConstant.Meta,
                operatorTokenKind: Token.TokenKind.KeywordMeta,
            },
        ],
        [
            Token.TokenKind.NullCoalescingOperator,
            {
                binOpExpressionNodeKind: Ast.NodeKind.NullCoalescingExpression,
                operandNodeKind: Ast.NodeKind.LogicalExpression,
                operatorConstantKind: Constant.MiscConstant.NullCoalescingOperator,
                operatorTokenKind: Token.TokenKind.NullCoalescingOperator,
            },
        ],
    ]);

function removeIdFromIdsByNodeKind(idsByNodeKind: IdsByNodeKind, nodeKind: Ast.NodeKind, nodeId: number): void {
    const collection: Set<number> = MapUtils.assertGet(idsByNodeKind, nodeKind);
    SetUtils.assertDelete(collection, nodeId);

    if (collection.size === 0) {
        idsByNodeKind.delete(nodeKind);
    }
}
