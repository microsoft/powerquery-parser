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

    export interface GraphemeString {
        readonly blob: string,
        readonly graphemes: ReadonlyArray<string>,
        readonly documentIndex2GraphemeIndex: { [documentIndex: number]: number; }
        readonly graphemeIndex2DocumentIndex: { [graphemeIndex: number]: number; }
    }

    export interface GraphemePosition {
        readonly documentIndex: number,
        readonly lineNumber: number,
        readonly columnNumber: number,
    }

    export function graphemeDocument(blob: string): GraphemeString {
        const graphemes = StringHelpers.graphemeSplitter.splitGraphemes(blob);
        const numGraphemes = graphemes.length;
        const documentIndex2GraphemeIndex: { [documentIndex: number]: number; } = {};
        const graphemeIndex2DocumentIndex: { [graphemeIndex: number]: number; } = {};

        let summedCodeUnits = 0;
        for (let index = 0; index < numGraphemes; index++) {
            graphemeIndex2DocumentIndex[index] = summedCodeUnits;
            documentIndex2GraphemeIndex[summedCodeUnits] = index;
            summedCodeUnits += graphemes[index].length;
        }

        graphemeIndex2DocumentIndex[numGraphemes] = blob.length;
        documentIndex2GraphemeIndex[blob.length] = numGraphemes;

        return {
            blob,
            graphemes,
            documentIndex2GraphemeIndex,
            graphemeIndex2DocumentIndex
        }
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

    export function graphemePositionAt(document: string, documentIndex: number): GraphemePosition {
        if (documentIndex > document.length) {
            throw new CommonError.InvariantError(`documentIndex > document.length : ${documentIndex} > ${document.length}`)
        }

        const graphemes = graphemeSplitter.iterateGraphemes(document);

        let tmpDocumentIndex = 0;
        let lineNumber = 1;
        let columnNumber = 1;
        for (const grapheme of graphemes) {
            if (tmpDocumentIndex >= documentIndex) {
                if (tmpDocumentIndex === documentIndex) {
                    return {
                        documentIndex,
                        lineNumber,
                        columnNumber,
                    };
                }
                else {
                    const details = {
                        lineNumber,
                        columnNumber,
                    }
                    throw new CommonError.InvariantError("documentIndex should never be larger than documentIndex", details);
                }
            }

            const maybeNewlineKind = maybeNewlineKindAt(grapheme, 0);
            if (maybeNewlineKind) {
                switch (maybeNewlineKind) {
                    case NewlineKind.DoubleCharacter:
                        tmpDocumentIndex += 2;
                        lineNumber += 1;
                        columnNumber = 1;
                        break;

                    case NewlineKind.SingleCharacter:
                        tmpDocumentIndex += 1;
                        lineNumber += 1;
                        columnNumber = 1;
                        break;

                    default:
                        isNever(maybeNewlineKind);
                        break;
                }
            }
            else {
                tmpDocumentIndex += grapheme.length;
                columnNumber += 1;
            }
        }

        const details = { documentIndex }
        throw new CommonError.InvariantError("documentIndex should've been found", details);
    }

}