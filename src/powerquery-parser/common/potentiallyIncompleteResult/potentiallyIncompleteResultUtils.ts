// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    PotentiallyIncompleteError,
    PotentiallyIncompleteOk,
    PotentiallyIncompletePartial,
    PotentiallyIncompleteResult,
    PotentiallyIncompleteResultKind,
} from "./potentiallyIncompleteResult";

export function createOk<OkValue>(value: OkValue): PotentiallyIncompleteOk<OkValue> {
    return {
        kind: PotentiallyIncompleteResultKind.Ok,
        value,
    };
}

export function createPartial<PartialValue>(partial: PartialValue): PotentiallyIncompletePartial<PartialValue> {
    return {
        kind: PotentiallyIncompleteResultKind.Partial,
        partial,
    };
}

export function createError<E>(error: E): PotentiallyIncompleteError<E> {
    return {
        kind: PotentiallyIncompleteResultKind.Error,
        error,
    };
}

export function isOk<OkValue, PartialValue, Error>(
    result: PotentiallyIncompleteResult<OkValue, PartialValue, Error>,
): result is PotentiallyIncompleteOk<OkValue> {
    return result.kind === PotentiallyIncompleteResultKind.Ok;
}

export function isMixed<OkValue, PartialValue, Error>(
    result: PotentiallyIncompleteResult<OkValue, PartialValue, Error>,
): result is PotentiallyIncompletePartial<PartialValue> {
    return result.kind === PotentiallyIncompleteResultKind.Partial;
}

export function isError<OkValue, PartialValue, Error>(
    result: PotentiallyIncompleteResult<OkValue, PartialValue, Error>,
): result is PotentiallyIncompleteError<Error> {
    return result.kind === PotentiallyIncompleteResultKind.Error;
}
