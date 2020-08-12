// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { TXorNode, XorNodeKind, XorNodeUtils } from "../../../parser";
import { Type, TypeUtils } from "../../../type";

export function inspectTypeConstant(xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.Constant);

    if (xorNode.kind === XorNodeKind.Context) {
        return Type.UnknownInstance;
    }

    const constant: Ast.TConstant = xorNode.node as Ast.TConstant;
    switch (constant.constantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Action, false);

        case Ast.PrimitiveTypeConstantKind.Any:
            return Type.AnyInstance;

        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.AnyNonNull, false);

        case Ast.PrimitiveTypeConstantKind.Binary:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Binary, false);

        case Ast.PrimitiveTypeConstantKind.Date:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Date, false);

        case Ast.PrimitiveTypeConstantKind.DateTime:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.DateTime, false);

        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.DateTimeZone, false);

        case Ast.PrimitiveTypeConstantKind.Duration:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Duration, false);

        case Ast.PrimitiveTypeConstantKind.Function:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Function, false);

        case Ast.PrimitiveTypeConstantKind.List:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.List, false);

        case Ast.PrimitiveTypeConstantKind.Logical:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Logical, false);

        case Ast.PrimitiveTypeConstantKind.None:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.None, false);

        case Ast.PrimitiveTypeConstantKind.Null:
            return Type.NoneInstance;

        case Ast.PrimitiveTypeConstantKind.Number:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Number, false);

        case Ast.PrimitiveTypeConstantKind.Record:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false);

        case Ast.PrimitiveTypeConstantKind.Table:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Table, false);

        case Ast.PrimitiveTypeConstantKind.Text:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Text, false);

        case Ast.PrimitiveTypeConstantKind.Time:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Time, false);

        case Ast.PrimitiveTypeConstantKind.Type:
            return TypeUtils.primitiveTypeFactory(Type.TypeKind.Type, false);

        default:
            return Type.UnknownInstance;
    }
}
