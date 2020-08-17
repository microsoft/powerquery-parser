// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type, TypeUtils } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";

export function inspectTypeConstant(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.Constant);

    if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const constant: Ast.TConstant = xorNode.node as Ast.TConstant;
    switch (constant.constantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Action);

        case Ast.PrimitiveTypeConstantKind.Any:
            return Type.AnyInstance;

        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.AnyNonNull);

        case Ast.PrimitiveTypeConstantKind.Binary:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Binary);

        case Ast.PrimitiveTypeConstantKind.Date:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Date);

        case Ast.PrimitiveTypeConstantKind.DateTime:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.DateTime);

        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.DateTimeZone);

        case Ast.PrimitiveTypeConstantKind.Duration:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Duration);

        case Ast.PrimitiveTypeConstantKind.Function:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Function);

        case Ast.PrimitiveTypeConstantKind.List:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.List);

        case Ast.PrimitiveTypeConstantKind.Logical:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);

        case Ast.PrimitiveTypeConstantKind.None:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.None);

        case Ast.PrimitiveTypeConstantKind.Null:
            return Type.NoneInstance;

        case Ast.PrimitiveTypeConstantKind.Number:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);

        case Ast.PrimitiveTypeConstantKind.Record:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Record);

        case Ast.PrimitiveTypeConstantKind.Table:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Table);

        case Ast.PrimitiveTypeConstantKind.Text:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text);

        case Ast.PrimitiveTypeConstantKind.Time:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Time);

        case Ast.PrimitiveTypeConstantKind.Type:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Type);

        default:
            return Type.UnknownInstance;
    }
}
