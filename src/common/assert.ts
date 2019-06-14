// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from ".";

export function isNever(_: never): never {
    throw new CommonError.InvariantError("should never be reached");
}
