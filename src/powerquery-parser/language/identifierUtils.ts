// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, Pattern, StringUtils } from "../common";

export enum IdentifierKind {
    Generalized = "Generalized",
    Invalid = "Invalid",
    Quote = "Quote",
    QuoteRequired = "QuoteRequired",
    Regular = "Regular",
}

// Assuming the text is a quoted identifier, finds the quotes that enclose the identifier.
// Otherwise returns undefined.
export function findQuotedIdentifierQuotes(text: string, index: number): StringUtils.FoundQuotes | undefined {
    if (text[index] !== "#") {
        return undefined;
    }

    return StringUtils.findQuotes(text, index + 1);
}

// Determines what kind of identifier the text is.
// It's possible that the text is a partially completed identifier,
// which is why we have the `allowTrailingPeriod` parameter.
export function getIdentifierKind(text: string, allowTrailingPeriod: boolean): IdentifierKind {
    if (isRegularIdentifier(text, allowTrailingPeriod)) {
        return IdentifierKind.Regular;
    } else if (isQuotedIdentifier(text)) {
        return isRegularIdentifier(text.slice(2, -1), false) ? IdentifierKind.Quote : IdentifierKind.QuoteRequired;
    } else if (isGeneralizedIdentifier(text)) {
        return IdentifierKind.Generalized;
    } else {
        return IdentifierKind.Invalid;
    }
}

// Assuming the text is an identifier, returns the length of the identifier.
export function getIdentifierLength(text: string, index: number, allowTrailingPeriod: boolean): number | undefined {
    const startingIndex: number = index;
    const textLength: number = text.length;

    let state: IdentifierRegexpState = IdentifierRegexpState.Start;
    let matchLength: number | undefined;

    while (state !== IdentifierRegexpState.Done) {
        if (index === textLength) {
            return index - startingIndex;
        }

        switch (state) {
            case IdentifierRegexpState.Start:
                matchLength = StringUtils.regexMatchLength(Pattern.IdentifierStartCharacter, text, index);

                if (matchLength === undefined) {
                    state = IdentifierRegexpState.Done;
                } else {
                    state = IdentifierRegexpState.RegularIdentifier;
                    index += matchLength;
                }

                break;

            case IdentifierRegexpState.RegularIdentifier:
                // Don't consider `..` or `...` part of an identifier.
                if (allowTrailingPeriod && text[index] === "." && text[index + 1] !== ".") {
                    index += 1;
                }

                matchLength = StringUtils.regexMatchLength(Pattern.IdentifierPartCharacters, text, index);

                if (matchLength === undefined) {
                    state = IdentifierRegexpState.Done;
                } else {
                    index += matchLength;

                    // Don't consider `..` or `...` part of an identifier.
                    if (allowTrailingPeriod && text[index] === "." && text[index + 1] !== ".") {
                        index += 1;
                    }
                }

                break;

            default:
                throw Assert.isNever(state);
        }
    }

    return index !== startingIndex ? index - startingIndex : undefined;
}

// Assuming the text is a generalized identifier, returns the length of the identifier.
export function getGeneralizedIdentifierLength(text: string, index: number): number | undefined {
    const startingIndex: number = index;
    const textLength: number = text.length;

    let continueMatching: boolean = true;

    while (continueMatching) {
        const currentChr: string = text[index];

        if (currentChr === " ") {
            index += 1;
        } else if (currentChr === ".") {
            if (text[index - 1] === ".") {
                continueMatching = false;
                break;
            }

            index += 1;
        } else {
            const matchLength: number | undefined = StringUtils.regexMatchLength(
                Pattern.IdentifierPartCharacters,
                text,
                index,
            );

            if (matchLength === undefined) {
                continueMatching = false;
                break;
            }

            index += matchLength;
        }

        if (index >= textLength) {
            continueMatching = false;
        }
    }

    return index !== startingIndex ? index - startingIndex : undefined;
}

export function isGeneralizedIdentifier(text: string): boolean {
    return getGeneralizedIdentifierLength(text, 0) === text.length;
}

export function isRegularIdentifier(text: string, allowTrailingPeriod: boolean): boolean {
    return getIdentifierLength(text, 0, allowTrailingPeriod) === text.length;
}

export function isQuotedIdentifier(text: string): boolean {
    return findQuotedIdentifierQuotes(text, 0) !== undefined;
}

// Removes the quotes from a quoted identifier if possible.
export function normalizeIdentifier(text: string): string {
    if (isQuotedIdentifier(text)) {
        const stripped: string = text.slice(2, -1);

        return isRegularIdentifier(stripped, false) ? stripped : text;
    } else {
        return text;
    }
}

const enum IdentifierRegexpState {
    Done = "Done",
    RegularIdentifier = "RegularIdentifier",
    Start = "Start",
}
