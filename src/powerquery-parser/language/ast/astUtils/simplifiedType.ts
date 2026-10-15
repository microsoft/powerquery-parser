// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Ast } from "..";
import type { Constant } from "../../constant";

// Syntax-only output of AstUtils simplification, converted by TypeUtils into parameter type metadata.
// Unresolved results retain the complete type expression for semantic inspection in PQLS.
export type SimplifiedType = ResolvedType | UnresolvedType;

export enum SimplifiedTypeKind {
    Resolved = "Resolved",
    Unresolved = "Unresolved",
}

// Syntax-derived AstUtils metadata that TypeUtils converts into FunctionParameter fields without PQLS resolution.
export interface ResolvedType {
    readonly kind: SimplifiedTypeKind.Resolved;
    readonly isNullable: boolean;
    readonly primitiveTypeConstantKind: Constant.PrimitiveTypeConstant;
}

// Preserves wrappers such as nullable so PQLS can resolve the original expression without losing meaning.
export interface UnresolvedType {
    readonly kind: SimplifiedTypeKind.Unresolved;
    readonly node: Ast.TType;
}
