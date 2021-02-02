// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, Constant, Type, TypeUtils } from "../../../language";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeUnaryExpression(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.UnaryExpression);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const maybeUnaryOperatorWrapper:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 0, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeUnaryOperatorWrapper === undefined) {
        return Type.UnknownInstance;
    }
    const unaryOperatorWrapper: TXorNode | undefined = maybeUnaryOperatorWrapper;

    const maybeExpression: TXorNode | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeExpression === undefined) {
        return Type.UnknownInstance;
    }
    const expression: TXorNode = maybeExpression;

    const expressionType: Type.TType = inspectXor(state, expression);
    if (expressionType.kind === Type.TypeKind.Number) {
        return inspectTypeUnaryNumber(state, expressionType, unaryOperatorWrapper.node.id);
    } else if (expressionType.kind === Type.TypeKind.Logical) {
        return inspectTypeUnaryLogical(state, expressionType, unaryOperatorWrapper.node.id);
    } else {
        return Type.NoneInstance;
    }
}

type NumberUnaryNodeOperator = Ast.IConstant<Constant.UnaryOperatorKind.Negative | Constant.UnaryOperatorKind.Positive>;
type LogicalUnaryNodeOperator = Ast.IConstant<Constant.UnaryOperatorKind.Not>;

function inspectTypeUnaryNumber(
    state: InspectTypeState,
    unaryExpressionType: Type.TNumber,
    unaryOperatorWrapperId: number,
): Type.TNumber | Type.None {
    const unaryNodeOperators: ReadonlyArray<NumberUnaryNodeOperator> = Assert.asDefined(
        NodeIdMapIterator.maybeIterChildrenAst(state.nodeIdMapCollection, unaryOperatorWrapperId),
    ) as ReadonlyArray<NumberUnaryNodeOperator>;

    const expectedUnaryOperatorKinds: ReadonlyArray<Constant.UnaryOperatorKind> = [
        Constant.UnaryOperatorKind.Positive,
        Constant.UnaryOperatorKind.Negative,
    ];
    const unaryOperators: (Constant.UnaryOperatorKind.Negative | Constant.UnaryOperatorKind.Positive)[] = [];
    let isPositive: boolean = true;

    for (const operator of unaryNodeOperators) {
        if (expectedUnaryOperatorKinds.indexOf(operator.constantKind) === -1) {
            return Type.NoneInstance;
        }

        unaryOperators.push(operator.constantKind);
        if (operator.constantKind === Constant.UnaryOperatorKind.Negative) {
            isPositive = !isPositive;
        }
    }

    switch (unaryExpressionType.maybeExtendedKind) {
        case Type.ExtendedTypeKind.NumberLiteral:
            return TypeUtils.numberLiteralFactory(
                unaryExpressionType.isNullable,
                [...unaryOperators, unaryExpressionType.literal].join(""),
            );

        case undefined:
            return unaryExpressionType;

        default:
            throw Assert.isNever(unaryExpressionType);
    }
}

function inspectTypeUnaryLogical(
    state: InspectTypeState,
    unaryExpressionType: Type.Logical,
    unaryOperatorWrapperId: number,
): Type.Logical | Type.None {
    const unaryNodeOperators: ReadonlyArray<LogicalUnaryNodeOperator> = Assert.asDefined(
        NodeIdMapIterator.maybeIterChildrenAst(state.nodeIdMapCollection, unaryOperatorWrapperId),
    ) as ReadonlyArray<LogicalUnaryNodeOperator>;

    for (const operator of unaryNodeOperators) {
        if (operator.constantKind !== Constant.UnaryOperatorKind.Not) {
            return Type.NoneInstance;
        }
    }

    return unaryExpressionType;
}
