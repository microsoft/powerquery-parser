// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Ast, Type } from "../..";
import type { XorNode } from "../../../parser";

// Output of TypeUtils.inspectParameter: syntax yields a FunctionParameter,
// or an annotation for PQLS to resolve before constructing a semantic function signature.
export type InspectedParameter = (Type.FunctionParameter & { readonly isTypeResolved: true }) | UnresolvedParameter;

// Retains the whole annotation for PQLS, including nullable wrappers and incomplete parse-context nodes.
// Unlike an unannotated FunctionParameter, this result does not assume a type or nullability.
export interface UnresolvedParameter {
    readonly isTypeResolved: false;
    readonly nameLiteral: string;
    readonly isOptional: boolean;
    readonly annotation: XorNode<Ast.AsType | Ast.AsNullablePrimitiveType>;
}
