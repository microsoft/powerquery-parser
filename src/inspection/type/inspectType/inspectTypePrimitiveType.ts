// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";

export function inspectTypePrimitiveType(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.PrimitiveType);

    if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const kind: Type.TypeKind = TypeUtils.typeKindFromPrimitiveTypeConstantKind(
        (xorNode.node as Ast.PrimitiveType).primitiveType.constantKind,
    );
    return {
        kind,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}
