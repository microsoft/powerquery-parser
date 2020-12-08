// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// removes `readonly` from T's attributes
export type StripReadonly<T> = { -readonly [K in keyof T]: T[K] };

export function isDefined<T>(x: T | undefined): x is T {
    return x !== undefined;
}
