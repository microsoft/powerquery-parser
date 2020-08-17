// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";
import { TypeInspectionState } from "../type";
import { inspectFromChildAttributeIndex } from "./common";

export function inspectNullCoalescingExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.NullCoalescingExpression);

    const maybeLeftType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 0);
    const maybeNullCoalescingOperator:
        | Ast.TNode
        | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 1, [
        Ast.NodeKind.Constant,
    ]);
    // '??' isn't present, treat it as an Expression.
    if (maybeNullCoalescingOperator === undefined) {
        return maybeLeftType;
    }

    const maybeRightType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 2);
    if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
        return Type.NoneInstance;
    }

    return TypeUtils.anyUnionFactory([maybeLeftType, maybeRightType]);
}
