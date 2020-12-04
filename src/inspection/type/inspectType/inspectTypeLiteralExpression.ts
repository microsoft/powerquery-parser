// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../powerquery-parser/common";
import { Ast, Type, TypeUtils } from "../../../powerquery-parser/language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../powerquery-parser/parser";

export function inspectTypeLiteralExpression(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.LiteralExpression);

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalKind: Ast.LiteralKind = (xorNode.node as Ast.LiteralExpression).literalKind;
            const typeKind: Type.TypeKind = TypeUtils.typeKindFromLiteralKind(literalKind);
            return TypeUtils.primitiveTypeFactory(literalKind === Ast.LiteralKind.Null, typeKind);

        case XorNodeKind.Context:
            return Type.UnknownInstance;

        default:
            throw Assert.isNever(xorNode);
    }
}
