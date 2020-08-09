// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";
import { inspectFromChildAttributeIndex, inspectXorNode, TypeInspectionState } from "./common";

export function inspectErrorHandlingExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.ErrorHandlingExpression);

    const maybeOtherwiseExpression:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 2, [
        Ast.NodeKind.OtherwiseExpression,
    ]);

    return TypeUtils.anyUnionFactory([
        inspectFromChildAttributeIndex(state, xorNode, 1),
        maybeOtherwiseExpression !== undefined
            ? inspectXorNode(state, maybeOtherwiseExpression)
            : TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
    ]);
}
