// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Type } from "../../../language";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXor } from "./common";

export function inspectTypeUnaryExpression(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.UnaryExpression);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const maybeOperatorsWrapper:
        | undefined
        | TXorNode = NodeIdMapUtils.maybeChildXorByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 0, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeOperatorsWrapper === undefined) {
        return Type.UnknownInstance;
    }

    const maybeExpression: TXorNode | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(
        nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeExpression === undefined) {
        return Type.UnknownInstance;
    }

    // Only certain operators are allowed depending on the type.
    // Unlike BinOpExpression, it's easier to implement the check without a lookup table.
    let expectedUnaryOperatorKinds: ReadonlyArray<Constant.UnaryOperatorKind>;
    const expressionType: Type.TType = inspectXor(state, maybeExpression);
    if (expressionType.kind === Type.TypeKind.Number) {
        expectedUnaryOperatorKinds = [Constant.UnaryOperatorKind.Positive, Constant.UnaryOperatorKind.Negative];
    } else if (expressionType.kind === Type.TypeKind.Logical) {
        expectedUnaryOperatorKinds = [Constant.UnaryOperatorKind.Not];
    } else {
        return Type.NoneInstance;
    }

    const operators: ReadonlyArray<Ast.IConstant<Constant.UnaryOperatorKind>> = NodeIdMapIterator.maybeIterChildrenAst(
        nodeIdMapCollection,
        maybeOperatorsWrapper.node.id,
    ) as ReadonlyArray<Ast.IConstant<Constant.UnaryOperatorKind>>;
    for (const operator of operators) {
        if (expectedUnaryOperatorKinds.indexOf(operator.constantKind) === -1) {
            return Type.NoneInstance;
        }
    }

    return expressionType;
}
