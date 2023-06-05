// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Token } from "../../../language";
import { CombinatorialParserV2TraceConstant, OperatorsAndOperands } from "./commonTypes";
import { NodeIdMap, ParseContext } from "../..";
import { ParseState, ParseStateUtils } from "../../parseState";
import { Assert } from "../../../common";
import { NaiveParseSteps } from "..";
import { Parser } from "../../parser";
import { removeIdFromIdsByNodeKind } from "./utils";
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

    const operands: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [
        await parser.readUnaryExpression(state, parser, trace.id),
    ];

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
                throw Assert.isNever(nextDuoRead);
        }

        // Store the read operator and operands into our collection so we can later combine them.
        operatorConstants.push(operatorConstant);
        operands.push(operand);

        // If left the collection as-is then every operator/operand would be a child of the initial context node.
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

type TNextDuoRead = NextDuoReadLogicalExpression | NextDuoReadNullablePrimitiveType | NextDuoReadUnaryExpression;

type TSupportedTokenKinds =
    | Token.TokenKind.Asterisk
    | Token.TokenKind.Division
    | Token.TokenKind.Plus
    | Token.TokenKind.Minus
    | Token.TokenKind.Ampersand
    | Token.TokenKind.Equal
    | Token.TokenKind.NotEqual
    | Token.TokenKind.LessThan
    | Token.TokenKind.LessThanEqualTo
    | Token.TokenKind.GreaterThan
    | Token.TokenKind.GreaterThanEqualTo
    | Token.TokenKind.KeywordAnd
    | Token.TokenKind.KeywordOr
    | Token.TokenKind.KeywordAs
    | Token.TokenKind.KeywordIs
    | Token.TokenKind.KeywordMeta
    | Token.TokenKind.NullCoalescingOperator;

type NextDuoTrio<T extends TSupportedTokenKinds> = {
    readonly nodeKind: NodeKindByTokenKind[T];
    readonly operatorTokenKind: T;
    readonly operatorConstantKind: OperatorConstantKindByTokenKind[T];
};

type NextDuoReadLogicalExpression = {
    readonly duoReadKind: Ast.NodeKind.LogicalExpression;
} & NextDuoTrio<Token.TokenKind.NullCoalescingOperator>;

type NextDuoReadNullablePrimitiveType = {
    readonly duoReadKind: Ast.NodeKind.NullablePrimitiveType;
} & (NextDuoTrio<Token.TokenKind.KeywordAs> | NextDuoTrio<Token.TokenKind.KeywordIs>);

type NextDuoReadUnaryExpression = {
    readonly duoReadKind: Ast.NodeKind.UnaryExpression;
} & (
    | NextDuoTrio<Token.TokenKind.Asterisk>
    | NextDuoTrio<Token.TokenKind.Division>
    | NextDuoTrio<Token.TokenKind.Plus>
    | NextDuoTrio<Token.TokenKind.Minus>
    | NextDuoTrio<Token.TokenKind.Ampersand>
    | NextDuoTrio<Token.TokenKind.Equal>
    | NextDuoTrio<Token.TokenKind.NotEqual>
    | NextDuoTrio<Token.TokenKind.KeywordAnd>
    | NextDuoTrio<Token.TokenKind.KeywordOr>
    | NextDuoTrio<Token.TokenKind.LessThan>
    | NextDuoTrio<Token.TokenKind.LessThanEqualTo>
    | NextDuoTrio<Token.TokenKind.GreaterThan>
    | NextDuoTrio<Token.TokenKind.GreaterThanEqualTo>
    | NextDuoTrio<Token.TokenKind.KeywordAs>
    | NextDuoTrio<Token.TokenKind.KeywordIs>
    | NextDuoTrio<Token.TokenKind.KeywordMeta>
);

interface NodeKindByTokenKind {
    // ArithmeticExpression
    [Token.TokenKind.Asterisk]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Division]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Plus]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Minus]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Ampersand]: Ast.NodeKind.ArithmeticExpression;

    // EqualityExpression
    [Token.TokenKind.Equal]: Ast.NodeKind.EqualityExpression;
    [Token.TokenKind.NotEqual]: Ast.NodeKind.EqualityExpression;

    // RelationalExpression
    [Token.TokenKind.LessThan]: Ast.NodeKind.RelationalExpression;
    [Token.TokenKind.LessThanEqualTo]: Ast.NodeKind.RelationalExpression;
    [Token.TokenKind.GreaterThan]: Ast.NodeKind.RelationalExpression;
    [Token.TokenKind.GreaterThanEqualTo]: Ast.NodeKind.RelationalExpression;

    // LogicalExpression
    [Token.TokenKind.KeywordAnd]: Ast.NodeKind.LogicalExpression;
    [Token.TokenKind.KeywordOr]: Ast.NodeKind.LogicalExpression;

    // KeywordConstant
    [Token.TokenKind.KeywordAs]: Ast.NodeKind.AsExpression;
    [Token.TokenKind.KeywordIs]: Ast.NodeKind.IsExpression;
    [Token.TokenKind.KeywordMeta]: Ast.NodeKind.MetadataExpression;

    // MiscConstant
    [Token.TokenKind.NullCoalescingOperator]: Ast.NodeKind.NullCoalescingExpression;
}

interface OperatorConstantKindByTokenKind {
    // ArithmeticExpression
    [Token.TokenKind.Asterisk]: Constant.ArithmeticOperator.Multiplication;
    [Token.TokenKind.Division]: Constant.ArithmeticOperator.Division;
    [Token.TokenKind.Plus]: Constant.ArithmeticOperator.Addition;
    [Token.TokenKind.Minus]: Constant.ArithmeticOperator.Subtraction;
    [Token.TokenKind.Ampersand]: Constant.ArithmeticOperator.And;

    // EqualityExpression
    [Token.TokenKind.Equal]: Constant.EqualityOperator.EqualTo;
    [Token.TokenKind.NotEqual]: Constant.EqualityOperator.NotEqualTo;

    // RelationalExpression
    [Token.TokenKind.LessThan]: Constant.RelationalOperator.LessThan;
    [Token.TokenKind.LessThanEqualTo]: Constant.RelationalOperator.LessThanEqualTo;
    [Token.TokenKind.GreaterThan]: Constant.RelationalOperator.GreaterThan;
    [Token.TokenKind.GreaterThanEqualTo]: Constant.RelationalOperator.GreaterThanEqualTo;

    // LogicalExpression
    [Token.TokenKind.KeywordAnd]: Constant.LogicalOperator.And;
    [Token.TokenKind.KeywordOr]: Constant.LogicalOperator.Or;

    // KeywordConstant
    [Token.TokenKind.KeywordAs]: Constant.KeywordConstant.As;
    [Token.TokenKind.KeywordIs]: Constant.KeywordConstant.Is;
    [Token.TokenKind.KeywordMeta]: Constant.KeywordConstant.Meta;

    // MiscConstant
    [Token.TokenKind.NullCoalescingOperator]: Constant.MiscConstant.NullCoalescingOperator;
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
