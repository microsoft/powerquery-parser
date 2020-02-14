// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever } from "../../common";
import { Ast } from "../../parser";
import { ExtendedTypeKind } from "./types";

export function extendedTypeKindFrom(literalKind: Ast.LiteralKind): ExtendedTypeKind {
    switch (literalKind) {
        case Ast.LiteralKind.List:
            return ExtendedTypeKind.List;

        case Ast.LiteralKind.Logical:
            return ExtendedTypeKind.Logical;

        case Ast.LiteralKind.Null:
            return ExtendedTypeKind.Null;

        case Ast.LiteralKind.Numeric:
            return ExtendedTypeKind.Numeric;

        case Ast.LiteralKind.Record:
            return ExtendedTypeKind.Record;

        case Ast.LiteralKind.Str:
            return ExtendedTypeKind.Str;

        default:
            throw isNever(literalKind);
    }
}
