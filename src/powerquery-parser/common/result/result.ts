// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type Result<T, E> = OkResult<T> | ErrorResult<E>;

export const enum ResultKind {
    Ok = "Ok",
    Error = "Error",
}

export interface OkResult<T> {
    readonly kind: ResultKind.Ok;
    readonly value: T;
}

export interface ErrorResult<E> {
    readonly kind: ResultKind.Error;
    readonly error: E;
}
