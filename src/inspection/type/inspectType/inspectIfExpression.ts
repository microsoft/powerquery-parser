// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { TXorNode, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";
import { TypeInspectionState } from "../type";
import { allForAnyUnion, inspectFromChildAttributeIndex } from "./inspectType";

export function inspectIfExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.IfExpression);

    const conditionType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 1);
    if (conditionType.kind === Type.TypeKind.Unknown) {
        return Type.UnknownInstance;
    }
    // Any is allowed so long as AnyUnion only contains Any or Logical.
    else if (conditionType.kind === Type.TypeKind.Any) {
        if (
            conditionType.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion &&
            !allForAnyUnion(
                conditionType,
                (type: Type.TType) => type.kind === Type.TypeKind.Logical || type.kind === Type.TypeKind.Any,
            )
        ) {
            return Type.NoneInstance;
        }
    } else if (conditionType.kind !== Type.TypeKind.Logical) {
        return Type.NoneInstance;
    }

    const trueExprType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 3);
    const falseExprType: Type.TType = inspectFromChildAttributeIndex(state, xorNode, 5);

    return TypeUtils.anyUnionFactory([trueExprType, falseExprType]);
}
