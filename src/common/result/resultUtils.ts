// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "..";
import { Err, Ok, Result, ResultKind } from "./result";

export function okFactory<T>(value: T): Ok<T> {
    return {
        kind: ResultKind.Ok,
        value,
    };
}

export function errFactory<E>(error: E): Err<E> {
    return {
        kind: ResultKind.Err,
        error,
    };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.kind === ResultKind.Ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return result.kind === ResultKind.Err;
}

export function ensureResult<T>(locale: string, callbackFn: () => T): Result<T, CommonError.CommonError> {
    try {
        return okFactory(callbackFn());
    } catch (err) {
        return errFactory(CommonError.ensureCommonError(locale, err));
    }
}
