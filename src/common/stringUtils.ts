// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import GraphemeSplitter = require("grapheme-splitter");
import { Assert, CommonError, Pattern } from ".";
import { KeywordKind, Keywords } from "../language";

export const graphemeSplitter: GraphemeSplitter = new GraphemeSplitter();

export const enum NewlineKind {
    SingleCharacter = "SingleCharacter",
    DoubleCharacter = "DoubleCharacter", // CARRIAGE RETURN + LINE FEED
}

export interface GraphemePosition {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
    readonly columnNumber: number;
    readonly maybeCodeUnit: number | undefined;
}

export function columnNumberFrom(text: string, requiredCodeUnit: number): number {
    const graphemes: ReadonlyArray<string> = graphemeSplitter.splitGraphemes(text);

    let columnNumber: number = 0;
    let summedCodeUnits: number = 0;
    for (const grapheme of graphemes) {
        if (summedCodeUnits === requiredCodeUnit) {
            return columnNumber;
        } else {
            summedCodeUnits += grapheme.length;
            columnNumber += 1;
        }
    }

    const details: {} = {
        text,
        requiredCodeUnit,
    };
    throw new CommonError.InvariantError(`no columnNumber can be generated for required codeUnit`, details);
}

export function graphemePositionFrom(
    text: string,
    lineCodeUnit: number,
    lineNumber: number,
    maybeCodeUnit: number | undefined,
): GraphemePosition {
    return {
        lineCodeUnit,
        lineNumber,
        columnNumber: columnNumberFrom(text, lineCodeUnit),
        maybeCodeUnit,
    };
}

export function isIdentifier(text: string): boolean {
    return maybeIdentifierLength(text, 0) === text.length;
}

export function isGeneralizedIdentifier(text: string): boolean {
    return maybeGeneralizedIdentifierLength(text, 0) === text.length;
}

export function isKeyword(text: string): boolean {
    return Keywords.indexOf(text as KeywordKind) !== -1;
}

export function isQuotedIdentifier(text: string): boolean {
    return maybeQuotedIdentifier(text, 0) === text.length;
}

export function maybeRegexMatchLength(pattern: RegExp, text: string, index: number): number | undefined {
    pattern.lastIndex = index;
    const matches: RegExpExecArray | null = pattern.exec(text);

    if (!matches) {
        return undefined;
    } else {
        return matches[0].length;
    }
}

export function maybeIdentifierLength(text: string, index: number): number | undefined {
    const startingIndex: number = index;
    const textLength: number = text.length;

    let continueMatching: boolean = true;
    let isOnStartCharacter: boolean = true;

    while (continueMatching) {
        const maybeMatchLength: number | undefined = maybeRegexMatchLength(
            isOnStartCharacter ? Pattern.IdentifierStartCharacter : Pattern.IdentifierPartCharacters,
            text,
            index,
        );

        if (maybeMatchLength === undefined) {
            continueMatching = false;
            continue;
        }

        index += maybeMatchLength;

        if (text[index] === ".") {
            isOnStartCharacter = true;
            index += 1;
        } else {
            isOnStartCharacter = false;
        }

        if (index >= textLength) {
            continueMatching = false;
        }
    }

    return index !== startingIndex ? index - startingIndex : undefined;
}

export function maybeGeneralizedIdentifierLength(text: string, index: number): number | undefined {
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
            const maybeMatchLength: number | undefined = maybeRegexMatchLength(
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

export function maybeQuotedIdentifier(text: string, index: number): number | undefined {
    if (text[index] !== "#") {
        return undefined;
    }
    if (text[index + 1] !== '"') {
        return undefined;
    }

    const startingIndex: number = index;
    const textLength: number = text.length;
    let continueMatching: boolean = true;
    let isValid: boolean = false;
    index += 2;

    while (continueMatching) {
        const chr1: string | undefined = text[index];

        if (chr1 === '"') {
            const chr2: string | undefined = text[index + 1];

            if (chr2 !== '"') {
                continueMatching = false;
                isValid = true;
                index += 1;
                continue;
            } else {
                index += 2;
            }
        }

        index += 1;

        if (index >= textLength) {
            continueMatching = false;
        }
    }

    return isValid ? index - startingIndex : undefined;
}

export function maybeNewlineKindAt(text: string, index: number): NewlineKind | undefined {
    const chr1: string = text[index];

    switch (chr1) {
        case `\u000d`: {
            const chr2: string = text[index + 1];
            return chr2 === `\u000a` ? NewlineKind.DoubleCharacter : NewlineKind.SingleCharacter;
        }

        case `\u000a`:
        case `\u0085`:
        case `\u2028`:
            return NewlineKind.SingleCharacter;

        default:
            return undefined;
    }
}

// A quick and dirty way to do string formatting.
// Does not handle any escaping.
export function expectFormat(template: string, args: Map<string, string>): string {
    let result: string = template;

    for (const [key, value] of args.entries()) {
        const formatKey: string = `{${key}}`;
        Assert.isTrue(template.indexOf(formatKey) !== -1, `unknown formatKey`, { formatKey });
        result = result.replace(formatKey, value);
    }

    return result;
}
