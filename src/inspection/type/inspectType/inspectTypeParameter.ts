// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { inspectTypeFromChildAttributeIndex, TypeInspectionState } from "./common";

export function inspectTypeParameter(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.Parameter);

    const maybeOptionalConstant:
        | Ast.TNode
        | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(state.nodeIdMapCollection, xorNode.node.id, 0, [
        Ast.NodeKind.Constant,
    ]);

    const maybeParameterType: Type.TType | undefined = inspectTypeFromChildAttributeIndex(state, xorNode, 2);

    return {
        ...maybeParameterType,
        isNullable: maybeOptionalConstant !== undefined || maybeParameterType.isNullable,
    };
}
