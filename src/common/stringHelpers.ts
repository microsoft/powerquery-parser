import GraphemeSplitter = require('grapheme-splitter')
import { isNever } from './assert';
import { CommonError } from './error';
import { Option } from './option';
import { Pattern } from './patterns';

export namespace StringHelpers {

    export const enum NewlineKind {
        SingleCharacter = "SingleCharacter",
        DoubleCharacter = "DoubleCharacter", // CARRIAGE RETURN + LINE FEED
    }

    // columnNumber is by grapheme, not by code unit
    // starts lineNumber/columnNumber at 1
    export interface GraphemePosition {
        readonly characterCodeUnitIndex: number,
        readonly lineNumber: number;
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

    export function graphemePositionAt(document: string, characterCodeUnitIndex: number): GraphemePosition {
        if (characterCodeUnitIndex > document.length) {
            throw new CommonError.InvariantError(`characterCodeUnitIndex > document.length : ${characterCodeUnitIndex} > ${document.length}`)
        }

        const splitter: GraphemeSplitter = new GraphemeSplitter();
        const graphemes = splitter.iterateGraphemes(document);

        let documentIndex = 0;
        let lineNumber = 1;
        let columnNumber = 1;
        for (const grapheme of graphemes) {
            if (documentIndex >= characterCodeUnitIndex) {
                if (documentIndex === characterCodeUnitIndex) {
                    return {
                        characterCodeUnitIndex,
                        lineNumber,
                        columnNumber,
                    };
                }
                else {
                    const details = {
                        lineNumber,
                        columnNumber,
                    }
                    throw new CommonError.InvariantError("documentIndex should never be larger than characterCodeUnitIndex", details);
                }
            }

            const maybeNewlineKind = maybeNewlineKindAt(grapheme, 0);
            if (maybeNewlineKind) {
                switch (maybeNewlineKind) {
                    case NewlineKind.DoubleCharacter:
                        documentIndex += 2;
                        lineNumber += 1;
                        columnNumber = 1;
                        break;

                    case NewlineKind.SingleCharacter:
                        documentIndex += 1;
                        lineNumber += 1;
                        columnNumber = 1;
                        break;

                    default:
                        isNever(maybeNewlineKind);
                        break;
                }
            }
            else {
                documentIndex += grapheme.length;
                columnNumber += 1;
            }
        }

        const details = { characterCodeUnitIndex }
        throw new CommonError.InvariantError("characterCodeUnitIndex should've been found", details);
    }

}