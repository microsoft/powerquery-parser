// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// similar to Result, except there's a third in-between state
// representing when a job was partially completed before an error occured
export type PartialResult<T, E> = PartialOk<T> | PartialMixed<T, E> | PartialErr<E>;

export const enum PartialResultKind {
    Ok = "Ok",
    Partial = "Partial",
    Err = "Err",
}

export interface PartialOk<T> {
    readonly kind: PartialResultKind.Ok;
    readonly value: T;
}

export interface PartialMixed<T, E> {
    readonly kind: PartialResultKind.Partial;
    readonly value: T;
    readonly error: E;
}

export interface PartialErr<E> {
    readonly kind: PartialResultKind.Err;
    readonly error: E;
}
