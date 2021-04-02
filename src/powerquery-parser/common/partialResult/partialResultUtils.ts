// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { PartialError, PartialMixed, PartialOk, PartialResult, PartialResultKind } from "./partialResult";

export function createOk<O>(value: O): PartialOk<O> {
    return {
        kind: PartialResultKind.Ok,
        value,
    };
}

export function createMixed<M, E>(value: M, error: E): PartialMixed<M, E> {
    return {
        kind: PartialResultKind.Mixed,
        value,
        error,
    };
}

export function createError<E>(error: E): PartialError<E> {
    return {
        kind: PartialResultKind.Error,
        error,
    };
}

export function isOk<O, M, E>(result: PartialResult<O, M, E>): result is PartialOk<O> {
    return result.kind === PartialResultKind.Ok;
}

export function isMixed<O, M, E>(result: PartialResult<O, M, E>): result is PartialMixed<M, E> {
    return result.kind === PartialResultKind.Mixed;
}

export function isError<O, M, E>(result: PartialResult<O, M, E>): result is PartialError<E> {
    return result.kind === PartialResultKind.Error;
}
