// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    PartialResult,
    PartialResultError,
    PartialResultIncomplete,
    PartialResultKind,
    PartialResultOk,
} from "./partialResult";

export function createOk<Ok>(value: Ok): PartialResultOk<Ok> {
    return {
        kind: PartialResultKind.Ok,
        value,
    };
}

export function createIncomplete<Partial>(partial: Partial): PartialResultIncomplete<Partial> {
    return {
        kind: PartialResultKind.Incomplete,
        partial,
    };
}

export function createError<Error>(error: Error): PartialResultError<Error> {
    return {
        kind: PartialResultKind.Error,
        error,
    };
}

export function isOk<Ok, Partial, Error>(result: PartialResult<Ok, Partial, Error>): result is PartialResultOk<Ok> {
    return result.kind === PartialResultKind.Ok;
}

export function isIncomplete<Ok, Partial, Error>(
    result: PartialResult<Ok, Partial, Error>,
): result is PartialResultIncomplete<Partial> {
    return result.kind === PartialResultKind.Incomplete;
}

export function isError<Ok, Partial, Error>(
    result: PartialResult<Ok, Partial, Error>,
): result is PartialResultError<Error> {
    return result.kind === PartialResultKind.Error;
}
