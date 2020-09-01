// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, Constant, Type, TypeUtils } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";

export function inspectTypeLiteralExpression(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.LiteralExpression);

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalKind: Constant.LiteralKind = (xorNode.node as Ast.LiteralExpression).literalKind;
            const typeKind: Type.TypeKind = TypeUtils.typeKindFromLiteralKind(literalKind);
            return TypeUtils.primitiveTypeFactory(literalKind === Constant.LiteralKind.Null, typeKind);

        case XorNodeKind.Context:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(xorNode);
    }
}
