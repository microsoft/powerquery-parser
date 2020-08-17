// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { TXorNode, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";
import { TypeInspectionState } from "../type";
import { inspectFromChildAttributeIndex } from "./common";

export function inspectRangeExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.RangeExpression);

    const maybeLeftType: Type.TType | undefined = inspectFromChildAttributeIndex(state, xorNode, 0);
    const maybeRightType: Type.TType | undefined = inspectFromChildAttributeIndex(state, xorNode, 2);

    if (maybeLeftType === undefined || maybeRightType === undefined) {
        return Type.UnknownInstance;
    } else if (maybeLeftType.kind === Type.TypeKind.Number && maybeRightType.kind === Type.TypeKind.Number) {
        // TODO: handle isNullable better
        if (maybeLeftType.isNullable === true || maybeRightType.isNullable === true) {
            return Type.NoneInstance;
        } else {
            return TypeUtils.primitiveTypeFactory(maybeLeftType.kind, maybeLeftType.isNullable);
        }
    } else if (maybeLeftType.kind === Type.TypeKind.None || maybeRightType.kind === Type.TypeKind.None) {
        return Type.NoneInstance;
    } else if (maybeLeftType.kind === Type.TypeKind.Unknown || maybeRightType.kind === Type.TypeKind.Unknown) {
        return Type.UnknownInstance;
    } else {
        return Type.NoneInstance;
    }
}
