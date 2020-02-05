// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import GraphemeSplitter = require("grapheme-splitter");
import { CommonError } from ".";

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

export function maybeRegexMatchLength(pattern: RegExp, text: string, index: number): number | undefined {
    pattern.lastIndex = index;
    const matches: RegExpExecArray | null = pattern.exec(text);

    if (!matches) {
        return undefined;
    } else {
        return matches[0].length;
    }
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
// Continually replaces '{}' until no more exist or you run out of args.
// Does not handle any escaping.
export function expectFormat(template: string, ...args: any[]): string {
    const details: {} = {
        template,
        args: [...args],
    };

    let result: string = template;
    while (args.length) {
        if (result.indexOf("{}") === -1) {
            throw new CommonError.InvariantError("not enough arguments were given during formatting.", details);
        }

        const arg: any = args.pop();
        result = result.replace("{}", arg);
    }

    if (args.length) {
        throw new CommonError.InvariantError("too many arguments were given during formatting.", details);
    }

    return result;
}
