// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError } from "..";
import { ErrorResult, OkResult, Result, ResultKind } from "./result";

export function assertIsOk<T, E>(result: Result<T, E>): asserts result is OkResult<T> {
    if (!isOk(result)) {
        throw new CommonError.InvariantError(`assert failed, result expected to be an Ok`, {
            error: result.error,
        });
    }
}

export function assertIsError<T, E>(result: Result<T, E>): asserts result is ErrorResult<E> {
    if (!isError(result)) {
        throw new CommonError.InvariantError(`assert failed, result expected to be an Error`);
    }
}

export function assertOk<T, E>(result: Result<T, E>): T {
    assertIsOk(result);

    return result.value;
}

export function assertError<T, E>(result: Result<T, E>): E {
    assertIsError(result);

    return result.error;
}

export function ok<T>(value: T): OkResult<T> {
    return {
        kind: ResultKind.Ok,
        value,
    };
}

export function error<E>(error: E): ErrorResult<E> {
    return {
        kind: ResultKind.Error,
        error,
    };
}

export function ensureResult<T>(callback: () => T, locale: string): Result<T, CommonError.CommonError> {
    try {
        return ok(callback());
    } catch (caught: unknown) {
        Assert.isInstanceofError(caught);

        return error(CommonError.ensureCommonError(caught, locale));
    }
}

export async function ensureResultAsync<T>(
    callback: () => Promise<T>,
    locale: string,
): Promise<Result<T, CommonError.CommonError>> {
    try {
        return ok(await callback());
    } catch (caught: unknown) {
        Assert.isInstanceofError(caught);

        return error(CommonError.ensureCommonError(caught, locale));
    }
}

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
    return result.kind === ResultKind.Ok;
}

export function isError<T, E>(result: Result<T, E>): result is ErrorResult<E> {
    return result.kind === ResultKind.Error;
}

export function okOrDefault<T, E>(result: Result<T, E>, defaultValue: T): T {
    return isOk(result) ? result.value : defaultValue;
}
