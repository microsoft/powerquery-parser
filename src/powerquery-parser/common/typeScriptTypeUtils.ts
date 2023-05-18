// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type ExtractFirstGenericType<T> = T extends Generic<infer U> ? U : never;

// removes `readonly` from T's attributes
export type StripReadonly<T> = { -readonly [K in keyof T]: T[K] };

export function isDefined<T>(x: T | undefined): x is T {
    return x !== undefined;
}

type Generic<T> = { value: T };
