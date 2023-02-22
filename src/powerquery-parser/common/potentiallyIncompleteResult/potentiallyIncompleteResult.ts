// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// A tri-state Result. The additional third state is for when a job was partially completed before an error occured,
// and the work done wants to be saved/returned.
export type PotentiallyIncompleteResult<OkValue, PartialValue, Error> =
    | PotentiallyIncompleteOk<OkValue>
    | PotentiallyIncompletePartial<PartialValue>
    | PotentiallyIncompleteError<Error>;

export const enum PotentiallyIncompleteResultKind {
    Ok = "Ok",
    Partial = "Partial",
    Error = "Error",
}

export interface PotentiallyIncompleteOk<Value> {
    readonly kind: PotentiallyIncompleteResultKind.Ok;
    readonly value: Value;
}

export interface PotentiallyIncompletePartial<Partial> {
    readonly kind: PotentiallyIncompleteResultKind.Partial;
    readonly partial: Partial;
}

export interface PotentiallyIncompleteError<Error> {
    readonly kind: PotentiallyIncompleteResultKind.Error;
    readonly error: Error;
}
