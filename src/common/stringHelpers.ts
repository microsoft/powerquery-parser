// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// tslint:disable-next-line: no-require-imports
import GraphemeSplitter = require("grapheme-splitter");
import { Option } from "./option";
import { Pattern } from "./patterns";

export const graphemeSplitter: GraphemeSplitter = new GraphemeSplitter();

export const enum NewlineKind {
    SingleCharacter = "SingleCharacter",
    DoubleCharacter = "DoubleCharacter", // CARRIAGE RETURN + LINE FEED
}

export interface GraphemePosition {
    readonly lineCodeUnit: number;
    readonly lineNumber: number;
    readonly columnNumber: number;
}

export interface ExtendedGraphemePosition extends GraphemePosition {
    readonly codeUnit: number;
}

export function maybeNewlineKindAt(str: string, index: number): Option<NewlineKind> {
    if (maybeRegexMatchLength(Pattern.RegExpNewline, str, index)) {
        // test for CARRIAGE RETURN + LINE FEED
        if (str[index] === "\r" && str[index + 1] === "\n") {
            return NewlineKind.DoubleCharacter;
        } else {
            return NewlineKind.SingleCharacter;
        }
    } else {
        return undefined;
    }
}

export function maybeRegexMatchLength(pattern: RegExp, str: string, index: number): Option<number> {
    pattern.lastIndex = index;
    const matches: RegExpExecArray | null = pattern.exec(str);

    if (!matches) {
        return undefined;
    } else {
        return matches[0].length;
    }
}
