// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from ".";
import { Err, Ok, Result, ResultUtils } from "./result";

export function isNever(_: never): never {
    throw new CommonError.InvariantError(`should never be reached`);
}

export function isDefined<T>(value: T | undefined): asserts value is NonNullable<T> {
    if (value === undefined) {
        throw new CommonError.InvariantError(`assert failed, expected value to be defined`);
    }
}

export function isUndefined<T>(value: T | undefined): asserts value is undefined {
    if (value !== undefined) {
        throw new CommonError.InvariantError(`assert failed, expected value to be undefined`);
    }
}

export function isOk<T, E>(result: Result<T, E>): asserts result is Ok<T> {
    if (!ResultUtils.isOk(result)) {
        const details: {} = { error: result.error };
        throw new CommonError.InvariantError(`assert failed, result expected to be an Ok`, details);
    }
}

export function isErr<T, E>(result: Result<T, E>): asserts result is Err<E> {
    if (!ResultUtils.isErr(result)) {
        throw new CommonError.InvariantError(`assert failed, result expected to be an Err`);
    }
}

export function shouldNeverBeReachedTypescript(): CommonError.InvariantError {
    return new CommonError.InvariantError(`this should never be reached but TypeScript can't tell that`);
}
