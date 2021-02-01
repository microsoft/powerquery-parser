// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Ast, Type, TypeUtils } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";

export function inspectTypeLiteralExpression(
    xorNode: TXorNode,
): Type.TPrimitiveType | Type.TextLiteral | Type.NumberLiteral {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.LiteralExpression);

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalExpression: Ast.LiteralExpression = xorNode.node as Ast.LiteralExpression;
            const typeKind: Type.TypeKind = TypeUtils.typeKindFromLiteralKind(literalExpression.literalKind);

            switch (typeKind) {
                case Type.TypeKind.Number:
                    return TypeUtils.numberLiteralFactory(false, literalExpression.literal);

                case Type.TypeKind.Text:
                    return TypeUtils.textLiteralFactory(false, literalExpression.literal);

                default:
                    return TypeUtils.primitiveTypeFactory(
                        literalExpression.literalKind === Ast.LiteralKind.Null,
                        typeKind,
                    );
            }

        case XorNodeKind.Context:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(xorNode);
    }
}
