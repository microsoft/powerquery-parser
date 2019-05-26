// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// tslint:disable-next-line: no-require-imports
import GraphemeSplitter = require("grapheme-splitter");
import { CommonError, Option, Pattern } from ".";

export const graphemeSplitter: GraphemeSplitter = new GraphemeSplitter();

export const enum NewlineKind {
    SingleCharacter = "SingleCharacter",
    DoubleCharacter = "DoubleCharacter", // CARRIAGE RETURN + LINE FEED
}
export interface GraphemePosition {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
    readonly columnNumber: number;
    readonly maybeCodeUnit: Option<number>;
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
    maybeCodeUnit: Option<number>,
): GraphemePosition {
    return {
        lineCodeUnit,
        lineNumber,
        columnNumber: columnNumberFrom(text, lineCodeUnit),
        maybeCodeUnit,
    };
}

export function maybeNewlineKindAt(text: string, index: number): Option<NewlineKind> {
    if (maybeRegexMatchLength(Pattern.RegExpNewline, text, index)) {
        // test for CARRIAGE RETURN + LINE FEED
        if (text[index] === "\r" && text[index + 1] === "\n") {
            return NewlineKind.DoubleCharacter;
        } else {
            return NewlineKind.SingleCharacter;
        }
    } else {
        return undefined;
    }
}

export function maybeRegexMatchLength(pattern: RegExp, text: string, index: number): Option<number> {
    pattern.lastIndex = index;
    const matches: RegExpExecArray | null = pattern.exec(text);

    if (!matches) {
        return undefined;
    } else {
        return matches[0].length;
    }
}
