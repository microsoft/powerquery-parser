// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonIdentifierUtilsOptions, getNormalizedIdentifier } from "./identifierUtils";
import { Assert } from "../common";

export function assertNormalizedIdentifierExpression(text: string, options?: CommonIdentifierUtilsOptions): string {
    return Assert.asDefined(
        getNormalizedIdentifierExpression(text, options),
        `Expected a valid identifier expression but received '${text}'`,
    );
}

// Removes the '@' and quotes from a quoted identifier if possible.
// When given an invalid identifier, returns undefined.
export function getNormalizedIdentifierExpression(
    text: string,
    options?: CommonIdentifierUtilsOptions,
): string | undefined {
    if (text.startsWith("@")) {
        text = text.substring(1);
    }

    return getNormalizedIdentifier(text, options);
}
