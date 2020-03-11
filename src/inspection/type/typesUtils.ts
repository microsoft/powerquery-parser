// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from ".";
import { isNever } from "../../common";
import { Ast } from "../../parser";

export function typeKindFromLiteralKind(
    literalKind: Exclude<Ast.LiteralKind, Ast.LiteralKind.Record>,
): Exclude<Type.TypeKind, Type.TCustomTypeKind> {
    switch (literalKind) {
        case Ast.LiteralKind.List:
            return Type.TypeKind.List;

        case Ast.LiteralKind.Logical:
            return Type.TypeKind.Logical;

        case Ast.LiteralKind.Null:
            return Type.TypeKind.Null;

        case Ast.LiteralKind.Numeric:
            return Type.TypeKind.Number;

        case Ast.LiteralKind.Text:
            return Type.TypeKind.Text;

        default:
            throw isNever(literalKind);
    }
}

export function typeKindFromPrimitiveTypeConstantKind(
    primitiveTypeConstantKind: Ast.PrimitiveTypeConstantKind,
): Type.TypeKind {
    switch (primitiveTypeConstantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return Type.TypeKind.Action;
        case Ast.PrimitiveTypeConstantKind.Any:
            return Type.TypeKind.Any;
        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return Type.TypeKind.AnyNonNull;
        case Ast.PrimitiveTypeConstantKind.Binary:
            return Type.TypeKind.Binary;
        case Ast.PrimitiveTypeConstantKind.Date:
            return Type.TypeKind.Date;
        case Ast.PrimitiveTypeConstantKind.DateTime:
            return Type.TypeKind.DateTime;
        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return Type.TypeKind.DateTimeZone;
        case Ast.PrimitiveTypeConstantKind.Duration:
            return Type.TypeKind.Duration;
        case Ast.PrimitiveTypeConstantKind.Function:
            return Type.TypeKind.Function;
        case Ast.PrimitiveTypeConstantKind.List:
            return Type.TypeKind.List;
        case Ast.PrimitiveTypeConstantKind.Logical:
            return Type.TypeKind.Logical;
        case Ast.PrimitiveTypeConstantKind.None:
            return Type.TypeKind.None;
        case Ast.PrimitiveTypeConstantKind.Null:
            return Type.TypeKind.Null;
        case Ast.PrimitiveTypeConstantKind.Number:
            return Type.TypeKind.Number;
        case Ast.PrimitiveTypeConstantKind.Record:
            return Type.TypeKind.Record;
        case Ast.PrimitiveTypeConstantKind.Table:
            return Type.TypeKind.Table;
        case Ast.PrimitiveTypeConstantKind.Text:
            return Type.TypeKind.Text;
        case Ast.PrimitiveTypeConstantKind.Time:
            return Type.TypeKind.Time;
        case Ast.PrimitiveTypeConstantKind.Type:
            return Type.TypeKind.Type;

        default:
            throw isNever(primitiveTypeConstantKind);
    }
}

export function simplifyNullablePrimitiveType(node: Ast.AsNullablePrimitiveType): Type.SimplifiedNullablePrimitiveType {
    let primitiveTypeConstantKind: Ast.PrimitiveTypeConstantKind;
    let isNullable: boolean;

    const nullablePrimitiveType: Ast.TNullablePrimitiveType = node.paired;
    switch (nullablePrimitiveType.kind) {
        case Ast.NodeKind.NullablePrimitiveType:
            primitiveTypeConstantKind = nullablePrimitiveType.paired.primitiveType.constantKind;
            isNullable = true;
            break;

        case Ast.NodeKind.PrimitiveType:
            primitiveTypeConstantKind = nullablePrimitiveType.primitiveType.constantKind;
            isNullable = false;
            break;

        default:
            throw isNever(nullablePrimitiveType);
    }

    return {
        pqType: typeKindFromPrimitiveTypeConstantKind(primitiveTypeConstantKind),
        isNullable,
    };
}
