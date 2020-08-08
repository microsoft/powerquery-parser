// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type } from "../../../type";
import { TypeInspectionState } from "../type";
import { inspectXorNode } from "./inspectType";

export function inspectUnaryExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.UnaryExpression);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const maybeOperatorsWrapper:
        | undefined
        | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 0, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeOperatorsWrapper === undefined) {
        return Type.UnknownInstance;
    }

    const maybeExpression: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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
    let expectedUnaryOperatorKinds: ReadonlyArray<Ast.UnaryOperatorKind>;
    const expressionType: Type.TType = inspectXorNode(state, maybeExpression);
    if (expressionType.kind === Type.TypeKind.Number) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Positive, Ast.UnaryOperatorKind.Negative];
    } else if (expressionType.kind === Type.TypeKind.Logical) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Not];
    } else {
        return Type.NoneInstance;
    }

    const operators: ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>> = NodeIdMapIterator.maybeAstChildren(
        nodeIdMapCollection,
        maybeOperatorsWrapper.node.id,
    ) as ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>>;
    for (const operator of operators) {
        if (expectedUnaryOperatorKinds.indexOf(operator.constantKind) === -1) {
            return Type.NoneInstance;
        }
    }

    return expressionType;
}
