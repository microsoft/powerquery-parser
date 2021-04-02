// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "..";
import { ErrorResult, OkResult, Result, ResultKind } from "./result";

export function createOk<T>(value: T): OkResult<T> {
    return {
        kind: ResultKind.Ok,
        value,
    };
}

export function createError<E>(error: E): ErrorResult<E> {
    return {
        kind: ResultKind.Error,
        error,
    };
}

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
    return result.kind === ResultKind.Ok;
}

export function isError<T, E>(result: Result<T, E>): result is ErrorResult<E> {
    return result.kind === ResultKind.Error;
}

export function ensureResult<T>(locale: string, callbackFn: () => T): Result<T, CommonError.CommonError> {
    try {
        return createOk(callbackFn());
    } catch (err) {
        return createError(CommonError.ensureCommonError(locale, err));
    }
}
