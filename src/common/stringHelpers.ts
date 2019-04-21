import GraphemeSplitter = require('grapheme-splitter')
import { isNever } from './assert';
import { CommonError } from './error';
import { Option } from './option';
import { Pattern } from './patterns';

export namespace StringHelpers {

    export const graphemeSplitter: GraphemeSplitter = new GraphemeSplitter();

    export const enum NewlineKind {
        SingleCharacter = "SingleCharacter",
        DoubleCharacter = "DoubleCharacter", // CARRIAGE RETURN + LINE FEED
    }

    export interface GraphemePosition {
        readonly textIndex: number,
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

    export function graphemePositionAt(text: string, textIndex: number): GraphemePosition {
        if (textIndex > text.length) {
            throw new CommonError.InvariantError(`textIndex > text.length : ${textIndex} > ${text.length}`)
        }

        const graphemes = graphemeSplitter.iterateGraphemes(text);

        let tmpTextIndex = 0;
        let lineNumber = 1;
        let columnNumber = 1;
        for (const grapheme of graphemes) {
            if (tmpTextIndex >= textIndex) {
                if (tmpTextIndex === textIndex) {
                    return {
                        textIndex: textIndex,
                        lineNumber,
                        columnNumber,
                    };
                }
                else {
                    const details = {
                        lineNumber,
                        columnNumber,
                    }
                    throw new CommonError.InvariantError("tmpTextIndex should never be larger than textIndex", details);
                }
            }

            const maybeNewlineKind = maybeNewlineKindAt(grapheme, 0);
            if (maybeNewlineKind) {
                switch (maybeNewlineKind) {
                    case NewlineKind.DoubleCharacter:
                        tmpTextIndex += 2;
                        lineNumber += 1;
                        columnNumber = 1;
                        break;

                    case NewlineKind.SingleCharacter:
                        tmpTextIndex += 1;
                        lineNumber += 1;
                        columnNumber = 1;
                        break;

                    default:
                        isNever(maybeNewlineKind);
                        break;
                }
            }
            else {
                tmpTextIndex += grapheme.length;
                columnNumber += 1;
            }
        }

        const details = { textIndex }
        throw new CommonError.InvariantError("textIndex should've been found", details);
    }

}