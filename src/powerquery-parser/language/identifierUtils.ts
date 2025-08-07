// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, Pattern, StringUtils } from "../common";

export enum IdentifierKind {
    Generalized = "Generalized",
    GeneralizedWithQuotes = "GeneralizedWithQuotes",
    Invalid = "Invalid",
    Regular = "Regular",
    RegularWithQuotes = "RegularWithQuotes",
    RegularWithRequiredQuotes = "RegularWithRequiredQuotes",
}

export interface IdentifierUtilsOptions {
    readonly allowGeneralizedIdentifier?: boolean;
    readonly allowTrailingPeriod?: boolean;
}

export function getAllowedIdentifiers(text: string, options?: IdentifierUtilsOptions): ReadonlyArray<string> {
    const allowGeneralizedIdentifier: boolean =
        options?.allowGeneralizedIdentifier ?? DefaultallowGeneralizedIdentifier;

    const quotedAndUnquoted: TQuotedAndUnquoted | undefined = getQuotedAndUnquoted(text, options);

    if (quotedAndUnquoted === undefined) {
        return [];
    }

    switch (quotedAndUnquoted.identifierKind) {
        case IdentifierKind.Generalized:
        case IdentifierKind.GeneralizedWithQuotes:
            return allowGeneralizedIdentifier ? [quotedAndUnquoted.withQuotes, quotedAndUnquoted.withoutQuotes] : [];

        case IdentifierKind.Invalid:
            return [];

        case IdentifierKind.RegularWithQuotes:
            return [quotedAndUnquoted.withQuotes, quotedAndUnquoted.withoutQuotes];

        case IdentifierKind.RegularWithRequiredQuotes:
            return [quotedAndUnquoted.withQuotes];

        case IdentifierKind.Regular:
            return [quotedAndUnquoted.withoutQuotes, quotedAndUnquoted.withQuotes];

        default:
            throw Assert.isNever(quotedAndUnquoted);
    }
}

// Determines what kind of identifier the text is.
// It's possible that the text is a partially completed identifier,
// which is why we have the `allowTrailingPeriod` parameter.
export function getIdentifierKind(text: string, options?: IdentifierUtilsOptions): IdentifierKind {
    const allowGeneralizedIdentifier: boolean =
        options?.allowGeneralizedIdentifier ?? DefaultallowGeneralizedIdentifier;

    if (isRegularIdentifier(text, options)) {
        return IdentifierKind.Regular;
    } else if (allowGeneralizedIdentifier && isGeneralizedIdentifier(text)) {
        return IdentifierKind.Generalized;
    }
    // If the identifier is quoted it's either:
    // - a regular identifier with quotes,
    // - a generalized identifier with quotes,
    else if (isQuotedIdentifier(text)) {
        const stripped: string = stripQuotes(text);

        if (isRegularIdentifier(stripped, options)) {
            return IdentifierKind.RegularWithQuotes;
        } else if (isGeneralizedIdentifier(stripped) && allowGeneralizedIdentifier) {
            return IdentifierKind.GeneralizedWithQuotes;
        } else {
            return IdentifierKind.RegularWithRequiredQuotes;
        }
    } else {
        return IdentifierKind.Invalid;
    }
}

// I'd prefer if this was internal, but it's used by the lexer so it's marked as public.
// Returns the length of the identifier starting at the given index.
export function getIdentifierLength(text: string, index: number, options?: IdentifierUtilsOptions): number | undefined {
    const allowTrailingPeriod: boolean = options?.allowTrailingPeriod ?? DefaultAllowTrailingPeriod;
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
                if (text[index] === ".") {
                    const nextChr: string | undefined = text[index + 1];

                    // If the last character is a period
                    if (nextChr === undefined) {
                        // If we allow trailing period, we can consider it part of the identifier.
                        if (allowTrailingPeriod) {
                            index += 1;
                        }
                        // Else we are done.
                        else {
                            state = IdentifierRegexpState.Done;
                        }
                    }
                    // Else if it's two sequential periods, we are done.
                    else if (nextChr === ".") {
                        state = IdentifierRegexpState.Done;
                    }
                    // Else if it's a single period followed by a potentially valid identifier character.
                    else {
                        index += 1;
                    }

                    break;
                }

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

// Removes the quotes from a quoted identifier if possible.
export function getNormalizedIdentifier(text: string, options?: IdentifierUtilsOptions): string | undefined {
    const allowGeneralizedIdentifier: boolean =
        options?.allowGeneralizedIdentifier ?? DefaultallowGeneralizedIdentifier;

    const quotedAndUnquoted: TQuotedAndUnquoted = getQuotedAndUnquoted(text, options);

    if (quotedAndUnquoted.identifierKind === IdentifierKind.Invalid) {
        return undefined;
    }

    // Validate a generalized identifier is allowed in this context.
    if (quotedAndUnquoted.identifierKind === IdentifierKind.Generalized && !allowGeneralizedIdentifier) {
        return undefined;
    }

    // Prefer without quotes if it exists.
    return quotedAndUnquoted.withoutQuotes ?? quotedAndUnquoted.withQuotes;
}

interface IQuotedAndUnquoted<
    TKind extends IdentifierKind,
    TWithQuotes extends string | undefined,
    TWithoutQuotes extends string | undefined,
> {
    readonly identifierKind: TKind;
    readonly withQuotes: TWithQuotes;
    readonly withoutQuotes: TWithoutQuotes;
}

type TQuotedAndUnquoted =
    | IQuotedAndUnquoted<IdentifierKind.Generalized, string, string>
    | IQuotedAndUnquoted<IdentifierKind.GeneralizedWithQuotes, string, string>
    | IQuotedAndUnquoted<IdentifierKind.Invalid, undefined, undefined>
    | IQuotedAndUnquoted<IdentifierKind.RegularWithQuotes, string, string>
    | IQuotedAndUnquoted<IdentifierKind.RegularWithRequiredQuotes, string, undefined>
    | IQuotedAndUnquoted<IdentifierKind.Regular, string, string>;

const enum IdentifierRegexpState {
    Done = "Done",
    RegularIdentifier = "RegularIdentifier",
    Start = "Start",
}

// Assuming the text is a quoted identifier, finds the quotes that enclose the identifier.
// Otherwise returns undefined.
function findQuotedIdentifierQuotes(text: string, index: number): StringUtils.FoundQuotes | undefined {
    if (text[index] !== "#") {
        return undefined;
    }

    return StringUtils.findQuotes(text, index + 1);
}

// Assuming the text is a generalized identifier, returns the length of the identifier.
function getGeneralizedIdentifierLength(text: string, index: number): number | undefined {
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

function getQuotedAndUnquoted(text: string, options?: IdentifierUtilsOptions): TQuotedAndUnquoted {
    const identifierKind: IdentifierKind = getIdentifierKind(text, options);

    switch (identifierKind) {
        case IdentifierKind.Generalized:
            return {
                identifierKind,
                withoutQuotes: text,
                withQuotes: insertQuotes(text),
            };

        case IdentifierKind.GeneralizedWithQuotes:
            return {
                identifierKind,
                withoutQuotes: stripQuotes(text),
                withQuotes: text,
            };

        case IdentifierKind.Invalid:
            return {
                identifierKind,
                withoutQuotes: undefined,
                withQuotes: undefined,
            };

        case IdentifierKind.RegularWithQuotes:
            return {
                identifierKind,
                withoutQuotes: stripQuotes(text),
                withQuotes: text,
            };

        case IdentifierKind.RegularWithRequiredQuotes:
            return {
                identifierKind,
                withoutQuotes: undefined,
                withQuotes: text,
            };

        case IdentifierKind.Regular:
            return {
                identifierKind,
                withoutQuotes: text,
                withQuotes: insertQuotes(text),
            };

        default:
            throw Assert.isNever(identifierKind);
    }
}

function insertQuotes(text: string): string {
    return `#"${text}"`;
}

function isGeneralizedIdentifier(text: string): boolean {
    return text.length > 0 && getGeneralizedIdentifierLength(text, 0) === text.length;
}

function isRegularIdentifier(text: string, options?: IdentifierUtilsOptions): boolean {
    return text.length > 0 && getIdentifierLength(text, 0, options) === text.length;
}

function isQuotedIdentifier(text: string): boolean {
    return findQuotedIdentifierQuotes(text, 0) !== undefined;
}

function stripQuotes(text: string): string {
    return text.slice(2, -1);
}

const DefaultAllowTrailingPeriod: boolean = false;
const DefaultallowGeneralizedIdentifier: boolean = false;
