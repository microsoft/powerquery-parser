// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TypeCache } from "./typeCache";

// A cache that can be re-used for successive calls under the same document.
export function createTypeCache(): TypeCache {
    return {
        scopeById: new Map(),
        typeById: new Map(),
    };
}
