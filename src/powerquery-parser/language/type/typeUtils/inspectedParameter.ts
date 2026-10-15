// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Ast, Type } from "../..";
import type { XorNode } from "../../../parser";

export type InspectedParameter =
    | ResolvedParameter
    | ParameterRequiringResolution
    | NonTypeParameter
    | MissingNameParameter;

export enum InspectedParameterKind {
    Resolved = "Resolved",
    RequiresResolution = "RequiresResolution",
    NotType = "NotType",
    MissingName = "MissingName",
}

// FunctionParameter metadata usable by PQLS without semantic resolution of the annotation.
// Includes named, unannotated parameters with the existing unspecified-type and nullable defaults.
export interface ResolvedParameter extends Type.FunctionParameter {
    readonly kind: InspectedParameterKind.Resolved;
}

// Retains the whole annotation for PQLS without assuming its type or nullability.
// AST annotations need semantic inspection; context annotations need further parsing before resolution.
export interface ParameterRequiringResolution {
    readonly kind: InspectedParameterKind.RequiresResolution;
    readonly nameLiteral: string;
    readonly isOptional: boolean;
    readonly annotation: XorNode<Ast.AsType | Ast.AsNullablePrimitiveType>;
}

// Carries AstUtils' proven non-type expression directly to PQLS for diagnostics, without the outer AsType node.
// Nullable and parenthesized wrappers within the expression are preserved.
// Only complete annotations receive this outcome, even when the surrounding parameter or document is incomplete.
export interface NonTypeParameter {
    readonly kind: InspectedParameterKind.NotType;
    readonly nameLiteral: string;
    readonly isOptional: boolean;
    readonly node: Ast.TType;
}

// Signals that the parser context has no parameter name, so PQLS cannot yet construct FunctionParameter metadata.
export interface MissingNameParameter {
    readonly kind: InspectedParameterKind.MissingName;
}
