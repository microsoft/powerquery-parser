// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from ".";

export function isNever(_: never): never {
    throw new CommonError.InvariantError(`should never be reached`);
}

export function isSome<T>(option: T | undefined, variableName: string, maybeDetails: any | undefined = undefined): T {
    if (option === undefined) {
        const details: {} = maybeDetails === undefined ? { variableName } : { ...maybeDetails, variableName };
        throw new CommonError.InvariantError(`expected Option to be Some`, details);
    }

    return option;
}
