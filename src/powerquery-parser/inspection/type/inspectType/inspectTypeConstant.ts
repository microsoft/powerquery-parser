// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Type, TypeUtils } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";

export function inspectTypeConstant(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.Constant);

    if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const constant: Ast.TConstant = xorNode.node as Ast.TConstant;
    switch (constant.constantKind) {
        case Constant.PrimitiveTypeConstantKind.Action:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Action);

        case Constant.PrimitiveTypeConstantKind.Any:
            return Type.AnyInstance;

        case Constant.PrimitiveTypeConstantKind.AnyNonNull:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.AnyNonNull);

        case Constant.PrimitiveTypeConstantKind.Binary:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Binary);

        case Constant.PrimitiveTypeConstantKind.Date:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Date);

        case Constant.PrimitiveTypeConstantKind.DateTime:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.DateTime);

        case Constant.PrimitiveTypeConstantKind.DateTimeZone:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.DateTimeZone);

        case Constant.PrimitiveTypeConstantKind.Duration:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Duration);

        case Constant.PrimitiveTypeConstantKind.Function:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Function);

        case Constant.PrimitiveTypeConstantKind.List:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.List);

        case Constant.PrimitiveTypeConstantKind.Logical:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Logical);

        case Constant.PrimitiveTypeConstantKind.None:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.None);

        case Constant.PrimitiveTypeConstantKind.Null:
            return Type.NoneInstance;

        case Constant.PrimitiveTypeConstantKind.Number:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Number);

        case Constant.PrimitiveTypeConstantKind.Record:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Record);

        case Constant.PrimitiveTypeConstantKind.Table:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Table);

        case Constant.PrimitiveTypeConstantKind.Text:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Text);

        case Constant.PrimitiveTypeConstantKind.Time:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Time);

        case Constant.PrimitiveTypeConstantKind.Type:
            return TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Type);

        default:
            return Type.UnknownInstance;
    }
}
