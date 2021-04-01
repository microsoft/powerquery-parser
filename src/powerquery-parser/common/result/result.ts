// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type Result<T, E> = Ok<T> | Error<E>;

export const enum ResultKind {
    Ok = "Ok",
    Error = "Error",
}

export interface Ok<T> {
    readonly kind: ResultKind.Ok;
    readonly value: T;
}

export interface Error<E> {
    readonly kind: ResultKind.Error;
    readonly error: E;
}
