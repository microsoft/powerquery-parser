// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Represents a cursor position in a text editor.
export interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}
