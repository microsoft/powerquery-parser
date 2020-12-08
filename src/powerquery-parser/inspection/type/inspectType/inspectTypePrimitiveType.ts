// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";

export function inspectTypePrimitiveType(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.PrimitiveType);

    if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const kind: Type.TypeKind = TypeUtils.typeKindFromPrimitiveTypeConstantKind(
        (xorNode.node as Ast.PrimitiveType).primitiveTypeKind,
    );
    return {
        kind,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}
