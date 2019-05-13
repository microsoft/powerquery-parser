// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, isNever, Pattern, StringHelpers, Result, ResultKind } from "../common";
import { Option } from "../common/option";
import { PartialResult, PartialResultKind } from "../common/partialResult";
import { LexerError } from "./error";
import { Keyword } from "./keywords";
import { LineToken, LineTokenKind } from "./token";

// the lexer
//  * takes a mostly functional approach, plus a few throws to propagate errors
//  * splits up text by line terminator, allowing line-by-line lexing

// call Lexer.from to instantiate a state instance
// calls to lexer functions returns a new state object
// call Lexer.snapshot creates a frozen copy of a lexer state

export namespace Lexer {

    export type TErrorLines = { [lineNumber: number]: TErrorLine; }

    export type TLine = (
        | TouchedLine
        | UntouchedLine
        | TouchedWithErrorLine
        | ErrorLine
    )

    export type TErrorLine = (
        | ErrorLine
        | TouchedWithErrorLine
    )

    export const enum LineKind {
        Error = "Error",
        Touched = "Touched",
        TouchedWithError = "TouchedWithError",
        Untouched = "Untouched",
    }

    // there are two contexts for line tokenization:
    //  * tokenize the entire line as usual
    //  * the line is a contiuation of a multiline token, eg. `"foo \n bar"`
    //
    // comment, quoted identifier, and string are all multiline contexts
    export const enum LineMode {
        Comment = "Comment",
        Default = "Default",
        QuotedIdentifier = "QuotedIdentifier",
        String = "String",
    }

    export interface State {
        readonly lines: ReadonlyArray<TLine>,
    }

    export interface ILexerLine {
        readonly kind: LineKind,
        readonly text: string,
        readonly lineTerminator: string,
        readonly lineModeStart: LineMode,
        readonly lineModeEnd: LineMode,
        readonly tokens: ReadonlyArray<LineToken>,
    }

    // an extension to the string type, allows column numbering by using graphemes
    export interface LineString {
        readonly text: string,
        readonly graphemes: ReadonlyArray<string>,
        readonly textIndex2GraphemeIndex: { [textIndex: number]: number; }
        readonly graphemeIndex2TextIndex: { [graphemeIndex: number]: number; }
    }

    // an error was thrown immediately, nothing was tokenized
    export interface ErrorLine extends ILexerLine {
        readonly kind: LineKind.Error,
        readonly error: LexerError.TLexerError,
    }

    // the entire line was tokenized without issue
    export interface TouchedLine extends ILexerLine {
        readonly kind: LineKind.Touched,
    }

    // some tokens were read, but before eof was reached an error was thrown
    export interface TouchedWithErrorLine extends ILexerLine {
        readonly kind: LineKind.TouchedWithError,
        readonly error: LexerError.TLexerError,
    }

    // an line that has yet to be lexed
    export interface UntouchedLine extends ILexerLine {
        readonly kind: LineKind.Untouched,
    }

    export interface Range {
        readonly start: RangePosition,
        readonly end: RangePosition,
    }

    export interface RangePosition {
        readonly lineNumber: number,
        readonly lineCodeUnit: number,
    }

    export function stateFrom(text: string): State {
        const splitLines: ReadonlyArray<SplitLine> = splitOnLineTerminators(text);
        const tokenizedLines: TLine[] = tokenizedLinesFrom(splitLines, LineMode.Default);
        return { lines: tokenizedLines };
    }

    export function appendLine(state: State, text: string, lineTerminator: string): State {
        const lines = state.lines;
        const numLines = lines.length;
        const maybeLatestLine: Option<TLine> = lines[numLines - 1];

        let lineModeStart: LineMode = maybeLatestLine
            ? maybeLatestLine.lineModeEnd
            : LineMode.Default;

        let newLine: TLine = lineFrom(text, lineTerminator, lineModeStart)
        newLine = tokenize(newLine, numLines);

        return {
            ...state,
            lines: state.lines.concat(newLine),
        };
    }

    export function updateLine(
        state: State,
        lineNumber: number,
        text: string,
    ): Result<State, LexerError.LexerError> {
        const lines: ReadonlyArray<TLine> = state.lines;

        const maybeError: Option<LexerError.BadLineNumber> = maybeBadLineNumberError(
            lineNumber,
            lines,
        );
        if (maybeError) {
            return {
                kind: ResultKind.Err,
                error: new LexerError.LexerError(maybeError),
            };
        }

        const line: TLine = lines[lineNumber];
        const range: Range = rangeFrom(line, lineNumber);
        return updateRange(state, range, text);
    }

    export function updateRange(
        state: State,
        range: Range,
        text: string,
    ): Result<State, LexerError.LexerError> {
        const maybeError = maybeBadRangeError(state, range);
        if (maybeError) {
            return {
                kind: ResultKind.Err,
                error: new LexerError.LexerError(maybeError),
            };
        }

        // unsafe action:
        //      casting ReadonlyArray<SplitLine> to SplitLine[]
        // what I'm trying to avoid:
        //      the cost of properly casting, aka deep cloning the object
        // why it's safe:
        //      the array is generated for this function block,
        //      and it never leaves this function block.
        const splitLines: SplitLine[] = splitOnLineTerminators(text) as SplitLine[];

        const rangeStart: RangePosition = range.start;
        const textPrefix = state.lines[rangeStart.lineNumber].text.substr(0, rangeStart.lineCodeUnit);
        splitLines[0].text = textPrefix + splitLines[0].text;

        const rangeEnd: RangePosition = range.end;
        const textSuffix = state.lines[rangeEnd.lineNumber].text.substr(rangeEnd.lineCodeUnit + 1);
        const lastSplitLine: SplitLine = splitLines[splitLines.length - 1];
        lastSplitLine.text = lastSplitLine.text + textSuffix;

        const maybePreviousLine: Option<TLine> = state.lines[rangeStart.lineNumber - 1];
        const previousLineModeEnd = maybePreviousLine !== undefined
            ? maybePreviousLine.lineModeEnd
            : LineMode.Default;
        const newLines = tokenizedLinesFrom(splitLines, previousLineModeEnd);

        let lines: TLine[] = [
            ...state.lines.slice(0, rangeStart.lineNumber),
            ...newLines,
            ...retokenizeLines(
                state.lines,
                rangeEnd.lineNumber,
                newLines[newLines.length - 1].lineModeEnd,
            ),
        ]

        return {
            kind: ResultKind.Ok,
            value: {
                lines,
            }
        };
    }

    export function deleteLine(state: State, lineNumber: number): Result<State, LexerError.LexerError> {
        const lines: ReadonlyArray<TLine> = state.lines;

        const maybeError: Option<LexerError.BadLineNumber> = maybeBadLineNumberError(
            lineNumber,
            lines,
        );
        if (maybeError) {
            return {
                kind: ResultKind.Err,
                error: new LexerError.LexerError(maybeError),
            };
        }

        return {
            kind: ResultKind.Ok,
            value: {
                ...state,
                lines: [
                    ...lines.slice(0, lineNumber),
                    ...lines.slice(lineNumber + 1),
                ],
            }
        }
    }

    export function deleteRange(
        state: State,
        range: Range,
    ): Result<State, LexerError.LexerError> {
        const maybeError = maybeBadRangeError(state, range);
        if (maybeError) {
            return {
                kind: ResultKind.Err,
                error: new LexerError.LexerError(maybeError),
            };
        }


    }

    // deep state comparison
    export function equalStates(leftState: State, rightState: State): boolean {
        return equalLines(leftState.lines, rightState.lines);
    }

    // deep line comparison
    export function equalLines(leftLines: ReadonlyArray<TLine>, rightLines: ReadonlyArray<TLine>): boolean {
        if (leftLines.length !== rightLines.length) {
            return false;
        }

        const numLines = leftLines.length;
        for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
            const left = leftLines[lineIndex];
            const right = rightLines[lineIndex];
            const leftTokens = left.tokens;
            const rightTokens = right.tokens;

            const isEqualQuickCheck = (
                left.kind === right.kind
                && left.lineModeStart === right.lineModeStart
                && left.lineModeEnd === right.lineModeEnd
                && leftTokens.length === rightTokens.length
            );
            if (!isEqualQuickCheck) {
                return false;
            }

            // isNotEqualQuickCheck ensures tokens.length is the same
            const numTokens = leftTokens.length;
            for (let tokenIndex = 0; tokenIndex < numTokens; tokenIndex++) {
                if (!equalTokens(leftTokens[tokenIndex], rightTokens[tokenIndex])) {
                    return false;
                }
            }
        }

        return true;
    }

    // deep token comparison
    export function equalTokens(leftToken: LineToken, rightToken: LineToken): boolean {
        return (
            leftToken.kind === rightToken.kind
            && leftToken.data === rightToken.data
            && leftToken.positionStart === rightToken.positionStart
            && leftToken.positionEnd === rightToken.positionEnd
        );
    }

    export function isErrorState(state: State): boolean {
        const linesWithErrors: ReadonlyArray<ErrorLine | TouchedWithErrorLine> = state.lines.filter(isErrorLine);
        return linesWithErrors.length !== 0;
    }

    export function isErrorLine(line: TLine): line is TErrorLine {
        switch (line.kind) {
            case LineKind.Error:
            case LineKind.TouchedWithError:
                return true;

            case LineKind.Touched:
            case LineKind.Untouched:
                return false;

            default:
                throw isNever(line);
        }
    }

    export function maybeErrorLines(state: State): Option<TErrorLines> {
        const errorLines: TErrorLines = {};

        const lines = state.lines;
        const numLines = lines.length;
        let errorsExist = false;
        for (let index = 0; index < numLines; index++) {
            const line = lines[index];
            if (isErrorLine(line)) {
                errorLines[index] = line;
                errorsExist = true;
            }
        }

        return errorsExist
            ? errorLines
            : undefined;
    }

    interface TokenizeChanges {
        readonly tokens: ReadonlyArray<LineToken>,
        readonly lineModeEnd: LineMode,
    }

    interface LineModeAlteringRead {
        readonly token: LineToken,
        readonly lineMode: LineMode,
    }

    interface SplitLine {
        text: string,
        lineTerminator: string,
    }

    function splitOnLineTerminators(text: string): ReadonlyArray<SplitLine> {
        let lines: SplitLine[] = text
            .split("\r\n")
            .map((text: string) => {
                return {
                    text,
                    lineTerminator: "\r\n",
                }
            });
        const lineTerminators: ReadonlyArray<string> = [
            "\n",
            "\u2028",   // LINE SEPARATOR
            "\u2029",   // PARAGRAPH SEPARATOR
        ]

        let index = 0;
        while (index < lines.length) {
            let expandedIndex = false;

            for (let lineTerminator of lineTerminators) {
                const line = lines[index];
                const text = line.text;
                if (text.indexOf(lineTerminator) !== -1) {
                    expandedIndex = true;

                    const split = text
                        .split(lineTerminator)
                        .map((text: string) => {
                            return {
                                text,
                                lineTerminator,
                            }
                        });
                    split[split.length - 1].lineTerminator = line.lineTerminator;

                    lines = [
                        ...lines.slice(0, index),
                        ...split,
                        ...lines.slice(index + 1),
                    ]
                }
            }

            if (!expandedIndex) {
                index += 1;
            }
        }

        lines[lines.length - 1].lineTerminator = "";
        return lines
    }

    function lineFrom(text: string, lineTerminator: string, lineModeStart: LineMode): UntouchedLine {
        return {
            kind: LineKind.Untouched,
            text,
            lineTerminator,
            lineModeStart,
            lineModeEnd: LineMode.Default,
            tokens: [],
        };
    }

    function graphemePositionFrom(text: string, lineNumber: number, lineCodeUnit: number): StringHelpers.GraphemePosition {
        const graphemes: ReadonlyArray<string> = StringHelpers.graphemeSplitter.splitGraphemes(text);
        const numGraphemes = graphemes.length;

        let summedLength = 0;
        let maybeColumnNumber: Option<number>;
        for (let index = 0; index < numGraphemes; index += 1) {
            if (summedLength === lineCodeUnit) {
                maybeColumnNumber = index;
                break;
            }
            summedLength += graphemes[index].length;
        }

        if (maybeColumnNumber === undefined) {
            const details = {
                lineNumber,
                lineCodeUnit,
                text,
            }
            throw new CommonError.InvariantError("graphemePositionFrom failed to find the columnNumber", details);
        }
        const columnNumber = maybeColumnNumber;

        return {
            lineCodeUnit,
            lineNumber,
            columnNumber,
        }
    }

    // function lineFromLineString(lineString: LineString, lineModeStart: LineMode): UntouchedLine {
    //     return {
    //         kind: LineKind.Untouched,
    //         lineString,
    //         lineModeStart,
    //         lineModeEnd: LineMode.Default,
    //         tokens: [],
    //     };
    // }

    function lineStringFrom(text: string): LineString {
        const graphemes = StringHelpers.graphemeSplitter.splitGraphemes(text);
        const numGraphemes = graphemes.length;
        const textIndex2GraphemeIndex: { [textIndex: number]: number; } = {};
        const graphemeIndex2TextIndex: { [graphemeIndex: number]: number; } = {};

        let summedCodeUnits = 0;
        for (let index = 0; index < numGraphemes; index++) {
            graphemeIndex2TextIndex[index] = summedCodeUnits;
            textIndex2GraphemeIndex[summedCodeUnits] = index;
            summedCodeUnits += graphemes[index].length;
        }

        graphemeIndex2TextIndex[numGraphemes] = text.length;
        textIndex2GraphemeIndex[text.length] = numGraphemes;

        return {
            text,
            graphemes,
            textIndex2GraphemeIndex,
            graphemeIndex2TextIndex
        }
    }

    function rangeFrom(line: TLine, lineNumber: number): Range {
        return {
            start: {
                lineNumber,
                lineCodeUnit: 0,
            },
            end: {
                lineNumber,
                lineCodeUnit: line.text.length - 1,
            }
        }
    }

    // takes the return from a tokenizeX function to updates the line's state
    function updateLineState(
        line: TLine,
        tokenizePartialResult: PartialResult<TokenizeChanges, LexerError.TLexerError>,
    ): TLine {
        switch (tokenizePartialResult.kind) {
            case PartialResultKind.Ok: {
                const tokenizeChanges: TokenizeChanges = tokenizePartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = line.tokens.concat(tokenizeChanges.tokens);

                return {
                    kind: LineKind.Touched,
                    text: line.text,
                    lineTerminator: line.lineTerminator,
                    lineModeStart: line.lineModeStart,
                    lineModeEnd: tokenizeChanges.lineModeEnd,
                    tokens: newTokens,
                }
            }

            case PartialResultKind.Partial: {
                const tokenizeChanges: TokenizeChanges = tokenizePartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = line.tokens.concat(tokenizeChanges.tokens);

                return {
                    kind: LineKind.TouchedWithError,
                    text: line.text,
                    lineTerminator: line.lineTerminator,
                    lineModeStart: line.lineModeStart,
                    lineModeEnd: tokenizeChanges.lineModeEnd,
                    tokens: newTokens,
                    error: tokenizePartialResult.error,
                }
            }

            case PartialResultKind.Err:
                return {
                    kind: LineKind.Error,
                    text: line.text,
                    lineModeStart: line.lineModeStart,
                    lineTerminator: line.lineTerminator,
                    lineModeEnd: line.lineModeEnd,
                    tokens: line.tokens,
                    error: tokenizePartialResult.error,
                }

            default:
                throw isNever(tokenizePartialResult);
        }
    }

    function tokenizedLinesFrom(splitLines: ReadonlyArray<SplitLine>, previousLineModeEnd: LineMode) {
        const numLines = splitLines.length;
        const tokenizedLines: TLine[] = [];

        for (let lineNumber = 0; lineNumber < numLines; lineNumber += 1) {
            const splitLine: SplitLine = splitLines[lineNumber];
            const untokenizedLine = lineFrom(splitLine.text, splitLine.lineTerminator, previousLineModeEnd);
            const tokenizedLine = tokenize(untokenizedLine, lineNumber);
            tokenizedLines.push(tokenizedLine);
            previousLineModeEnd = tokenizedLine.lineModeEnd;
        }

        return tokenizedLines;
    }

    // If an earlier line changed its lineModeEnd, eg. inserting a multiline line comment start,
    // then the proceeding tokens would need to be retokenized.
    // Exits when previous.lineModeEnd !== current.lineModeStart.
    function retokenizeLines(
        lines: ReadonlyArray<TLine>,
        lineNumber: number,
        previousLineModeEnd: LineMode,
    ): ReadonlyArray<TLine> {
        const retokenizedLines: TLine[] = [];

        if (previousLineModeEnd !== lines[lineNumber].lineModeStart) {
            let offsetLineNumber: number = lineNumber;
            let maybeCurrentLine: Option<TLine> = lines[lineNumber];

            while (maybeCurrentLine) {
                const line: TLine = maybeCurrentLine;

                if (previousLineModeEnd !== line.lineModeStart) {
                    const untokenizedLine: UntouchedLine = lineFrom(line.text, line.lineTerminator, previousLineModeEnd);
                    const retokenizedLine: TLine = tokenize(untokenizedLine, offsetLineNumber);
                    retokenizedLines.push(retokenizedLine);
                    previousLineModeEnd = retokenizedLine.lineModeEnd;
                    lineNumber += 1;
                    maybeCurrentLine = lines[lineNumber];
                }
                else {
                    return [
                        ...retokenizedLines,
                        ...lines.slice(lineNumber + 1),
                    ]
                }

            }

            return retokenizedLines;
        }
        else {
            return lines;
        }
    }

    // the main function of the lexer's tokenizer
    function tokenize(line: TLine, lineNumber: number): TLine {
        switch (line.kind) {
            // cannot tokenize something that ended with an error,
            // nothing has changed since the last tokenize.
            // update the line's text before trying again.
            case LineKind.Error:
                return line;

            case LineKind.Touched:
                // the line was already fully lexed once.
                // without any text changes it should throw eof to help diagnose
                // why it's trying to re-tokenize
                return {
                    ...line,
                    kind: LineKind.Error,
                    error: new LexerError.LexerError(new LexerError.EndOfStreamError()),
                }

            // cannot tokenize something that ended with an error,
            // nothing has changed since the last tokenize.
            // update the line's text before trying again.
            case LineKind.TouchedWithError:
                return {
                    kind: LineKind.Error,
                    text: line.text,
                    lineTerminator: line.lineTerminator,
                    lineModeStart: line.lineModeStart,
                    lineModeEnd: line.lineModeEnd,
                    tokens: line.tokens,
                    error: new LexerError.LexerError(new LexerError.BadStateError(line.error)),
                };
        }

        const untouchedLine: UntouchedLine = line;
        const text = untouchedLine.text;
        const textLength = text.length;

        // sanity check that there's something to tokenize
        if (textLength === 0) {
            return {
                kind: LineKind.Touched,
                text: line.text,
                lineTerminator: line.lineTerminator,
                lineModeStart: line.lineModeStart,
                lineModeEnd: LineMode.Default,
                tokens: [],
            }
        }

        let lineMode: LineMode = line.lineModeStart;
        let currentPosition: number = 0;

        if (lineMode === LineMode.Default) {
            currentPosition = drainWhitespace(text, currentPosition);
        }

        const newTokens: LineToken[] = [];
        let continueLexing = true;
        let maybeError: Option<LexerError.TLexerError>;

        // while neither eof or having encountered an error:
        //  * lex according to lineMode, starting from currentPosition
        //  * update currentPosition and lineMode
        //  * drain whitespace
        while (continueLexing) {
            try {
                let readOutcome: LineModeAlteringRead;
                switch (lineMode) {
                    case LineMode.Comment:
                        readOutcome = tokenizeMultilineCommentContentOrEnd(line, currentPosition);
                        break;

                    case LineMode.Default:
                        readOutcome = tokenizeDefault(line, lineNumber, currentPosition);
                        break;

                    case LineMode.QuotedIdentifier:
                        readOutcome = tokenizeQuotedIdentifierContentOrEnd(line, currentPosition);
                        break;

                    case LineMode.String:
                        readOutcome = tokenizeStringLiteralContentOrEnd(line, currentPosition);
                        break;

                    default:
                        throw isNever(lineMode);
                }

                lineMode = readOutcome.lineMode;
                const token = readOutcome.token;
                newTokens.push(token);

                if (lineMode === LineMode.Default) {
                    currentPosition = drainWhitespace(text, token.positionEnd);
                }
                else {
                    currentPosition = token.positionEnd;
                }

                if (currentPosition === textLength) {
                    continueLexing = false;
                }
            }
            catch (e) {
                let error: LexerError.TLexerError;
                if (LexerError.isTInnerLexerError(e)) {
                    error = new LexerError.LexerError(e);
                }
                else {
                    error = CommonError.ensureCommonError(e);
                }
                continueLexing = false;
                maybeError = error;
            }
        }

        let partialTokenizeResult: PartialResult<TokenizeChanges, LexerError.TLexerError>;
        if (maybeError) {
            if (newTokens.length) {
                partialTokenizeResult = {
                    kind: PartialResultKind.Partial,
                    value: {
                        tokens: newTokens,
                        lineModeEnd: lineMode,
                    },
                    error: maybeError,
                };
            }
            else {
                partialTokenizeResult = {
                    kind: PartialResultKind.Err,
                    error: maybeError,
                }
            }
        }
        else {
            partialTokenizeResult = {
                kind: PartialResultKind.Ok,
                value: {
                    tokens: newTokens,
                    lineModeEnd: lineMode,
                }
            }
        }

        return updateLineState(line, partialTokenizeResult);
    }

    // read either "*/" or eof
    function tokenizeMultilineCommentContentOrEnd(
        line: TLine,
        positionStart: number,
    ): LineModeAlteringRead {
        const text: string = line.text;
        const indexOfCloseComment = text.indexOf("*/", positionStart);

        if (indexOfCloseComment === -1) {
            return {
                token: readRestOfLine(LineTokenKind.MultilineCommentContent, text, positionStart),
                lineMode: LineMode.Comment,
            };
        }
        else {
            const positionEnd = indexOfCloseComment + 2;
            return {
                token: readTokenFrom(LineTokenKind.MultilineCommentEnd, text, positionStart, positionEnd),
                lineMode: LineMode.Default,
            }
        }
    }

    // read either string literal end or eof
    function tokenizeQuotedIdentifierContentOrEnd(
        line: TLine,
        currentPosition: number,
    ): LineModeAlteringRead {
        const read = tokenizeStringLiteralContentOrEnd(line, currentPosition);
        switch (read.token.kind) {
            case LineTokenKind.StringLiteralContent:
                return {
                    lineMode: LineMode.QuotedIdentifier,
                    token: {
                        ...read.token,
                        kind: LineTokenKind.QuotedIdentifierContent,
                    }
                };

            case LineTokenKind.StringLiteralEnd:
                return {
                    lineMode: LineMode.Default,
                    token: {
                        ...read.token,
                        kind: LineTokenKind.QuotedIdentifierEnd,
                    }
                };

            default:
                const details = { read };
                throw new CommonError.InvariantError("tokenizeStringLiteralContentOrEnd returned an unexpected kind", details);
        }
    }

    // read either string literal end or eof
    function tokenizeStringLiteralContentOrEnd(
        line: TLine,
        currentPosition: number,
    ): LineModeAlteringRead {
        const text: string = line.text;
        const maybePositionEnd: Option<number> = maybeIndexOfStringEnd(text, currentPosition);

        if (maybePositionEnd === undefined) {
            return {
                token: readRestOfLine(LineTokenKind.StringLiteralContent, text, currentPosition),
                lineMode: LineMode.String,
            }
        }
        else {
            const positionEnd: number = maybePositionEnd + 1;
            return {
                token: readTokenFrom(LineTokenKind.StringLiteralEnd, text, currentPosition, positionEnd),
                lineMode: LineMode.Default,
            }
        }
    }

    function tokenizeDefault(line: TLine, lineNumber: number, positionStart: number): LineModeAlteringRead {
        const text: string = line.text;

        const chr1: string = text[positionStart];
        let token: LineToken;
        let lineMode = LineMode.Default;

        if (chr1 === "!") { token = readConstant(LineTokenKind.Bang, text, positionStart, 1); }
        else if (chr1 === "&") { token = readConstant(LineTokenKind.Ampersand, text, positionStart, 1); }
        else if (chr1 === "(") { token = readConstant(LineTokenKind.LeftParenthesis, text, positionStart, 1); }
        else if (chr1 === ")") { token = readConstant(LineTokenKind.RightParenthesis, text, positionStart, 1); }
        else if (chr1 === "*") { token = readConstant(LineTokenKind.Asterisk, text, positionStart, 1); }
        else if (chr1 === "+") { token = readConstant(LineTokenKind.Plus, text, positionStart, 1); }
        else if (chr1 === ",") { token = readConstant(LineTokenKind.Comma, text, positionStart, 1); }
        else if (chr1 === "-") { token = readConstant(LineTokenKind.Minus, text, positionStart, 1); }
        else if (chr1 === ";") { token = readConstant(LineTokenKind.Semicolon, text, positionStart, 1); }
        else if (chr1 === "?") { token = readConstant(LineTokenKind.QuestionMark, text, positionStart, 1); }
        else if (chr1 === "@") { token = readConstant(LineTokenKind.AtSign, text, positionStart, 1); }
        else if (chr1 === "[") { token = readConstant(LineTokenKind.LeftBracket, text, positionStart, 1); }
        else if (chr1 === "]") { token = readConstant(LineTokenKind.RightBracket, text, positionStart, 1); }
        else if (chr1 === "{") { token = readConstant(LineTokenKind.LeftBrace, text, positionStart, 1); }
        else if (chr1 === "}") { token = readConstant(LineTokenKind.RightBrace, text, positionStart, 1); }

        else if (chr1 === "\"") {
            const read: LineModeAlteringRead = readStringLiteralOrStart(text, positionStart);
            token = read.token;
            lineMode = read.lineMode;
        }

        else if (chr1 === "0") {
            const chr2 = text[positionStart + 1];

            if (chr2 === "x" || chr2 === "X") { token = readHexLiteral(text, lineNumber, positionStart); }
            else { token = readNumericLiteral(text, lineNumber, positionStart); }
        }

        else if ("1" <= chr1 && chr1 <= "9") { token = readNumericLiteral(text, lineNumber, positionStart); }

        else if (chr1 === ".") {
            const chr2 = text[positionStart + 1];

            if (chr2 === undefined) {
                throw new LexerError.UnexpectedEofError(graphemePositionFrom(text, lineNumber, positionStart));
            }
            else if ("1" <= chr2 && chr2 <= "9") { token = readNumericLiteral(text, lineNumber, positionStart); }
            else if (chr2 === ".") {
                const chr3 = text[positionStart + 2];

                if (chr3 === ".") { token = readConstant(LineTokenKind.Ellipsis, text, positionStart, 3); }
                else { throw unexpectedReadError(text, lineNumber, positionStart) }
            }
            else { throw unexpectedReadError(text, lineNumber, positionStart) }
        }

        else if (chr1 === ">") {
            const chr2 = text[positionStart + 1];

            if (chr2 === "=") { token = readConstant(LineTokenKind.GreaterThanEqualTo, text, positionStart, 2); }
            else { token = readConstant(LineTokenKind.GreaterThan, text, positionStart, 1); }
        }

        else if (chr1 === "<") {
            const chr2 = text[positionStart + 1];

            if (chr2 === "=") { token = readConstant(LineTokenKind.LessThanEqualTo, text, positionStart, 2); }
            else if (chr2 === ">") { token = readConstant(LineTokenKind.NotEqual, text, positionStart, 2); }
            else { token = readConstant(LineTokenKind.LessThan, text, positionStart, 1) }
        }

        else if (chr1 === "=") {
            const chr2 = text[positionStart + 1];

            if (chr2 === ">") { token = readConstant(LineTokenKind.FatArrow, text, positionStart, 2); }
            else { token = readConstant(LineTokenKind.Equal, text, positionStart, 1); }
        }

        else if (chr1 === "/") {
            const chr2 = text[positionStart + 1];

            if (chr2 === "/") { token = readLineComment(text, positionStart); }
            else if (chr2 === "*") {
                const read: LineModeAlteringRead = readMultilineCommentOrStartStart(text, positionStart);
                token = read.token;
                lineMode = read.lineMode;
            }
            else { token = readConstant(LineTokenKind.Division, text, positionStart, 1); }
        }

        else if (chr1 === "#") {
            const chr2 = text[positionStart + 1];

            if (chr2 === "\"") {
                const read: LineModeAlteringRead = readQuotedIdentifierOrStart(text, positionStart);
                token = read.token;
                lineMode = read.lineMode;
            }
            else { token = readKeyword(text, lineNumber, positionStart); }
        }

        else { token = readKeywordOrIdentifier(text, lineNumber, positionStart); }

        return {
            token,
            lineMode,
        };
    }

    function drainWhitespace(
        text: string,
        position: number,
    ): number {
        let continueDraining = text[position] !== undefined;

        while (continueDraining) {
            const maybeLength = StringHelpers.maybeRegexMatchLength(Pattern.RegExpWhitespace, text, position);
            if (maybeLength) {
                position += maybeLength;
            }
            else {
                continueDraining = false;
            }
        }

        return position;
    }

    function readStringLiteralOrStart(
        text: string,
        currentPosition: number,
    ): LineModeAlteringRead {
        const maybePositionEnd: Option<number> = maybeIndexOfStringEnd(text, currentPosition + 1);
        if (maybePositionEnd !== undefined) {
            const positionEnd: number = maybePositionEnd + 1;
            return {
                token: readTokenFrom(LineTokenKind.StringLiteral, text, currentPosition, positionEnd),
                lineMode: LineMode.Default,
            };
        }
        else {
            return {
                token: readRestOfLine(LineTokenKind.StringLiteralStart, text, currentPosition),
                lineMode: LineMode.String,
            }
        }
    }

    function readHexLiteral(
        text: string,
        lineNumber: number,
        positionStart: number,
    ): LineToken {
        const maybePositionEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpHex, text, positionStart);
        if (maybePositionEnd === undefined) {
            throw new LexerError.ExpectedHexLiteralError(graphemePositionFrom(text, lineNumber, positionStart));
        }
        const positionEnd: number = maybePositionEnd;

        return readTokenFrom(LineTokenKind.HexLiteral, text, positionStart, positionEnd);
    }

    function readNumericLiteral(
        text: string,
        lineNumber: number,
        positionStart: number,
    ): LineToken {
        const maybePositionEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpNumeric, text, positionStart);
        if (maybePositionEnd === undefined) {
            throw new LexerError.ExpectedNumericLiteralError(graphemePositionFrom(text, lineNumber, positionStart));
        }
        const positionEnd: number = maybePositionEnd;

        return readTokenFrom(LineTokenKind.NumericLiteral, text, positionStart, positionEnd);
    }

    function readLineComment(
        text: string,
        positionStart: number,
    ): LineToken {
        return readRestOfLine(LineTokenKind.LineComment, text, positionStart);
    }

    function readMultilineCommentOrStartStart(
        text: string,
        positionStart: number,
    ): LineModeAlteringRead {
        const indexOfCloseComment = text.indexOf("*/", positionStart);
        if (indexOfCloseComment === -1) {
            return {
                token: readRestOfLine(LineTokenKind.MultilineCommentStart, text, positionStart),
                lineMode: LineMode.Comment,
            }
        }
        else {
            const positionEnd = indexOfCloseComment + 2;
            return {
                token: readTokenFrom(LineTokenKind.MultilineComment, text, positionStart, positionEnd),
                lineMode: LineMode.Default,
            }
        }
    }

    function readKeyword(
        text: string,
        lineNumber: number,
        positionStart: number,
    ): LineToken {
        const maybeLineToken: Option<LineToken> = maybeReadKeyword(text, positionStart);
        if (maybeLineToken) {
            return maybeLineToken;
        }
        else {
            throw unexpectedReadError(text, lineNumber, positionStart);
        }
    }

    function maybeReadKeyword(
        text: string,
        currentPosition: number,
    ): Option<LineToken> {
        const identifierPositionStart = text[currentPosition] === "#"
            ? currentPosition + 1
            : currentPosition;

        const maybeIdentifierPositionEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, identifierPositionStart);
        if (maybeIdentifierPositionEnd === undefined) {
            return undefined;
        }
        const identifierPositionEnd: number = maybeIdentifierPositionEnd;

        const data = text.substring(currentPosition, identifierPositionEnd);
        const maybeKeywordTokenKind = maybeKeywordLineTokenKindFrom(data);
        if (maybeKeywordTokenKind === undefined) {
            return undefined;
        }
        else {
            return {
                kind: maybeKeywordTokenKind,
                positionStart: currentPosition,
                positionEnd: identifierPositionEnd,
                data,
            }
        }
    }

    function readQuotedIdentifierOrStart(
        text: string,
        currentPosition: number,
    ): LineModeAlteringRead {
        const maybePositionEnd: Option<number> = maybeIndexOfStringEnd(text, currentPosition + 2);
        if (maybePositionEnd !== undefined) {
            const positionEnd: number = maybePositionEnd + 1;

            return {
                token: readTokenFrom(LineTokenKind.Identifier, text, currentPosition, positionEnd),
                lineMode: LineMode.Default,
            };
        }
        else {
            return {
                token: readRestOfLine(LineTokenKind.QuotedIdentifierStart, text, currentPosition),
                lineMode: LineMode.QuotedIdentifier,
            }
        }
    }

    // the quoted identifier case has already been taken care of
    // null-literal is also read here
    function readKeywordOrIdentifier(
        text: string,
        lineNumber: number,
        positionStart: number,
    ): LineToken {
        // keyword
        if (text[positionStart] === "#") {
            return readKeyword(text, lineNumber, positionStart);
        }
        // either keyword or identifier
        else {
            const maybePositionEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, positionStart);
            if (maybePositionEnd === undefined) {
                throw unexpectedReadError(text, lineNumber, positionStart);
            }
            const positionEnd: number = maybePositionEnd;
            const data = text.substring(positionStart, positionEnd);
            const maybeKeywordTokenKind: Option<LineTokenKind> = maybeKeywordLineTokenKindFrom(data);

            let tokenKind;
            if (maybeKeywordTokenKind !== undefined) {
                tokenKind = maybeKeywordTokenKind;
            }
            else if (data === "null") {
                tokenKind = LineTokenKind.NullLiteral;
            }
            else {
                tokenKind = LineTokenKind.Identifier;
            }

            return {
                kind: tokenKind,
                positionStart,
                positionEnd,
                data,
            }
        }
    }

    function readConstant(
        lineTokenKind: LineTokenKind,
        text: string,
        positionStart: number,
        length: number,
    ): LineToken {
        const positionEnd = positionStart + length;
        return readTokenFrom(lineTokenKind, text, positionStart, positionEnd);
    }

    function readTokenFrom(
        lineTokenKind: LineTokenKind,
        text: string,
        positionStart: number,
        positionEnd: number,
    ): LineToken {
        return {
            kind: lineTokenKind,
            positionStart,
            positionEnd,
            data: text.substring(positionStart, positionEnd),
        };
    }

    function readRestOfLine(
        lineTokenKind: LineTokenKind,
        text: string,
        positionStart: number,
    ): LineToken {
        const positionEnd = text.length;
        return readTokenFrom(lineTokenKind, text, positionStart, positionEnd);
    }

    function maybeIndexOfRegexEnd(
        pattern: RegExp,
        text: string,
        textIndex: number,
    ): Option<number> {
        const maybeLength = StringHelpers.maybeRegexMatchLength(pattern, text, textIndex);

        return maybeLength !== undefined
            ? textIndex + maybeLength
            : undefined;
    }

    function maybeKeywordLineTokenKindFrom(data: string): Option<LineTokenKind> {
        switch (data) {
            case Keyword.And:
                return LineTokenKind.KeywordAnd;
            case Keyword.As:
                return LineTokenKind.KeywordAs;
            case Keyword.Each:
                return LineTokenKind.KeywordEach;
            case Keyword.Else:
                return LineTokenKind.KeywordElse;
            case Keyword.Error:
                return LineTokenKind.KeywordError;
            case Keyword.False:
                return LineTokenKind.KeywordFalse;
            case Keyword.If:
                return LineTokenKind.KeywordIf;
            case Keyword.In:
                return LineTokenKind.KeywordIn;
            case Keyword.Is:
                return LineTokenKind.KeywordIs;
            case Keyword.Let:
                return LineTokenKind.KeywordLet;
            case Keyword.Meta:
                return LineTokenKind.KeywordMeta;
            case Keyword.Not:
                return LineTokenKind.KeywordNot;
            case Keyword.Or:
                return LineTokenKind.KeywordOr;
            case Keyword.Otherwise:
                return LineTokenKind.KeywordOtherwise;
            case Keyword.Section:
                return LineTokenKind.KeywordSection;
            case Keyword.Shared:
                return LineTokenKind.KeywordShared;
            case Keyword.Then:
                return LineTokenKind.KeywordThen;
            case Keyword.True:
                return LineTokenKind.KeywordTrue;
            case Keyword.Try:
                return LineTokenKind.KeywordTry;
            case Keyword.Type:
                return LineTokenKind.KeywordType;
            case Keyword.HashBinary:
                return LineTokenKind.KeywordHashBinary;
            case Keyword.HashDate:
                return LineTokenKind.KeywordHashDate;
            case Keyword.HashDateTime:
                return LineTokenKind.KeywordHashDateTime;
            case Keyword.HashDateTimeZone:
                return LineTokenKind.KeywordHashDateTimeZone;
            case Keyword.HashDuration:
                return LineTokenKind.KeywordHashDuration;
            case Keyword.HashInfinity:
                return LineTokenKind.KeywordHashInfinity;
            case Keyword.HashNan:
                return LineTokenKind.KeywordHashNan;
            case Keyword.HashSections:
                return LineTokenKind.KeywordHashSections;
            case Keyword.HashShared:
                return LineTokenKind.KeywordHashShared;
            case Keyword.HashTable:
                return LineTokenKind.KeywordHashTable;
            case Keyword.HashTime:
                return LineTokenKind.KeywordHashTime;
            default:
                return undefined;
        }
    }

    function maybeIndexOfStringEnd(
        text: string,
        positionStart: number,
    ): Option<number> {
        let indexLow = positionStart;
        let positionEnd = text.indexOf("\"", indexLow)

        while (positionEnd !== -1) {
            if (text[positionEnd + 1] === "\"") {
                indexLow = positionEnd + 2;
                positionEnd = text.indexOf("\"", indexLow);
            }
            else {
                return positionEnd;
            }
        }

        return undefined;
    }

    function unexpectedReadError(
        text: string,
        lineNumber: number,
        lineCodeUnit: number,
    ): LexerError.UnexpectedReadError {
        return new LexerError.UnexpectedReadError(graphemePositionFrom(text, lineNumber, lineCodeUnit));
    }

    function maybeBadLineNumberError(
        lineNumber: number,
        lines: ReadonlyArray<TLine>,
    ): Option<LexerError.BadLineNumber> {
        const numLines = lines.length;
        if (lineNumber >= numLines) {
            return new LexerError.BadLineNumber(
                LexerError.BadLineNumberKind.GreaterThanNumLines,
                lineNumber,
                numLines,
            );
        }
        else if (lineNumber < 0) {
            return new LexerError.BadLineNumber(
                LexerError.BadLineNumberKind.LessThanZero,
                lineNumber,
                numLines,
            );
        }
        else {
            return undefined;
        }
    }

    function maybeBadRangeError(state: State, range: Range): Option<LexerError.BadRangeError> {
        const start: RangePosition = range.start;
        const end: RangePosition = range.end;
        const numLines = state.lines.length;

        let maybeKind: Option<LexerError.BadRangeKind>;
        if (start.lineNumber === end.lineNumber && start.lineCodeUnit > end.lineCodeUnit) {
            maybeKind = LexerError.BadRangeKind.SameLine_LineCodeUnitStart_Higher;
        }
        else if (start.lineNumber > end.lineNumber) {
            maybeKind = LexerError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd;
        }
        else if (start.lineNumber < 0) {
            maybeKind = LexerError.BadRangeKind.LineNumberStart_LessThan_Zero;
        }
        else if (start.lineNumber >= numLines) {
            maybeKind = LexerError.BadRangeKind.LineNumberStart_GreaterThan_NumLines;
        }
        else if (end.lineNumber >= numLines) {
            maybeKind = LexerError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines;
        }

        if (maybeKind) {
            const kind: LexerError.BadRangeKind = maybeKind;
            return new LexerError.BadRangeError(range, kind);
        }

        const lines: ReadonlyArray<TLine> = state.lines;
        const rangeStart: RangePosition = range.start;
        const rangeEnd: RangePosition = range.end;

        const lineStart: TLine = lines[rangeStart.lineNumber];
        const lineEnd: TLine = lines[rangeEnd.lineNumber];

        if (rangeStart.lineCodeUnit >= lineStart.text.length) {
            maybeKind = LexerError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength;
        }
        else if (rangeEnd.lineCodeUnit >= lineEnd.text.length) {
            maybeKind = LexerError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength;
        }

        if (maybeKind) {
            return new LexerError.BadRangeError(range, maybeKind);
        }

        return undefined;
    }

}
