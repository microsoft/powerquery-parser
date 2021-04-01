// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type Result<T, E> = Ok<T> | Err<E>;

export const enum ResultKind {
    Ok = "Ok",
    Error = "Err",
}

export interface Ok<T> {
    readonly kind: ResultKind.Ok;
    readonly value: T;
}

export interface Err<E> {
    readonly kind: ResultKind.Error;
    readonly error: E;
}
