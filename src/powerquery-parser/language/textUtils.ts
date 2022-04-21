// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, Pattern, StringUtils } from "../common";

export const enum IdentifierKind {
    Generalized = "Generalized",
    Invalid = "Invalid",
    Quote = "Quote",
    QuoteRequired = "QuoteRequired",
    Regular = "Regular",
}

export function escape(text: string): string {
    let result: string = text;

    for (const [regexp, escaped] of UnescapedWhitespaceRegexp) {
        result = result.replace(regexp, escaped);
    }

    return result;
}

export function identifierKind(text: string, allowTrailingPeriod: boolean): IdentifierKind {
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

export function isGeneralizedIdentifier(text: string): boolean {
    return maybeGeneralizedIdentifierLength(text, 0) === text.length;
}

export function isRegularIdentifier(text: string, allowTrailingPeriod: boolean): boolean {
    return maybeIdentifierLength(text, 0, allowTrailingPeriod) === text.length;
}

export function isQuotedIdentifier(text: string): boolean {
    return maybeQuotedIdentifier(text, 0) !== undefined;
}

export function maybeIdentifierLength(text: string, index: number, allowTrailingPeriod: boolean): number | undefined {
    const startingIndex: number = index;
    const textLength: number = text.length;

    let state: IdentifierRegexpState = IdentifierRegexpState.Start;
    let maybeMatchLength: number | undefined;

    while (state !== IdentifierRegexpState.Done) {
        if (index === textLength) {
            return index - startingIndex;
        }

        switch (state) {
            case IdentifierRegexpState.Start:
                maybeMatchLength = StringUtils.maybeRegexMatchLength(Pattern.IdentifierStartCharacter, text, index);

                if (maybeMatchLength === undefined) {
                    state = IdentifierRegexpState.Done;
                } else {
                    state = IdentifierRegexpState.RegularIdentifier;
                    index += maybeMatchLength;
                }

                break;

            case IdentifierRegexpState.RegularIdentifier:
                // Don't consider `..` or `...` part of an identifier.
                if (allowTrailingPeriod && text[index] === "." && text[index + 1] !== ".") {
                    index += 1;
                }

                maybeMatchLength = StringUtils.maybeRegexMatchLength(Pattern.IdentifierPartCharacters, text, index);

                if (maybeMatchLength === undefined) {
                    state = IdentifierRegexpState.Done;
                } else {
                    index += maybeMatchLength;

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

export function maybeGeneralizedIdentifierLength(text: string, index: number): number | undefined {
    const startingIndex: number = index;
    const textLength: number = text.length;

    let continueMatching: boolean = true;

    while (continueMatching === true) {
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
            const maybeMatchLength: number | undefined = StringUtils.maybeRegexMatchLength(
                Pattern.IdentifierPartCharacters,
                text,
                index,
            );

            if (maybeMatchLength === undefined) {
                continueMatching = false;
                break;
            }

            index += maybeMatchLength;
        }

        if (index >= textLength) {
            continueMatching = false;
        }
    }

    return index !== startingIndex ? index - startingIndex : undefined;
}

export function maybeQuotedIdentifier(text: string, index: number): StringUtils.FoundQuote | undefined {
    if (text[index] !== "#") {
        return undefined;
    }

    return StringUtils.maybefindQuote(text, index + 1);
}

export function normalizeIdentifier(text: string): string {
    if (isQuotedIdentifier(text)) {
        const stripped: string = text.slice(2, -1);

        return isRegularIdentifier(stripped, false) ? stripped : text;
    } else {
        return text;
    }
}

export function unescape(text: string): string {
    let result: string = text;

    for (const [regexp, literal] of EscapedWhitespaceRegexp) {
        result = result.replace(regexp, literal);
    }

    return result;
}

const enum IdentifierRegexpState {
    Start,
    RegularIdentifier,
    Done,
}

const EscapedWhitespaceRegexp: ReadonlyArray<[RegExp, string]> = [
    [/#\(cr,lf\)/gm, "\r\n"],
    [/#\(cr\)/gm, "\r"],
    [/#\(lf\)/gm, "\n"],
    [/#\(tab\)/gm, "\t"],
    [/""/gm, '"'],
    [/#\(#\)\(/gm, "#("],
];

const UnescapedWhitespaceRegexp: ReadonlyArray<[RegExp, string]> = [
    [/#/gm, "#(#)"],
    [/\r\n/gm, `#(cr,lf)`],
    [/\r/gm, `#(cr)`],
    [/\n/gm, `#(lf)`],
    [/\t/gm, `#(tab)`],
    [/"/gm, `""`],
];
