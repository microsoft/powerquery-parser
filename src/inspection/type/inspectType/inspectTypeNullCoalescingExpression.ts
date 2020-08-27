// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { inspectTypeFromChildAttributeIndex, InspectTypeState } from "./common";

export function inspectTypeNullCoalescingExpression(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.NullCoalescingExpression);

    const maybeLeftType: Type.TType = inspectTypeFromChildAttributeIndex(state, xorNode, 0);
    const maybeNullCoalescingOperator:
        | Ast.TNode
        | undefined = NodeIdMapUtils.maybeChildAstByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 1, [
        Ast.NodeKind.Constant,
    ]);
    // '??' isn't present, treat it as an Expression.
    if (maybeNullCoalescingOperator === undefined) {
        return maybeLeftType;
    }

    const maybeRightType: Type.TType = inspectTypeFromChildAttributeIndex(state, xorNode, 2);
    if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
        return Type.NoneInstance;
    }

    return TypeUtils.anyUnionFactory([maybeLeftType, maybeRightType]);
}
