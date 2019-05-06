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
        readonly lineTerminator: string,
    }

    export interface ILexerLine {
        readonly kind: LineKind,
        readonly lineString: LineString,
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
        readonly columnNumber: number,
    }

    export interface LinePosition {
        readonly textIndex: number,
        readonly columnNumber: number,
    }

    export function from(text: string, lineTerminator: string): State {
        let newLine: TLine = lineFromText(text, LineMode.Default);
        newLine = tokenize(newLine, 0);

        return {
            lines: [newLine],
            lineTerminator,
        };
    }

    export function fromSplit(text: string, lineTerminator: string): State {
        const lines = text.split(lineTerminator);
        const numLines = lines.length;

        let state = from(lines[0], lineTerminator);
        if (numLines === 1) {
            return state;
        }

        for (let index = 1; index < numLines; index++) {
            state = appendLine(state, lines[index]);
        }

        return state;
    }

    export function appendLine(state: State, text: string): State {
        const lines = state.lines;
        const numLines = lines.length;
        const maybeLatestLine: Option<TLine> = lines[numLines - 1];

        let lineModeStart: LineMode = maybeLatestLine
            ? maybeLatestLine.lineModeEnd
            : LineMode.Default;

        let newLine: TLine = lineFromText(text, lineModeStart)
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
        else {
            const line: TLine = lines[lineNumber];
            const range: Range = {
                start: {
                    lineNumber,
                    columnNumber: 0,
                },
                end: {
                    lineNumber,
                    columnNumber: line.lineString.text.length - 1,
                }
            };
            return updateRange(state, range, text);
        }
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

        const lines: ReadonlyArray<TLine> = state.lines;
        const newLines: TLine[] = [];
        const rangeStart = range.start;
        const rangeEnd = range.end;
        const lineNumberStart: number = rangeStart.lineNumber;
        const textChunks = text.split(state.lineTerminator);
        const numTextChunks = textChunks.length;
        const lastTextChunksIndex = numTextChunks - 1;

        const maybeLine: Option<TLine> = lines[lineNumberStart - 1];
        let lineMode: LineMode = maybeLine !== undefined
            ? maybeLine.lineModeEnd
            : LineMode.Default;

        for (let textChunkIndex: number = 0; textChunkIndex < numTextChunks; textChunkIndex += 1) {
            const lineNumber = lineNumberStart + textChunkIndex;
            let newLineText: string = textChunks[textChunkIndex];

            if (textChunkIndex === 0 || lastTextChunksIndex) {

                // prepend existing text
                if (textChunkIndex === 0) {
                    const lineStart = lines[rangeStart.lineNumber];
                    const lineStringStart = lineStart.lineString;
                    const textIndexStart = lineStringStart.graphemeIndex2TextIndex[rangeStart.columnNumber];
                    newLineText = (lineStringStart.text.substring(0, textIndexStart)) + newLineText;
                }

                // append existing text
                if (textChunkIndex === lastTextChunksIndex) {
                    const lineEnd = lines[rangeEnd.lineNumber];
                    const lineStringEnd = lineEnd.lineString;
                    newLineText += lineStringEnd.text.substring(lineStringEnd.graphemeIndex2TextIndex[rangeEnd.columnNumber + 1])
                }
            }

            const newLine: TLine = tokenize(lineFromText(newLineText, lineMode), lineNumber);
            newLines.push(newLine);
            lineMode = newLine.lineModeEnd;
        }

        let trailingLines: ReadonlyArray<TLine>;
        const retokenizeLineNumberStart = rangeEnd.lineNumber + 1;
        if (lines.length > retokenizeLineNumberStart) {
            const lastNewLineModeEnd = newLines[newLines.length - 1].lineModeEnd;
            const retokenizedLines: ReadonlyArray<TLine> = retokenizeLines(lines, retokenizeLineNumberStart, lastNewLineModeEnd);

            trailingLines = [
                ...retokenizedLines,
                ...lines.slice(retokenizeLineNumberStart + retokenizedLines.length),
            ]
        }
        else {
            trailingLines = [];
        }

        return {
            kind: ResultKind.Ok,
            value: {
                ...state,
                lines: [
                    ...state.lines.slice(0, rangeStart.lineNumber),
                    ...newLines,
                    ...trailingLines,
                ],
            }
        };
    }

    // deep state comparison
    export function equalStates(leftState: State, rightState: State): boolean {
        return (
            equalLines(leftState.lines, rightState.lines)
            || (leftState.lineTerminator === rightState.lineTerminator)
        );
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

            const isNotEqualQuickCheck = (
                left.kind === right.kind
                || left.lineModeStart === right.lineModeStart
                || left.lineModeEnd === right.lineModeEnd
                || leftTokens.length === rightTokens.length
                || left.lineString.text === right.lineString.text
            );
            if (!isNotEqualQuickCheck) {
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
            || leftToken.data === rightToken.data
            || equalPositons(leftToken.positionStart, rightToken.positionStart)
            || equalPositons(leftToken.positionEnd, rightToken.positionEnd)
        );
    }

    export function equalPositons(leftPosition: LinePosition, rightPosition: LinePosition): boolean {
        return (
            leftPosition.columnNumber === rightPosition.columnNumber
            || leftPosition.textIndex === rightPosition.textIndex
        )
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

    function lineFromText(text: string, lineModeStart: LineMode): UntouchedLine {
        return lineFromLineString(lineStringFrom(text), lineModeStart);
    }

    function lineFromLineString(lineString: LineString, lineModeStart: LineMode): UntouchedLine {
        return {
            kind: LineKind.Untouched,
            lineString,
            lineModeStart,
            lineModeEnd: LineMode.Default,
            tokens: [],
        };
    }

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
                    lineString: line.lineString,
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
                    lineString: line.lineString,
                    lineModeStart: line.lineModeStart,
                    lineModeEnd: tokenizeChanges.lineModeEnd,
                    tokens: newTokens,
                    error: tokenizePartialResult.error,
                }
            }

            case PartialResultKind.Err:
                return {
                    kind: LineKind.Error,
                    lineString: line.lineString,
                    lineModeStart: line.lineModeStart,
                    lineModeEnd: line.lineModeEnd,
                    tokens: line.tokens,
                    error: tokenizePartialResult.error,
                }

            default:
                throw isNever(tokenizePartialResult);
        }
    }

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
                    const retokenizedLine: TLine = tokenize(lineFromLineString(line.lineString, previousLineModeEnd), offsetLineNumber);
                    retokenizedLines.push(retokenizedLine);
                    previousLineModeEnd = retokenizedLine.lineModeEnd;
                    lineNumber += 1;
                    maybeCurrentLine = lines[lineNumber];
                }
                else {
                    return retokenizedLines;
                }

            }

            return retokenizedLines;
        }
        else {
            return [];
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
                    lineString: line.lineString,
                    lineModeStart: line.lineModeStart,
                    lineModeEnd: line.lineModeEnd,
                    tokens: line.tokens,
                    error: new LexerError.LexerError(new LexerError.BadStateError(line.error)),
                };
        }

        const untouchedLine: UntouchedLine = line;
        const lineString: LineString = untouchedLine.lineString;
        const text = lineString.text;
        const textLength = text.length;

        // sanity check that there's something to tokenize
        if (textLength === 0) {
            return {
                kind: LineKind.Touched,
                lineString: line.lineString,
                lineModeStart: line.lineModeStart,
                lineModeEnd: LineMode.Default,
                tokens: [],
            }
        }

        let lineMode: LineMode = line.lineModeStart;
        let currentPosition: LinePosition = {
            textIndex: 0,
            columnNumber: 0,
        };

        if (lineMode === LineMode.Default) {
            currentPosition = drainWhitespace(lineString, currentPosition);
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
                    currentPosition = drainWhitespace(lineString, token.positionEnd);
                }
                else {
                    currentPosition = token.positionEnd;
                }

                if (currentPosition.textIndex === textLength) {
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
        currentPosition: LinePosition,
    ): LineModeAlteringRead {
        const lineString: LineString = line.lineString;
        const text = lineString.text;
        const indexOfCloseComment = text.indexOf("*/", currentPosition.textIndex);

        if (indexOfCloseComment === -1) {
            const textLength = text.length;
            const positionEnd: LinePosition = {
                textIndex: textLength,
                columnNumber: lineString.textIndex2GraphemeIndex[textLength],
            };

            return {
                token: readTokenFrom(LineTokenKind.MultilineCommentContent, lineString, currentPosition, positionEnd),
                lineMode: LineMode.Comment,
            }
        }
        else {
            const textIndexEnd = indexOfCloseComment + 2;
            const positionEnd: LinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };

            return {
                token: readTokenFrom(LineTokenKind.MultilineCommentEnd, lineString, currentPosition, positionEnd),
                lineMode: LineMode.Default,
            }
        }
    }

    // read either string literal end or eof
    function tokenizeQuotedIdentifierContentOrEnd(
        line: TLine,
        currentPosition: LinePosition,
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
        currentPosition: LinePosition,
    ): LineModeAlteringRead {
        const lineString: LineString = line.lineString;
        const text: string = lineString.text;
        const maybeTextIndexEnd: Option<number> = maybeIndexOfStringEnd(text, currentPosition.textIndex);

        if (maybeTextIndexEnd === undefined) {
            return {
                token: readRestOfLine(LineTokenKind.StringLiteralContent, lineString, currentPosition),
                lineMode: LineMode.String,
            }
        }
        else {
            const textIndexEnd: number = maybeTextIndexEnd + 1;
            const positionEnd: LinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };

            return {
                token: readTokenFrom(LineTokenKind.StringLiteralEnd, lineString, currentPosition, positionEnd),
                lineMode: LineMode.Default,
            }
        }
    }

    function tokenizeDefault(line: TLine, lineNumber: number, positionStart: LinePosition): LineModeAlteringRead {
        const lineString = line.lineString;
        const text = lineString.text;

        const chr1: string = text[positionStart.textIndex];
        let token: LineToken;
        let lineMode = LineMode.Default;

        if (chr1 === "!") { token = readConstant(LineTokenKind.Bang, lineString, positionStart, 1); }
        else if (chr1 === "&") { token = readConstant(LineTokenKind.Ampersand, lineString, positionStart, 1); }
        else if (chr1 === "(") { token = readConstant(LineTokenKind.LeftParenthesis, lineString, positionStart, 1); }
        else if (chr1 === ")") { token = readConstant(LineTokenKind.RightParenthesis, lineString, positionStart, 1); }
        else if (chr1 === "*") { token = readConstant(LineTokenKind.Asterisk, lineString, positionStart, 1); }
        else if (chr1 === "+") { token = readConstant(LineTokenKind.Plus, lineString, positionStart, 1); }
        else if (chr1 === ",") { token = readConstant(LineTokenKind.Comma, lineString, positionStart, 1); }
        else if (chr1 === "-") { token = readConstant(LineTokenKind.Minus, lineString, positionStart, 1); }
        else if (chr1 === ";") { token = readConstant(LineTokenKind.Semicolon, lineString, positionStart, 1); }
        else if (chr1 === "?") { token = readConstant(LineTokenKind.QuestionMark, lineString, positionStart, 1); }
        else if (chr1 === "@") { token = readConstant(LineTokenKind.AtSign, lineString, positionStart, 1); }
        else if (chr1 === "[") { token = readConstant(LineTokenKind.LeftBracket, lineString, positionStart, 1); }
        else if (chr1 === "]") { token = readConstant(LineTokenKind.RightBracket, lineString, positionStart, 1); }
        else if (chr1 === "{") { token = readConstant(LineTokenKind.LeftBrace, lineString, positionStart, 1); }
        else if (chr1 === "}") { token = readConstant(LineTokenKind.RightBrace, lineString, positionStart, 1); }

        else if (chr1 === "\"") {
            const read: LineModeAlteringRead = readStringLiteralOrStart(lineString, positionStart);
            token = read.token;
            lineMode = read.lineMode;
        }

        else if (chr1 === "0") {
            const chr2 = text[positionStart.textIndex + 1];

            if (chr2 === "x" || chr2 === "X") { token = readHexLiteral(lineString, lineNumber, positionStart); }
            else { token = readNumericLiteral(lineString, lineNumber, positionStart); }
        }

        else if ("1" <= chr1 && chr1 <= "9") { token = readNumericLiteral(lineString, lineNumber, positionStart); }

        else if (chr1 === ".") {
            const chr2 = text[positionStart.textIndex + 1];

            if (chr2 === undefined) {
                throw new LexerError.UnexpectedEofError({
                    lineNumber,
                    ...positionStart
                });
            }
            else if ("1" <= chr2 && chr2 <= "9") { token = readNumericLiteral(lineString, lineNumber, positionStart); }
            else if (chr2 === ".") {
                const chr3 = text[positionStart.textIndex + 2];

                if (chr3 === ".") { token = readConstant(LineTokenKind.Ellipsis, lineString, positionStart, 3); }
                else { throw unexpectedReadError(lineNumber, positionStart) }
            }
            else { throw unexpectedReadError(lineNumber, positionStart) }
        }

        else if (chr1 === ">") {
            const chr2 = text[positionStart.textIndex + 1];

            if (chr2 === "=") { token = readConstant(LineTokenKind.GreaterThanEqualTo, lineString, positionStart, 2); }
            else { token = readConstant(LineTokenKind.GreaterThan, lineString, positionStart, 1); }
        }

        else if (chr1 === "<") {
            const chr2 = text[positionStart.textIndex + 1];

            if (chr2 === "=") { token = readConstant(LineTokenKind.LessThanEqualTo, lineString, positionStart, 2); }
            else if (chr2 === ">") { token = readConstant(LineTokenKind.NotEqual, lineString, positionStart, 2); }
            else { token = readConstant(LineTokenKind.LessThan, lineString, positionStart, 1) }
        }

        else if (chr1 === "=") {
            const chr2 = text[positionStart.textIndex + 1];

            if (chr2 === ">") { token = readConstant(LineTokenKind.FatArrow, lineString, positionStart, 2); }
            else { token = readConstant(LineTokenKind.Equal, lineString, positionStart, 1); }
        }

        else if (chr1 === "/") {
            const chr2 = text[positionStart.textIndex + 1];

            if (chr2 === "/") { token = readLineComment(lineString, positionStart); }
            else if (chr2 === "*") {
                const read: LineModeAlteringRead = readMultilineCommentOrStartStart(lineString, positionStart);
                token = read.token;
                lineMode = read.lineMode;
            }
            else { token = readConstant(LineTokenKind.Division, lineString, positionStart, 1); }
        }

        else if (chr1 === "#") {
            const chr2 = text[positionStart.textIndex + 1];

            if (chr2 === "\"") {
                const read: LineModeAlteringRead = readQuotedIdentifierOrStart(lineString, positionStart);
                token = read.token;
                lineMode = read.lineMode;
            }
            else { token = readKeyword(lineString, lineNumber, positionStart); }
        }

        else { token = readKeywordOrIdentifier(lineString, lineNumber, positionStart); }

        return {
            token,
            lineMode,
        };
    }

    function drainWhitespace(
        lineString: LineString,
        position: LinePosition,
    ): LinePosition {
        let textIndexEnd = position.textIndex;
        let continueDraining = lineString.text[textIndexEnd] !== undefined;

        while (continueDraining) {
            const maybeLength = StringHelpers.maybeRegexMatchLength(Pattern.RegExpWhitespace, lineString.text, textIndexEnd);
            if (maybeLength) {
                textIndexEnd += maybeLength;
            }
            else {
                continueDraining = false;
            }
        }

        return {
            textIndex: textIndexEnd,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
        };
    }

    function readStringLiteralOrStart(
        lineString: LineString,
        positionStart: LinePosition,
    ): LineModeAlteringRead {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfStringEnd(lineString.text, positionStart.textIndex + 1);
        if (maybeTextIndexEnd !== undefined) {
            const textIndexEnd: number = maybeTextIndexEnd + 1;
            const positionEnd: LinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };
            return {
                token: readTokenFrom(LineTokenKind.StringLiteral, lineString, positionStart, positionEnd),
                lineMode: LineMode.Default,
            };
        }
        else {
            return {
                token: readRestOfLine(LineTokenKind.StringLiteralStart, lineString, positionStart),
                lineMode: LineMode.String,
            }
        }
    }

    function readHexLiteral(
        lineString: LineString,
        lineNumber: number,
        positionStart: LinePosition,
    ): LineToken {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpHex, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            throw new LexerError.ExpectedHexLiteralError({
                lineNumber,
                ...positionStart,
            });
        }
        const textIndexEnd: number = maybeTextIndexEnd;

        const positionEnd: LinePosition = {
            textIndex: textIndexEnd,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
        }
        return readTokenFrom(LineTokenKind.HexLiteral, lineString, positionStart, positionEnd);
    }

    function readNumericLiteral(
        lineString: LineString,
        lineNumber: number,
        positionStart: LinePosition,
    ): LineToken {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpNumeric, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            throw new LexerError.ExpectedNumericLiteralError({
                lineNumber,
                ...positionStart,
            });
        }
        const textEndIndex: number = maybeTextIndexEnd;

        const positionEnd: LinePosition = {
            textIndex: textEndIndex,
            columnNumber: lineString.textIndex2GraphemeIndex[textEndIndex],
        }
        return readTokenFrom(LineTokenKind.NumericLiteral, lineString, positionStart, positionEnd);
    }

    function readLineComment(
        lineString: LineString,
        positionStart: LinePosition,
    ): LineToken {
        // LexerLineString is already split on newline,
        // so the remainder of the line is a line comment
        const commentTextIndexEnd = lineString.text.length;
        const positionEnd: LinePosition = {
            textIndex: commentTextIndexEnd,
            columnNumber: lineString.textIndex2GraphemeIndex[commentTextIndexEnd],
        }
        return readTokenFrom(LineTokenKind.LineComment, lineString, positionStart, positionEnd);
    }

    function readMultilineCommentOrStartStart(
        lineString: LineString,
        positionStart: LinePosition,
    ): LineModeAlteringRead {
        const indexOfCloseComment = lineString.text.indexOf("*/", positionStart.textIndex);
        if (indexOfCloseComment === -1) {
            return {
                token: readRestOfLine(LineTokenKind.MultilineCommentStart, lineString, positionStart),
                lineMode: LineMode.Comment,
            }
        }
        else {
            const textIndexEnd = indexOfCloseComment + 2;
            const positionEnd: LinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            }
            return {
                token: readTokenFrom(LineTokenKind.MultilineComment, lineString, positionStart, positionEnd),
                lineMode: LineMode.Default,
            }
        }
    }

    function readKeyword(lineString: LineString, lineNumber: number, positionStart: LinePosition): LineToken {
        const maybeToken: Option<LineToken> = maybeReadKeyword(lineString, positionStart);
        if (maybeToken) {
            return maybeToken;
        }
        else {
            throw unexpectedReadError(lineNumber, positionStart);
        }
    }

    function maybeReadKeyword(
        lineString: LineString,
        positionStart: LinePosition,
    ): Option<LineToken> {
        const text = lineString.text;

        const textStartIndex = positionStart.textIndex;
        const identifierTextIndexStart = text[textStartIndex] === "#"
            ? textStartIndex + 1
            : textStartIndex;

        const maybeIdentifierTextIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, identifierTextIndexStart);
        if (maybeIdentifierTextIndexEnd === undefined) {
            return undefined;
        }
        const textIndexEnd = maybeIdentifierTextIndexEnd;

        const substring = text.substring(textStartIndex, textIndexEnd);

        const maybeKeywordTokenKind = maybeKeywordLineTokenKindFrom(substring);
        if (maybeKeywordTokenKind === undefined) {
            return undefined;
        }
        else {
            return {
                kind: maybeKeywordTokenKind,
                positionStart,
                positionEnd: {
                    textIndex: textIndexEnd,
                    columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
                },
                data: substring,
            }
        }
    }

    function readQuotedIdentifierOrStart(
        lineString: LineString,
        positionStart: LinePosition,
    ): LineModeAlteringRead {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfStringEnd(lineString.text, positionStart.textIndex + 2);
        if (maybeTextIndexEnd !== undefined) {
            const textIndexEnd: number = maybeTextIndexEnd + 1;
            const positionEnd: LinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };

            return {
                token: readTokenFrom(LineTokenKind.Identifier, lineString, positionStart, positionEnd),
                lineMode: LineMode.Default,
            };
        }
        else {
            return {
                token: readRestOfLine(LineTokenKind.QuotedIdentifierStart, lineString, positionStart),
                lineMode: LineMode.QuotedIdentifier,
            }
        }
    }

    // the quoted identifier case has already been taken care of
    // null-literal is also read here
    function readKeywordOrIdentifier(
        lineString: LineString,
        lineNumber: number,
        positionStart: LinePosition,
    ): LineToken {
        const text = lineString.text;
        const textIndexStart = positionStart.textIndex;

        // keyword
        if (text[textIndexStart] === "#") {
            return readKeyword(lineString, lineNumber, positionStart);
        }
        // either keyword or identifier
        else {
            const maybeTextIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, textIndexStart);
            if (maybeTextIndexEnd === undefined) {
                throw unexpectedReadError(lineNumber, positionStart);
            }
            const textIndexEnd = maybeTextIndexEnd;
            const substring = text.substring(textIndexStart, textIndexEnd);

            const maybeKeywordTokenKind = maybeKeywordLineTokenKindFrom(substring);

            let tokenKind;
            if (maybeKeywordTokenKind !== undefined) {
                tokenKind = maybeKeywordTokenKind;
            }
            else if (substring === "null") {
                tokenKind = LineTokenKind.NullLiteral;
            }
            else {
                tokenKind = LineTokenKind.Identifier;
            }

            return {
                kind: tokenKind,
                positionStart,
                positionEnd: {
                    textIndex: textIndexEnd,
                    columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
                },
                data: substring,
            }
        }
    }

    function readConstant(
        lineTokenKind: LineTokenKind,
        lineString: LineString,
        positionStart: LinePosition,
        length: number,
    ): LineToken {
        const textIndexEnd = positionStart.textIndex + length;
        const positionEnd: LinePosition = {
            textIndex: positionStart.textIndex + length,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd]
        }
        return readTokenFrom(lineTokenKind, lineString, positionStart, positionEnd);
    }

    function readTokenFrom(
        lineTokenKind: LineTokenKind,
        lineString: LineString,
        positionStart: LinePosition,
        positionEnd: LinePosition,
    ): LineToken {
        return {
            kind: lineTokenKind,
            positionStart,
            positionEnd,
            data: lineString.text.substring(positionStart.textIndex, positionEnd.textIndex),
        };
    }

    function readRestOfLine(
        lineTokenKind: LineTokenKind,
        lineString: LineString,
        positionStart: LinePosition,
    ): LineToken {
        const textLength = lineString.text.length;
        const positionEnd: LinePosition = {
            textIndex: textLength,
            columnNumber: lineString.textIndex2GraphemeIndex[textLength],
        };
        return readTokenFrom(lineTokenKind, lineString, positionStart, positionEnd);
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

    function maybeKeywordLineTokenKindFrom(str: string): Option<LineTokenKind> {
        switch (str) {
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
        textIndexStart: number,
    ): Option<number> {
        let indexLow = textIndexStart;
        let indexHigh = text.indexOf("\"", indexLow)

        while (indexHigh !== -1) {
            if (text[indexHigh + 1] === "\"") {
                indexLow = indexHigh + 2;
                indexHigh = text.indexOf("\"", indexLow);
            }
            else {
                return indexHigh;
            }
        }

        return undefined;
    }

    function unexpectedReadError(
        lineNumber: number,
        position: LinePosition,
    ): LexerError.UnexpectedReadError {
        return new LexerError.UnexpectedReadError({
            lineNumber,
            ...position,
        });
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
        if (start.lineNumber === end.lineNumber && start.columnNumber > end.columnNumber) {
            maybeKind = LexerError.BadRangeKind.SameLine_ColumnNumberStart_Higher;
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

        if (rangeStart.columnNumber >= lineStart.lineString.graphemes.length) {
            maybeKind = LexerError.BadRangeKind.ColumnNumberStart_GreaterThan_LineLength;
        }
        else if (rangeEnd.columnNumber >= lineEnd.lineString.graphemes.length) {
            maybeKind = LexerError.BadRangeKind.ColumnNumberEnd_GreaterThan_LineLength;
        }

        if (maybeKind) {
            return new LexerError.BadRangeError(range, maybeKind);
        }

        return undefined;
    }

}
