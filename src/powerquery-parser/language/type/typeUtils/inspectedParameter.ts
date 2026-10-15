// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Ast, Type } from "../..";
import type { XorNode } from "../../../parser";

export type InspectedParameter = ResolvedParameter | UnresolvedParameter | MissingNameParameter;

export enum InspectedParameterKind {
    Resolved = "Resolved",
    Unresolved = "Unresolved",
    MissingName = "MissingName",
}

// Syntax-derived inspectParameter output that PQLS can use as FunctionParameter metadata without resolving an annotation.
export interface ResolvedParameter extends Type.FunctionParameter {
    readonly kind: InspectedParameterKind.Resolved;
}

// Retains the whole annotation for PQLS, including nullable wrappers and incomplete parse-context nodes.
// Unlike an unannotated FunctionParameter, this result does not assume a type or nullability.
export interface UnresolvedParameter {
    readonly kind: InspectedParameterKind.Unresolved;
    readonly nameLiteral: string;
    readonly isOptional: boolean;
    readonly annotation: XorNode<Ast.AsType | Ast.AsNullablePrimitiveType>;
}

// Signals that the parser context has no parameter name, so PQLS cannot yet construct FunctionParameter metadata.
export interface MissingNameParameter {
    readonly kind: InspectedParameterKind.MissingName;
}
