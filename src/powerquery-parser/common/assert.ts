// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from ".";

export function asDefined<T>(value: T | undefined, message?: string, details?: object): NonNullable<T> {
    isDefined(value, message, details);

    return value;
}

export function asInstanceofError<T>(value: T): Error {
    isInstanceofError(value);

    return value;
}

export function isTrue(value: boolean, message?: string, details?: object): asserts value is true {
    if (value !== true) {
        throw new CommonError.InvariantError(message ?? `assert failed, expected value to be true`, details);
    }
}

export function isFalse(value: boolean, message?: string, details?: object): asserts value is false {
    if (value !== false) {
        throw new CommonError.InvariantError(message ?? `assert failed, expected value to be false`, details);
    }
}

export function isNever(_: never): never {
    throw new CommonError.InvariantError(`Should never be reached. Stack trace: ${new Error().stack}`);
}

export function isInstanceofError<T>(value: T | Error): asserts value is Error {
    if (!(value instanceof Error)) {
        throw new CommonError.InvariantError(`Expected value to be instanceof Error`, {
            typeof: typeof value,
            value,
        });
    }
}

export function isDefined<T>(
    value: T | undefined,
    message?: string,
    details?: object,
): asserts value is NonNullable<T> {
    if (value === undefined) {
        throw new CommonError.InvariantError(message ?? `assert failed, expected value to be defined`, details);
    }
}

export function isUndefined<T>(value: T | undefined, message?: string, details?: object): asserts value is undefined {
    if (value !== undefined) {
        throw new CommonError.InvariantError(message ?? `assert failed, expected value to be undefined`, details);
    }
}

export function shouldNeverBeReachedTypescript(): CommonError.InvariantError {
    return new CommonError.InvariantError(`this should never be reached but TypeScript can't tell that`);
}
