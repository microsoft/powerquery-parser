// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, Pattern, Result, ResultUtils, StringUtils } from "../common";

export enum IdentifierKind {
    Generalized = "Generalized",
    GeneralizedWithQuotes = "GeneralizedWithQuotes",
    Invalid = "Invalid",
    Regular = "Regular",
    RegularWithQuotes = "RegularWithQuotes",
    RegularWithRequiredQuotes = "RegularWithRequiredQuotes",
}

// Assuming the text is a quoted identifier, finds the quotes that enclose the identifier.
// Otherwise returns undefined.
export function findQuotedIdentifierQuotes(text: string, index: number): StringUtils.FoundQuotes | undefined {
    if (text[index] !== "#") {
        return undefined;
    }

    return StringUtils.findQuotes(text, index + 1);
}

export function getAllowedIdentifiers(text: string, isGeneralizedIdentifierAllowed: boolean): ReadonlyArray<string> {
    const quotedAndUnquoted: TQuotedAndUnquoted | undefined = getQuotedAndUnquoted(text);

    if (quotedAndUnquoted === undefined) {
        return [];
    }

    switch (quotedAndUnquoted.identifierKind) {
        case IdentifierKind.Generalized:
            quotedAndUnquoted.withoutQuotes;

            return isGeneralizedIdentifierAllowed
                ? [quotedAndUnquoted.withQuotes, quotedAndUnquoted.withoutQuotes]
                : [];

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
export function getIdentifierKind(text: string, allowTrailingPeriod: boolean): IdentifierKind {
    if (isRegularIdentifier(text, allowTrailingPeriod)) {
        return IdentifierKind.Regular;
    } else if (isQuotedIdentifier(text)) {
        if (isRegularIdentifier)
            return isRegularIdentifier(text.slice(2, -1), false)
                ? IdentifierKind.RegularWithQuotes
                : IdentifierKind.RegularWithRequiredQuotes;
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
export function getNormalizedIdentifier(
    text: string,
    isGeneralizedIdentifierAllowed: boolean,
): Result<string, CommonError.InvariantError> {
    const quotedAndUnquoted: TQuotedAndUnquoted = getQuotedAndUnquoted(text);

    if (quotedAndUnquoted.identifierKind === IdentifierKind.Invalid) {
        return ResultUtils.error(new CommonError.InvariantError(`The text "${text}" is not a valid identifier.`));
    }

    // Validate a generalized identifier is allowed in this context.
    if (quotedAndUnquoted.identifierKind === IdentifierKind.Generalized && !isGeneralizedIdentifierAllowed) {
        return ResultUtils.error(
            new CommonError.InvariantError(
                `The text "${text}" is a generalized identifier, but it is not allowed in this context.`,
            ),
        );
    }

    // Prefer without quotes if it exists.
    return ResultUtils.ok(quotedAndUnquoted.withoutQuotes ?? quotedAndUnquoted.withQuotes);
}

function getQuotedAndUnquoted(text: string): TQuotedAndUnquoted {
    const identifierKind: IdentifierKind = getIdentifierKind(text, /* allowTrailingPeriod */ false);

    switch (identifierKind) {
        case IdentifierKind.Generalized:
            return {
                identifierKind,
                withoutQuotes: insertQuotes(text),
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
    | IQuotedAndUnquoted<IdentifierKind.Invalid, undefined, undefined>
    | IQuotedAndUnquoted<IdentifierKind.RegularWithQuotes, string, string>
    | IQuotedAndUnquoted<IdentifierKind.RegularWithRequiredQuotes, string, undefined>
    | IQuotedAndUnquoted<IdentifierKind.Regular, string, string>;

const enum IdentifierRegexpState {
    Done = "Done",
    RegularIdentifier = "RegularIdentifier",
    Start = "Start",
}

function insertQuotes(text: string): string {
    return `#"${text}"`;
}

function stripQuotes(text: string): string {
    return text.slice(2, -1);
}

interface IdentifierUtilsOptions {
    readonly allowTrailingPeriod?: boolean;
    readonly isGeneralizedIdentifierAllowed?: boolean;
}
