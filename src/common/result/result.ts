// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type Result<T, E> = Ok<T> | Err<E>;

export const enum ResultKind {
    Ok = "Ok",
    Err = "Err",
}

export interface Ok<T> {
    readonly kind: ResultKind.Ok;
    readonly value: T;
}

export interface Err<E> {
    readonly kind: ResultKind.Err;
    readonly error: E;
}

export function okFactory<T>(value: T): Ok<T> {
    return {
        kind: ResultKind.Ok,
        value,
    };
}
