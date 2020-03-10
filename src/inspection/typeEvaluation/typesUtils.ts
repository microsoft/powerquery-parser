// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from ".";
import { isNever } from "../../common";
import { Ast } from "../../parser";

export function extendedTypeKindFrom(literalKind: Ast.LiteralKind): Type.TypeKind {
    switch (literalKind) {
        case Ast.LiteralKind.List:
            return Type.TypeKind.List;

        case Ast.LiteralKind.Logical:
            return Type.TypeKind.Logical;

        case Ast.LiteralKind.Null:
            return Type.TypeKind.Null;

        case Ast.LiteralKind.Numeric:
            return Type.TypeKind.Numeric;

        case Ast.LiteralKind.Record:
            return Type.TypeKind.Record;

        case Ast.LiteralKind.Str:
            return Type.TypeKind.Text;

        default:
            throw isNever(literalKind);
    }
}
