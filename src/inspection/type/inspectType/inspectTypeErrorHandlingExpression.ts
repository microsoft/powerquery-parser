// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { inspectTypeFromChildAttributeIndex, InspectTypeState, inspectXorNode } from "./common";

export function inspectTypeErrorHandlingExpression(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.ErrorHandlingExpression);

    const maybeOtherwiseExpression:
        | TXorNode
        | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 2, [
        Ast.NodeKind.OtherwiseExpression,
    ]);

    return TypeUtils.anyUnionFactory([
        inspectTypeFromChildAttributeIndex(state, xorNode, 1),
        maybeOtherwiseExpression !== undefined
            ? inspectXorNode(state, maybeOtherwiseExpression)
            : TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
    ]);
}
