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

// Asserts that N operators and N+1 operands are read and returned.
// Both operators and operands are read in a left-to-right fashion and are returned in that order.
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
    // While a valid operator constant exists, read a binary operator and an operand.
    // The exact operand reader is determined by the binary operator.
    const operands: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [
        await parser.readUnaryExpression(state, parser, trace.id),
    ];

    let nextDuoRead: NextDuoTrio | undefined = NextDuoReadByTokenKind.get(state.currentTokenKind);

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

        // It's possible that the reading of the operand to fail. In that case you'll see the following:
        //  - a binary expression context under the initial context node
        //  - it will have 2 children
        //      - an Ast node for the operatorConstant
        //      - a parse context node for the operand
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
                throw Assert.isNever(nextDuoRead.duoReadKind);
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
        nextDuoRead = NextDuoReadByTokenKind.get(state.currentTokenKind);
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

interface NextDuoTrio {
    readonly duoReadKind:
        | Ast.NodeKind.UnaryExpression
        | Ast.NodeKind.NullablePrimitiveType
        | Ast.NodeKind.LogicalExpression;
    readonly nodeKind: Ast.NodeKind;
    readonly operatorTokenKind: Token.TokenKind;
    readonly operatorConstantKind: Constant.TBinOpExpressionOperator;
}

const NextDuoReadByTokenKind: ReadonlyMap<Token.TokenKind | undefined, NextDuoTrio> = new Map<
    Token.TokenKind | undefined,
    NextDuoTrio
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

function removeIdFromIdsByNodeKind(idsByNodeKind: IdsByNodeKind, nodeKind: Ast.NodeKind, nodeId: number): void {
    const collection: Set<number> = MapUtils.assertGet(idsByNodeKind, nodeKind);
    SetUtils.assertDelete(collection, nodeId);

    if (collection.size === 0) {
        idsByNodeKind.delete(nodeKind);
    }
}
