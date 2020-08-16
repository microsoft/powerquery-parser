// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "../../language";
import { ScopeById } from "../scope";

export type TypeById = Map<number, Type.TType>;

// A cache that can be re-used for successive calls under the same document.
export interface TypeCache {
    readonly scopeById: ScopeById;
    readonly typeById: TypeById;
}
