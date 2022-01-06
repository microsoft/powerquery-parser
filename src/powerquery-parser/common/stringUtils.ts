// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import GraphemeSplitter = require("grapheme-splitter");
import { Assert, CommonError, Pattern } from ".";

export const graphemeSplitter: GraphemeSplitter = new GraphemeSplitter();

export interface FoundQuote {
    readonly indexStart: number;
    readonly indexEnd: number;
    // Spans [indexStart, indexEnd)
    readonly quoteLength: number;
}

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

// A quick and dirty way to do string formatting.
// Does not handle any escaping.
export function assertGetFormatted(template: string, args: Map<string, string>): string {
    let result: string = template;

    for (const [key, value] of args.entries()) {
        const formatKey: string = `{${key}}`;
        Assert.isTrue(template.indexOf(formatKey) !== -1, `unknown formatKey`, { formatKey });
        result = result.replace(formatKey, value);
    }

    return result;
}

export function ensureQuoted(text: string): string {
    if (maybefindQuote(text, 0)) {
        return text;
    }

    return `"${text.includes(`"`) ? text.replace(`"`, `""`) : text}"`;
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

    const details: {
        text: string;
        requiredCodeUnit: number;
    } = {
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

export function isNumeric(text: string): boolean {
    return maybeRegexMatchLength(Pattern.Numeric, text, 0) === text.length;
}

export function maybeRegexMatchLength(pattern: RegExp, text: string, index: number): number | undefined {
    pattern.lastIndex = index;
    const matches: RegExpExecArray | null = pattern.exec(text);

    return matches !== null && matches.index === index ? matches[0].length : undefined;
}

// Attempt to find quoted text at the given starting index.
// Return undefined if the starting index isn't a quote or if there is no closing quotes.
export function maybefindQuote(text: string, indexStart: number): FoundQuote | undefined {
    const textLength: number = text.length;

    if (
        // If it doesn't start with a quote
        text[indexStart] !== '"' ||
        // or indexStart was the last character
        indexStart + 1 === textLength
    ) {
        return undefined;
    }

    let continueMatching: boolean = true;
    let index: number = indexStart + 1;

    while (continueMatching) {
        const chr1: string | undefined = text[index];

        if (chr1 === '"') {
            const chr2: string | undefined = text[index + 1];

            if (chr2 !== '"') {
                continueMatching = false;
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

    // If no valid end quote was found
    if (index >= textLength && text[textLength - 1] !== `"`) {
        return undefined;
    }

    return {
        indexStart,
        indexEnd: index,
        quoteLength: index - indexStart,
    };
}

export function maybeNewlineKindAt(text: string, index: number): NewlineKind | undefined {
    const chr1: string = text[index];

    switch (chr1) {
        case `\u000d`: {
            const chr2: string | undefined = text[index + 1];

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

export function maybeNormalizeNumber(text: string): string | undefined {
    let isPositive: boolean = true;
    let charOffset: number = 0;
    let char: string | undefined = text[charOffset];

    while (char === "+" || char === "-") {
        if (char === "-") {
            isPositive = !isPositive;
        }

        charOffset += 1;
        char = text[charOffset];
    }

    const allButUnaryOperators: string = text.slice(charOffset);

    if (maybeRegexMatchLength(Pattern.Numeric, allButUnaryOperators, 0) !== allButUnaryOperators.length) {
        return undefined;
    }

    return isPositive === true ? allButUnaryOperators : `-${allButUnaryOperators}`;
}
