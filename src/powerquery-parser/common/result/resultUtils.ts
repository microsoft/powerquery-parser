// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "..";
import { Error, Ok, Result, ResultKind } from "./result";

export function createOk<T>(value: T): Ok<T> {
    return {
        kind: ResultKind.Ok,
        value,
    };
}

export function createError<E>(error: E): Error<E> {
    return {
        kind: ResultKind.Error,
        error,
    };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.kind === ResultKind.Ok;
}

export function isError<T, E>(result: Result<T, E>): result is Error<E> {
    return result.kind === ResultKind.Error;
}

export function ensureResult<T>(locale: string, callbackFn: () => T): Result<T, CommonError.CommonError> {
    try {
        return createOk(callbackFn());
    } catch (err) {
        return createError(CommonError.ensureCommonError(locale, err));
    }
}
