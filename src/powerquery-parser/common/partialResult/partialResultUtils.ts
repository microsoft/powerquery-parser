// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { PartialErr, PartialMixed, PartialOk, PartialResult, PartialResultKind } from "./partialResult";

export function okFactory<O>(value: O): PartialOk<O> {
    return {
        kind: PartialResultKind.Ok,
        value,
    };
}

export function mixedFactory<M, E>(value: M, error: E): PartialMixed<M, E> {
    return {
        kind: PartialResultKind.Mixed,
        value,
        error,
    };
}

export function errFactory<E>(error: E): PartialErr<E> {
    return {
        kind: PartialResultKind.Err,
        error,
    };
}

export function isOk<O, M, E>(result: PartialResult<O, M, E>): result is PartialOk<O> {
    return result.kind === PartialResultKind.Ok;
}

export function isMixed<O, M, E>(result: PartialResult<O, M, E>): result is PartialMixed<M, E> {
    return result.kind === PartialResultKind.Mixed;
}

export function isErr<O, M, E>(result: PartialResult<O, M, E>): result is PartialErr<E> {
    return result.kind === PartialResultKind.Err;
}
