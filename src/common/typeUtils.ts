// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// removes `readonly` from T's attributes
export type StripReadonly<T> = { -readonly [K in keyof T]: T[K] };
