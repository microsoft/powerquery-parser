// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export function zFill(currentValue: number, upperBound: number): string {
    return currentValue.toString().padStart(Math.ceil(Math.log10(upperBound + 1)), "0");
}
