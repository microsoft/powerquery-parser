// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// A tri-state Result. The additional third state is for when a job was partially completed before an error occured,
// and the work done wants to be saved/returned.
export type PartialResult<O, M, E> = PartialOk<O> | PartialMixed<M, E> | PartialErr<E>;

export const enum PartialResultKind {
    Ok = "Ok",
    Mixed = "Mixed",
    Err = "Err",
}

export interface PartialOk<O> {
    readonly kind: PartialResultKind.Ok;
    readonly value: O;
}

export interface PartialMixed<M, E> {
    readonly kind: PartialResultKind.Mixed;
    readonly value: M;
    readonly error: E;
}

export interface PartialErr<E> {
    readonly kind: PartialResultKind.Err;
    readonly error: E;
}
