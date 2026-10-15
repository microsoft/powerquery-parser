// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { Constant } from "../../constant";

// Syntax-only output of AstUtils simplification, converted by TypeUtils into parameter type metadata.
// Expressions requiring scope or library resolution return no SimplifiedType; PQLS resolves them instead.
export interface SimplifiedType {
    readonly isNullable: boolean;
    readonly primitiveTypeConstantKind: Constant.PrimitiveTypeConstant;
}
