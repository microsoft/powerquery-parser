// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type } from "../../../type";
import { TypeInspectionState } from "../type";
import { inspectXorNode } from "./common";

export function inspectInvokeExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.InvokeExpression);

    const previousSibling: TXorNode = NodeIdMapUtils.expectRecursiveExpressionPreviousSibling(
        state.nodeIdMapCollection,
        xorNode.node.id,
    );
    const previousSiblingType: Type.TType = inspectXorNode(state, previousSibling);
    if (previousSiblingType.kind === Type.TypeKind.Any) {
        return Type.AnyInstance;
    } else if (previousSiblingType.kind !== Type.TypeKind.Function) {
        return Type.NoneInstance;
    } else if (previousSiblingType.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) {
        return previousSiblingType.returnType;
    } else {
        return Type.AnyInstance;
    }
}
