// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";

export function inspectTypeLiteralExpression(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.LiteralExpression);

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalKind: Ast.LiteralKind = (xorNode.node as Ast.LiteralExpression).literalKind;
            const typeKind: Type.TypeKind = TypeUtils.typeKindFromLiteralKind(literalKind);
            return TypeUtils.primitiveTypeFactory(typeKind, literalKind === Ast.LiteralKind.Null);

        case XorNodeKind.Context:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(xorNode);
    }
}
