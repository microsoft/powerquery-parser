// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Ast } from "..";
import type { Constant } from "../../constant";

// Syntax inspection outcomes that TypeUtils maps to parameter metadata, resolution requests, or non-type diagnostics.
// Both non-resolved variants preserve the original expression and wrappers for PQLS.
export type SimplifiedType = ResolvedType | TypeRequiringResolution | NonTypeExpression;

export enum SimplifiedTypeKind {
    Resolved = "Resolved",
    RequiresResolution = "RequiresResolution",
    NotType = "NotType",
}

// Syntax-derived AstUtils metadata that TypeUtils converts into FunctionParameter fields without PQLS resolution.
// M: `type function (x as text) as any` -> simplifying the annotation's text node yields primitive kind Text.
export interface ResolvedType {
    readonly kind: SimplifiedTypeKind.Resolved;
    readonly isNullable: boolean;
    readonly primitiveTypeConstantKind: Constant.PrimitiveTypeConstant;
}

// PQP cannot determine whether this expression produces a type; PQLS must inspect it in its semantic context.
// The original node retains wrappers such as nullable, and resolution may still reveal a non-type value.
// M: `let T = type text in type function (x as T) as any` -> simplifying the annotation's T node needs scope resolution.
export interface TypeRequiringResolution {
    readonly kind: SimplifiedTypeKind.RequiresResolution;
    readonly node: Ast.TType;
}

// PQP can prove this expression cannot produce a type value; PQLS can diagnose it without resolving references.
// The original node retains wrappers so diagnostics can identify the complete annotation expression.
// M: `type function (x as 42) as any` -> simplifying the annotation's 42 node identifies a non-type value.
export interface NonTypeExpression {
    readonly kind: SimplifiedTypeKind.NotType;
    readonly node: Ast.TType;
}
