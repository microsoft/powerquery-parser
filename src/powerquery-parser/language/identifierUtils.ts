// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, Pattern, StringUtils } from "../common";
import { KeywordKind } from "./keyword/keyword";

export enum IdentifierKind {
    Generalized = "Generalized",
    GeneralizedWithQuotes = "GeneralizedWithQuotes",
    Invalid = "Invalid",
    Regular = "Regular",
    RegularWithQuotes = "RegularWithQuotes",
    RegularWithRequiredQuotes = "RegularWithRequiredQuotes",
}

export interface CommonIdentifierUtilsOptions {
    readonly allowGeneralizedIdentifier?: boolean;
    readonly allowTrailingPeriod?: boolean;
}

export interface GetAllowedIdentifiersOptions extends CommonIdentifierUtilsOptions {
    readonly allowRecursive?: boolean;
}

// Wraps an assert around the getNormalizedIdentifier method
export function assertNormalizedIdentifier(text: string, options?: CommonIdentifierUtilsOptions): string {
    return Assert.asDefined(
        getNormalizedIdentifier(text, options),
        `Expected a valid identifier but received '${text}'`,
    );
}

// Identifiers have multiple forms that can be used interchangeably.
// For example, if you have `[key = 1]`, you can use `key` or `#""key""`.
// The `getAllowedIdentifiers` function returns all the forms of the identifier that are allowed in the current context.
export function getAllowedIdentifiers(text: string, options?: GetAllowedIdentifiersOptions): ReadonlyArray<string> {
    const allowGeneralizedIdentifier: boolean =
        options?.allowGeneralizedIdentifier ?? DefaultAllowGeneralizedIdentifier;

    const quotedAndUnquoted: TQuotedAndUnquoted | undefined = getQuotedAndUnquoted(text, options);

    if (quotedAndUnquoted === undefined) {
        return [];
    }

    let result: string[];

    switch (quotedAndUnquoted.identifierKind) {
        case IdentifierKind.Generalized:
        case IdentifierKind.GeneralizedWithQuotes:
            result = allowGeneralizedIdentifier ? [quotedAndUnquoted.withQuotes, quotedAndUnquoted.withoutQuotes] : [];
            break;

        case IdentifierKind.Invalid:
            result = [];
            break;

        case IdentifierKind.RegularWithQuotes:
            result = [quotedAndUnquoted.withQuotes, quotedAndUnquoted.withoutQuotes];
            break;

        case IdentifierKind.RegularWithRequiredQuotes:
            result = [quotedAndUnquoted.withQuotes];
            break;

        case IdentifierKind.Regular:
            result = [quotedAndUnquoted.withoutQuotes, quotedAndUnquoted.withQuotes];
            break;

        default:
            throw Assert.isNever(quotedAndUnquoted);
    }

    if (options?.allowRecursive) {
        result = result.concat(result.map((value: string) => prefixInclusiveConstant(value)));
    }

    return result;
}

// An identifier can have multiple forms:
// - Regular: `foo`
// - Regular with quotes: `#""foo""`
// - Regular with required quotes: `#""foo bar""`
//    - Regular with required quotes is used when the identifier has spaces or special characters,
//      and when generalized identifiers are not allowed.
// - Generalized: `foo bar`
// - Generalized with quotes: `#""foo bar""`
// - Invalid: `foo..bar`
export function getIdentifierKind(text: string, options?: CommonIdentifierUtilsOptions): IdentifierKind {
    const allowGeneralizedIdentifier: boolean =
        options?.allowGeneralizedIdentifier ?? DefaultAllowGeneralizedIdentifier;

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
export function getIdentifierLength(
    text: string,
    index: number,
    options?: CommonIdentifierUtilsOptions,
): number | undefined {
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

            // We should allow a single period as part of the identifier,
            // but only if it's not the last character and not followed by another period.
            // Allow an exception for when it's the last character and allowTrailingPeriod is true.
            case IdentifierRegexpState.RegularIdentifier: {
                const currentChr: string | undefined = text[index];

                if (currentChr === undefined) {
                    state = IdentifierRegexpState.Done;
                } else if (currentChr === ".") {
                    const nextChr: string | undefined = text[index + 1];

                    // If we have a single period we might include it as part of the identifier when:
                    // 1. It's not the last character and not followed by another period
                    // 2. It's the last character and allowTrailingPeriod is true
                    if ((nextChr && nextChr !== ".") || (nextChr === undefined && allowTrailingPeriod)) {
                        index += 1;
                    } else {
                        state = IdentifierRegexpState.Done;
                    }
                } else {
                    matchLength = StringUtils.regexMatchLength(Pattern.IdentifierPartCharacters, text, index);

                    if (matchLength === undefined) {
                        state = IdentifierRegexpState.Done;
                    } else {
                        index += matchLength;
                    }
                }

                break;
            }

            default:
                throw Assert.isNever(state);
        }
    }

    return index !== startingIndex ? index - startingIndex : undefined;
}

// Removes the quotes from a quoted identifier if possible.
// When given an invalid identifier, returns undefined.
export function getNormalizedIdentifier(text: string, options?: CommonIdentifierUtilsOptions): string | undefined {
    if (AllowedHashKeywords.has(text)) {
        return text;
    }

    const allowGeneralizedIdentifier: boolean =
        options?.allowGeneralizedIdentifier ?? DefaultAllowGeneralizedIdentifier;

    const quotedAndUnquoted: TQuotedAndUnquoted = getQuotedAndUnquoted(text, options);

    switch (quotedAndUnquoted.identifierKind) {
        case IdentifierKind.Regular:
        case IdentifierKind.RegularWithQuotes:
            return quotedAndUnquoted.withoutQuotes;

        case IdentifierKind.GeneralizedWithQuotes:
        case IdentifierKind.Generalized:
            return allowGeneralizedIdentifier ? quotedAndUnquoted.withoutQuotes : undefined;

        case IdentifierKind.Invalid:
            return undefined;

        case IdentifierKind.RegularWithRequiredQuotes:
            return quotedAndUnquoted.withQuotes;

        default:
            throw Assert.isNever(quotedAndUnquoted);
    }
}

type TQuotedAndUnquoted =
    | {
          readonly identifierKind: IdentifierKind.Generalized;
          readonly withQuotes: string;
          readonly withoutQuotes: string;
      }
    | {
          readonly identifierKind: IdentifierKind.GeneralizedWithQuotes;
          readonly withQuotes: string;
          readonly withoutQuotes: string;
      }
    | {
          readonly identifierKind: IdentifierKind.Invalid;
      }
    | {
          readonly identifierKind: IdentifierKind.Regular;
          readonly withQuotes: string;
          readonly withoutQuotes: string;
      }
    | {
          readonly identifierKind: IdentifierKind.RegularWithQuotes;
          readonly withQuotes: string;
          readonly withoutQuotes: string;
      }
    | {
          readonly identifierKind: IdentifierKind.RegularWithRequiredQuotes;
          readonly withQuotes: string;
      };

const enum IdentifierRegexpState {
    Done = "Done",
    RegularIdentifier = "RegularIdentifier",
    Start = "Start",
}

// Finds the locations of quotes in a quoted identifier.
// Returns undefined if the identifier is not quoted.
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

// Returns the quoted and unquoted versions of the identifier (if applicable).
function getQuotedAndUnquoted(text: string, options?: CommonIdentifierUtilsOptions): TQuotedAndUnquoted {
    const identifierKind: IdentifierKind = getIdentifierKind(text, options);

    switch (identifierKind) {
        case IdentifierKind.Generalized:
            return {
                identifierKind,
                withoutQuotes: text,
                withQuotes: makeQuoted(text),
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
                withQuotes: text,
            };

        case IdentifierKind.Regular:
            return {
                identifierKind,
                withoutQuotes: text,
                withQuotes: makeQuoted(text),
            };

        default:
            throw Assert.isNever(identifierKind);
    }
}

function makeQuoted(text: string): string {
    return `#"${text}"`;
}

function prefixInclusiveConstant(text: string): string {
    return `@${text}`;
}

function isGeneralizedIdentifier(text: string): boolean {
    return text.length > 0 && getGeneralizedIdentifierLength(text, 0) === text.length;
}

function isRegularIdentifier(text: string, options?: CommonIdentifierUtilsOptions): boolean {
    return text.length > 0 && getIdentifierLength(text, 0, options) === text.length;
}

function isQuotedIdentifier(text: string): boolean {
    return findQuotedIdentifierQuotes(text, 0) !== undefined;
}

function stripQuotes(text: string): string {
    return text.slice(2, -1);
}

const DefaultAllowTrailingPeriod: boolean = false;
const DefaultAllowGeneralizedIdentifier: boolean = false;

const AllowedHashKeywords: ReadonlySet<string> = new Set([
    KeywordKind.HashBinary,
    KeywordKind.HashDate,
    KeywordKind.HashDateTime,
    KeywordKind.HashDateTimeZone,
    KeywordKind.HashDuration,
    KeywordKind.HashInfinity,
    KeywordKind.HashNan,
    KeywordKind.HashSections,
    KeywordKind.HashShared,
    KeywordKind.HashTable,
    KeywordKind.HashTime,
]);
