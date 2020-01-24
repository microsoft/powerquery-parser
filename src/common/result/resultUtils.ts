// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Err, Ok, ResultKind } from "./result";

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
