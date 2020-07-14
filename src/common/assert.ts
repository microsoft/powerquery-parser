// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from ".";
import { Result, Ok, Err, ResultUtils } from "./result";

export function isTrue(value: boolean, maybeMessage?: string, maybeDetails?: {}): asserts value is true {
    if (value !== true) {
        throw new CommonError.InvariantError(
            maybeMessage ?? `assert failed, expected value to be defined`,
            maybeDetails,
        );
    }
}

export function isNever(_: never): never {
    throw new CommonError.InvariantError(`should never be reached`);
}

export function isDefined<T>(
    maybeValue: T | undefined,
    maybeMessage?: string,
    maybeDetails?: {},
): asserts maybeValue is NonNullable<T> {
    if (maybeValue === undefined) {
        throw new CommonError.InvariantError(
            maybeMessage ?? `assert failed, expected value to be defined`,
            maybeDetails,
        );
    }
}

export function isUndefined<T>(
    maybeValue: T | undefined,
    maybeMessage?: string,
    maybeDetails?: {},
): asserts maybeValue is undefined {
    if (maybeValue !== undefined) {
        throw new CommonError.InvariantError(
            maybeMessage ?? `assert failed, expected value to be defined`,
            maybeDetails,
        );
    }
}

export function isOk<T, E>(result: Result<T, E>): asserts result is Ok<T> {
    if (!ResultUtils.isOk(result)) {
        throw new CommonError.InvariantError(`assert failed, result expected to be an Ok`);
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
