// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from ".";
import { Option } from "./option";

export function isNever(_: never): never {
    throw new CommonError.InvariantError("should never be reached");
}

export function isSome<T>(option: Option<T>, variableName: string, maybeDetails: Option<any> = undefined): T {
    if (option === undefined) {
        const details: {} = maybeDetails === undefined ? { variableName } : { ...maybeDetails, variableName };
        throw new CommonError.InvariantError(`expected Option to be Some`, details);
    }

    return option;
}
