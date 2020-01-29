// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { PartialErr, PartialMixed, PartialOk, PartialResult, PartialResultKind } from "./partialResult";

export function okFactory<T>(value: T): PartialOk<T> {
    return {
        kind: PartialResultKind.Ok,
        value,
    };
}

export function mixedFactory<T, E>(value: T, error: E): PartialMixed<T, E> {
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

export function isOk<T, E>(result: PartialResult<T, E>): result is PartialOk<T> {
    return result.kind === PartialResultKind.Ok;
}

export function isMixed<T, E>(result: PartialResult<T, E>): result is PartialMixed<T, E> {
    return result.kind === PartialResultKind.Mixed;
}

export function isErr<T, E>(result: PartialResult<T, E>): result is PartialErr<E> {
    return result.kind === PartialResultKind.Err;
}
