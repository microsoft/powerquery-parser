// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import GraphemeSplitter = require('grapheme-splitter')
import { Option } from './option';
import { Pattern } from './patterns';

export namespace StringHelpers {

    export const graphemeSplitter: GraphemeSplitter = new GraphemeSplitter();

    export const enum NewlineKind {
        SingleCharacter = "SingleCharacter",
        DoubleCharacter = "DoubleCharacter", // CARRIAGE RETURN + LINE FEED
    }

    export interface GraphemePosition {
        readonly lineCodePoint: number,
        readonly lineNumber: number,
        readonly columnNumber: number,
    }

    export function containsNewline(str: string): boolean {
        const strLength = str.length;
        let containsNewline = false;

        for (let index = 0; index < strLength; index++) {
            if (maybeNewlineKindAt(str, index)) {
                containsNewline = true;
                break;
            }
        }
        return containsNewline
    }

    export function maybeNewlineKindAt(str: string, index: number): Option<NewlineKind> {
        if (maybeRegexMatchLength(Pattern.RegExpNewline, str, index)) {
            // test for CARRIAGE RETURN + LINE FEED
            if (str[index] === "\r" && str[index + 1] === "\n") {
                return NewlineKind.DoubleCharacter;
            }
            else {
                return NewlineKind.SingleCharacter;
            }
        }
        else {
            return undefined;
        }
    }

    export function maybeRegexMatchLength(pattern: RegExp, str: string, index: number): Option<number> {
        pattern.lastIndex = index;
        const matches = pattern.exec(str);

        if (!matches) {
            return undefined;
        }
        else {
            return matches[0].length;
        }
    }

}