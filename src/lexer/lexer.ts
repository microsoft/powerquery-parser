import { CommonError, isNever, Pattern, StringHelpers } from "../common";
import { Option } from "../common/option";
import { PartialResult, PartialResultKind } from "../common/partialResult";
import { LexerError } from "./error";
import { Keyword } from "./keywords";
import { LineToken, LineTokenKind } from "./token";

// the lexer
//  * is mostly functional based, with a few throws to propagate errors
//  * splits up text by line terminator, allowing line-by-line lexing

// call Lexer.from to instantiate a state instance
// calls to lexer functions returns a new state object
// call Lexer.snapshot creates a frozen copy of a lexer state

export namespace Lexer {

    export type TLexerLine = (
        | TouchedLine
        | UntouchedLine
        | TouchedWithErrorLine
        | ErrorLine
    )

    export type TErrorLexerLine = (
        | ErrorLine
        | TouchedWithErrorLine
    )

    export const enum LexerLineKind {
        Error = "Error",
        Touched = "Touched",
        TouchedWithError = "TouchedWithError",
        Untouched = "Untouched",
    }

    // tokenizing a TLexerLine is done in one of the following contexts,
    // which is really either:
    //  * tokenize the entire line as usual
    //  * the line is a contiuation of a multiline token, eg. `"foo \n bar"`
    export const enum LexerLineMode {
        Comment = "Comment",
        Default = "Default",
        QuotedIdentifier = "QuotedIdentifier",
        String = "String",
    }

    export interface LexerState {
        readonly lines: ReadonlyArray<TLexerLine>,
        readonly lineTerminator: string,
    }

    export interface ILexerLine {
        readonly kind: LexerLineKind,
        readonly lineNumber: number,
        readonly lineString: LexerLineString,
        readonly lineMode: LexerLineMode,
        readonly tokens: ReadonlyArray<LineToken>,
    }

    export interface LexerLineString {
        readonly text: string,
        readonly graphemes: ReadonlyArray<string>,
        readonly textIndex2GraphemeIndex: { [textIndex: number]: number; }
        readonly graphemeIndex2TextIndex: { [graphemeIndex: number]: number; }
    }

    export interface ErrorLine extends ILexerLine {
        readonly kind: LexerLineKind.Error,
        readonly error: LexerError.TLexerError,
    }

    // the last read attempt succeeded without encountering an error.
    // possible that only whitespace was consumed.
    export interface TouchedLine extends ILexerLine {
        readonly kind: LexerLineKind.Touched,
    }

    // the last read attempt read at least one token or comment before encountering an error
    export interface TouchedWithErrorLine extends ILexerLine {
        readonly kind: LexerLineKind.TouchedWithError,
        readonly error: LexerError.TLexerError,
    }

    // a call to appendtToDocument clears existing state marking it ready to be lexed
    export interface UntouchedLine extends ILexerLine {
        readonly kind: LexerLineKind.Untouched,
    }

    export interface LexerLinePosition {
        readonly textIndex: number,
        readonly columnNumber: number,
    }


    export function lexerLineStringFrom(text: string): LexerLineString {
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

    export function from(text: string, lineTerminator: string): LexerState {
        let newLine: TLexerLine = lineFrom(text, 0, LexerLineMode.Default);
        newLine = tokenize(newLine);

        return {
            lines: [newLine],
            lineTerminator,
        };
    }

    export function fromSplit(text: string, lineTerminator: string): LexerState {
        const lines = text.split(lineTerminator);
        const numLines = lines.length;

        let state = from(lines[0], lineTerminator);
        if (numLines === 1) {
            return state;
        }

        for (let index = 1; index < numLines; index++) {
            state = appendNewLine(state, lines[index]);
            if (isErrorLine(state.lines[index])) {
                return state;
            }
        }

        return state;
    }

    export function equalStates(leftState: LexerState, rightState: LexerState): boolean {
        return (
            equalLines(leftState.lines, rightState.lines)
            || (leftState.lineTerminator === rightState.lineTerminator)
        );
    }

    export function equalLines(leftLines: ReadonlyArray<TLexerLine>, rightLines: ReadonlyArray<TLexerLine>): boolean {
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
                || left.lineMode === right.lineMode
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

    export function equalTokens(leftToken: LineToken, rightToken: LineToken): boolean {
        return (
            leftToken.kind === rightToken.kind
            || leftToken.data === rightToken.data
            || equalPositons(leftToken.positionStart, rightToken.positionStart)
            || equalPositons(leftToken.positionEnd, rightToken.positionEnd)
        );
    }

    export function equalPositons(leftPosition: LexerLinePosition, rightPosition: LexerLinePosition): boolean {
        return (
            leftPosition.columnNumber === rightPosition.columnNumber
            || leftPosition.textIndex === rightPosition.textIndex
        )
    }

    export function appendNewLine(state: LexerState, text: string): LexerState {
        const lines = state.lines;
        const numLines = lines.length;
        const maybeLatestLine: Option<TLexerLine> = lines[numLines - 1];

        let lineNumber: number;
        let lineMode: LexerLineMode;
        if (maybeLatestLine !== undefined) {
            const latestLine: TLexerLine = maybeLatestLine;

            lineNumber = latestLine.lineNumber + 1;
            lineMode = latestLine.lineMode;
        }
        else {
            lineNumber = 0;
            lineMode = LexerLineMode.Default;
        }

        let newLine: TLexerLine = lineFrom(text, lineNumber, lineMode)
        newLine = tokenize(newLine);

        return {
            ...state,
            lines: state.lines.concat(newLine),
        };
    }

    interface TokenizeChanges {
        readonly tokens: ReadonlyArray<LineToken>,
        readonly lineMode: LexerLineMode,
    }

    interface LineModeAlteringRead {
        readonly token: LineToken,
        readonly lineMode: LexerLineMode,
    }

    function lineFrom(text: string, lineNumber: number, lineMode: LexerLineMode): UntouchedLine {
        return {
            kind: LexerLineKind.Untouched,
            lineNumber,
            lineString: lexerLineStringFrom(text),
            lineMode,
            tokens: [],
        }
    }

    export function isErrorState(state: LexerState): boolean {
        const linesWithErrors: ReadonlyArray<ErrorLine | TouchedWithErrorLine> = state.lines.filter(isErrorLine);
        return linesWithErrors.length !== 0;
    }

    export function isErrorLine(line: TLexerLine): line is TErrorLexerLine {
        switch (line.kind) {
            case LexerLineKind.Error:
            case LexerLineKind.TouchedWithError:
                return true;

            case LexerLineKind.Touched:
            case LexerLineKind.Untouched:
                return false;

            default:
                throw isNever(line);
        }
    }

    export function maybeErrorLines(state: LexerState): Option<ReadonlyArray<TErrorLexerLine>> {
        const errorLines: TErrorLexerLine[] = [];
        for (let line of state.lines) {
            if (isErrorLine(line)) {
                errorLines.push(line);
            }
        }

        return errorLines.length
            ? errorLines
            : undefined;
    }

    // takes the return from tokenizeX functions and updates the line's state
    function updateLineState(
        line: TLexerLine,
        tokenizePartialResult: PartialResult<TokenizeChanges, LexerError.TLexerError>,
    ): TLexerLine {
        switch (tokenizePartialResult.kind) {
            case PartialResultKind.Ok: {
                const tokenizeChanges: TokenizeChanges = tokenizePartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = line.tokens.concat(tokenizeChanges.tokens);

                return {
                    kind: LexerLineKind.Touched,
                    lineNumber: line.lineNumber,
                    lineString: line.lineString,
                    lineMode: tokenizeChanges.lineMode,
                    tokens: newTokens,
                }
            }

            case PartialResultKind.Partial: {
                const tokenizeChanges: TokenizeChanges = tokenizePartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = line.tokens.concat(tokenizeChanges.tokens);

                return {
                    kind: LexerLineKind.TouchedWithError,
                    lineNumber: line.lineNumber,
                    lineString: line.lineString,
                    lineMode: tokenizeChanges.lineMode,
                    tokens: newTokens,
                    error: tokenizePartialResult.error,
                }
            }

            case PartialResultKind.Err:
                return {
                    kind: LexerLineKind.Error,
                    lineNumber: line.lineNumber,
                    lineString: line.lineString,
                    lineMode: line.lineMode,
                    tokens: line.tokens,
                    error: tokenizePartialResult.error,
                }

            default:
                throw isNever(tokenizePartialResult);
        }
    }

    // the main function of the lexer's tokenizer
    function tokenize(line: TLexerLine): TLexerLine {
        switch (line.kind) {
            // cannot tokenize something that ended with an error,
            // nothing has changed since the last tokenize.
            // update the line's text before trying again.
            case LexerLineKind.Error:
                return line;

            case LexerLineKind.Touched:
                // the line was already fully lexed once.
                // without any text changes it should throw eof to help diagnose
                // why it's trying to re-tokenize
                return {
                    ...line,
                    kind: LexerLineKind.Error,
                    error: new LexerError.LexerError(new LexerError.EndOfStreamError()),
                }

            // cannot tokenize something that ended with an error,
            // nothing has changed since the last tokenize.
            // update the line's text before trying again.
            case LexerLineKind.TouchedWithError:
                return {
                    kind: LexerLineKind.Error,
                    lineNumber: line.lineNumber,
                    lineString: line.lineString,
                    lineMode: line.lineMode,
                    tokens: line.tokens,
                    error: new LexerError.LexerError(new LexerError.BadStateError(line.error)),
                };
        }

        const untouchedLine: UntouchedLine = line;
        const lineString: LexerLineString = untouchedLine.lineString;
        const text = lineString.text;
        const textLength = text.length;

        // sanity check that there's something to tokenize
        if (textLength === 0) {
            return {
                kind: LexerLineKind.Touched,
                lineNumber: line.lineNumber,
                lineString: line.lineString,
                lineMode: line.lineMode,
                tokens: [],
            }
        }

        let lineMode: LexerLineMode = line.lineMode;
        let currentPosition: LexerLinePosition = {
            textIndex: 0,
            columnNumber: 0,
        };

        if (lineMode === LexerLineMode.Default) {
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
                    case LexerLineMode.Comment:
                        readOutcome = tokenizeMultilineCommentContentOrEnd(line, currentPosition);
                        break;

                    case LexerLineMode.Default:
                        readOutcome = tokenizeDefault(line, currentPosition);
                        break;

                    case LexerLineMode.QuotedIdentifier:
                        readOutcome = tokenizeQuotedIdentifierContentOrEnd(line, currentPosition);
                        break;

                    case LexerLineMode.String:
                        readOutcome = tokenizeStringLiteralContentOrEnd(line, currentPosition);
                        break;

                    default:
                        throw isNever(lineMode);
                }

                lineMode = readOutcome.lineMode;
                const token = readOutcome.token;
                newTokens.push(token);

                if (lineMode === LexerLineMode.Default) {
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
                        lineMode: lineMode,
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
                    lineMode: lineMode,
                }
            }
        }

        return updateLineState(line, partialTokenizeResult);
    }

    // read either "*/" or eof
    function tokenizeMultilineCommentContentOrEnd(
        line: TLexerLine,
        currentPosition: LexerLinePosition,
    ): LineModeAlteringRead {
        const lineString: LexerLineString = line.lineString;
        const text = lineString.text;
        const indexOfCloseComment = text.indexOf("*/", currentPosition.textIndex);

        if (indexOfCloseComment === -1) {
            const textLength = text.length;
            const positionEnd: LexerLinePosition = {
                textIndex: textLength,
                columnNumber: lineString.textIndex2GraphemeIndex[textLength],
            };

            return {
                token: readTokenFrom(LineTokenKind.MultilineCommentContent, lineString, currentPosition, positionEnd),
                lineMode: LexerLineMode.Comment,
            }
        }
        else {
            const textIndexEnd = indexOfCloseComment + 2;
            const positionEnd: LexerLinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };

            return {
                token: readTokenFrom(LineTokenKind.MultilineCommentEnd, lineString, currentPosition, positionEnd),
                lineMode: LexerLineMode.Default,
            }
        }
    }

    // read either string literal end or eof
    function tokenizeQuotedIdentifierContentOrEnd(
        line: TLexerLine,
        currentPosition: LexerLinePosition,
    ): LineModeAlteringRead {
        const read = tokenizeStringLiteralContentOrEnd(line, currentPosition);
        switch (read.token.kind) {
            case LineTokenKind.StringLiteralContent:
                return {
                    lineMode: LexerLineMode.QuotedIdentifier,
                    token: {
                        ...read.token,
                        kind: LineTokenKind.QuotedIdentifierContent,
                    }
                };

            case LineTokenKind.StringLiteralEnd:
                return {
                    lineMode: LexerLineMode.Default,
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
        line: TLexerLine,
        currentPosition: LexerLinePosition,
    ): LineModeAlteringRead {
        const lineString: LexerLineString = line.lineString;
        const text: string = lineString.text;
        const maybeTextIndexEnd: Option<number> = maybeIndexOfStringEnd(text, currentPosition.textIndex);

        if (maybeTextIndexEnd === undefined) {
            return {
                token: readRestOfLine(LineTokenKind.StringLiteralContent, lineString, currentPosition),
                lineMode: LexerLineMode.String,
            }
        }
        else {
            const textIndexEnd: number = maybeTextIndexEnd + 1;
            const positionEnd: LexerLinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };

            return {
                token: readTokenFrom(LineTokenKind.StringLiteralEnd, lineString, currentPosition, positionEnd),
                lineMode: LexerLineMode.Default,
            }
        }
    }

    function tokenizeDefault(line: TLexerLine, currentPosition: LexerLinePosition): LineModeAlteringRead {
        const lineString = line.lineString;
        const text = lineString.text;

        const chr1: string = text[currentPosition.textIndex];
        let token: LineToken;
        let lineMode = LexerLineMode.Default;

        if (chr1 === "!") { token = readConstant(LineTokenKind.Bang, lineString, currentPosition, 1); }
        else if (chr1 === "&") { token = readConstant(LineTokenKind.Ampersand, lineString, currentPosition, 1); }
        else if (chr1 === "(") { token = readConstant(LineTokenKind.LeftParenthesis, lineString, currentPosition, 1); }
        else if (chr1 === ")") { token = readConstant(LineTokenKind.RightParenthesis, lineString, currentPosition, 1); }
        else if (chr1 === "*") { token = readConstant(LineTokenKind.Asterisk, lineString, currentPosition, 1); }
        else if (chr1 === "+") { token = readConstant(LineTokenKind.Plus, lineString, currentPosition, 1); }
        else if (chr1 === ",") { token = readConstant(LineTokenKind.Comma, lineString, currentPosition, 1); }
        else if (chr1 === "-") { token = readConstant(LineTokenKind.Minus, lineString, currentPosition, 1); }
        else if (chr1 === ";") { token = readConstant(LineTokenKind.Semicolon, lineString, currentPosition, 1); }
        else if (chr1 === "?") { token = readConstant(LineTokenKind.QuestionMark, lineString, currentPosition, 1); }
        else if (chr1 === "@") { token = readConstant(LineTokenKind.AtSign, lineString, currentPosition, 1); }
        else if (chr1 === "[") { token = readConstant(LineTokenKind.LeftBracket, lineString, currentPosition, 1); }
        else if (chr1 === "]") { token = readConstant(LineTokenKind.RightBracket, lineString, currentPosition, 1); }
        else if (chr1 === "{") { token = readConstant(LineTokenKind.LeftBrace, lineString, currentPosition, 1); }
        else if (chr1 === "}") { token = readConstant(LineTokenKind.RightBrace, lineString, currentPosition, 1); }

        else if (chr1 === "\"") {
            const read: LineModeAlteringRead = readStringLiteralOrStart(lineString, currentPosition);
            token = read.token;
            lineMode = read.lineMode;
        }

        else if (chr1 === "0") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "x" || chr2 === "X") { token = readHexLiteral(line, currentPosition); }
            else { token = readNumericLiteral(line, currentPosition); }
        }

        else if ("1" <= chr1 && chr1 <= "9") { token = readNumericLiteral(line, currentPosition); }

        else if (chr1 === ".") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === undefined) {
                throw new LexerError.UnexpectedEofError({
                    lineNumber: line.lineNumber,
                    ...currentPosition
                });
            }
            else if ("1" <= chr2 && chr2 <= "9") { token = readNumericLiteral(line, currentPosition); }
            else if (chr2 === ".") {
                const chr3 = text[currentPosition.textIndex + 2];

                if (chr3 === ".") { token = readConstant(LineTokenKind.Ellipsis, lineString, currentPosition, 3); }
                else { throw unexpectedReadError(line, currentPosition) }
            }
            else { throw unexpectedReadError(line, currentPosition) }
        }

        else if (chr1 === ">") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "=") { token = readConstant(LineTokenKind.GreaterThanEqualTo, lineString, currentPosition, 2); }
            else { token = readConstant(LineTokenKind.GreaterThan, lineString, currentPosition, 1); }
        }

        else if (chr1 === "<") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "=") { token = readConstant(LineTokenKind.LessThanEqualTo, lineString, currentPosition, 2); }
            else if (chr2 === ">") { token = readConstant(LineTokenKind.NotEqual, lineString, currentPosition, 2); }
            else { token = readConstant(LineTokenKind.LessThan, lineString, currentPosition, 1) }
        }

        else if (chr1 === "=") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === ">") { token = readConstant(LineTokenKind.FatArrow, lineString, currentPosition, 2); }
            else { token = readConstant(LineTokenKind.Equal, lineString, currentPosition, 1); }
        }

        else if (chr1 === "/") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "/") { token = readLineComment(lineString, currentPosition); }
            else if (chr2 === "*") {
                const read: LineModeAlteringRead = readMultilineCommentOrStartStart(lineString, currentPosition);
                token = read.token;
                lineMode = read.lineMode;
            }
            else { token = readConstant(LineTokenKind.Division, lineString, currentPosition, 1); }
        }

        else if (chr1 === "#") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "\"") {
                const read: LineModeAlteringRead = readQuotedIdentifierOrStart(lineString, currentPosition);
                token = read.token;
                lineMode = read.lineMode;
            }
            else { token = readKeyword(line, currentPosition); }
        }

        else { token = readKeywordOrIdentifier(line, currentPosition); }

        return {
            token,
            lineMode,
        };
    }

    function drainWhitespace(
        lineString: LexerLineString,
        position: LexerLinePosition,
    ): LexerLinePosition {
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
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineModeAlteringRead {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfStringEnd(lineString.text, positionStart.textIndex + 1);
        if (maybeTextIndexEnd !== undefined) {
            const textIndexEnd: number = maybeTextIndexEnd + 1;
            const positionEnd: LexerLinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };
            return {
                token: readTokenFrom(LineTokenKind.StringLiteral, lineString, positionStart, positionEnd),
                lineMode: LexerLineMode.Default,
            };
        }
        else {
            return {
                token: readRestOfLine(LineTokenKind.StringLiteralStart, lineString, positionStart),
                lineMode: LexerLineMode.String,
            }
        }
    }

    function readHexLiteral(
        line: TLexerLine,
        positionStart: LexerLinePosition,
    ): LineToken {
        const lineString = line.lineString;
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpHex, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            throw new LexerError.ExpectedHexLiteralError({
                lineNumber: line.lineNumber,
                ...positionStart,
            });
        }
        const textIndexEnd: number = maybeTextIndexEnd;

        const positionEnd: LexerLinePosition = {
            textIndex: textIndexEnd,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
        }
        return readTokenFrom(LineTokenKind.HexLiteral, lineString, positionStart, positionEnd);
    }

    function readNumericLiteral(
        line: TLexerLine,
        positionStart: LexerLinePosition,
    ): LineToken {
        const lineString: LexerLineString = line.lineString;
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpNumeric, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            throw new LexerError.ExpectedNumericLiteralError({
                lineNumber: line.lineNumber,
                ...positionStart,
            });
        }
        const textEndIndex: number = maybeTextIndexEnd;

        const positionEnd: LexerLinePosition = {
            textIndex: textEndIndex,
            columnNumber: lineString.textIndex2GraphemeIndex[textEndIndex],
        }
        return readTokenFrom(LineTokenKind.NumericLiteral, lineString, positionStart, positionEnd);
    }

    function readLineComment(
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineToken {
        // LexerLineString is already split on newline,
        // so the remainder of the line is a line comment
        const commentTextIndexEnd = lineString.text.length;
        const positionEnd: LexerLinePosition = {
            textIndex: commentTextIndexEnd,
            columnNumber: lineString.textIndex2GraphemeIndex[commentTextIndexEnd],
        }
        return readTokenFrom(LineTokenKind.LineComment, lineString, positionStart, positionEnd);
    }

    function readMultilineCommentOrStartStart(
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineModeAlteringRead {
        const indexOfCloseComment = lineString.text.indexOf("*/", positionStart.textIndex);
        if (indexOfCloseComment === -1) {
            return {
                token: readRestOfLine(LineTokenKind.MultilineCommentStart, lineString, positionStart),
                lineMode: LexerLineMode.Comment,
            }
        }
        else {
            const textIndexEnd = indexOfCloseComment + 2;
            const positionEnd: LexerLinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            }
            return {
                token: readTokenFrom(LineTokenKind.MultilineComment, lineString, positionStart, positionEnd),
                lineMode: LexerLineMode.Default,
            }
        }
    }

    function readKeyword(line: TLexerLine, positionStart: LexerLinePosition): LineToken {
        const maybeToken: Option<LineToken> = maybeReadKeyword(line.lineString, positionStart);
        if (maybeToken) {
            return maybeToken;
        }
        else {
            throw unexpectedReadError(line, positionStart);
        }
    }

    function maybeReadKeyword(
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
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
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineModeAlteringRead {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfStringEnd(lineString.text, positionStart.textIndex + 2);
        if (maybeTextIndexEnd !== undefined) {
            const textIndexEnd: number = maybeTextIndexEnd + 1;
            const positionEnd: LexerLinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };

            return {
                token: readTokenFrom(LineTokenKind.Identifier, lineString, positionStart, positionEnd),
                lineMode: LexerLineMode.Default,
            };
        }
        else {
            return {
                token: readRestOfLine(LineTokenKind.QuotedIdentifierStart, lineString, positionStart),
                lineMode: LexerLineMode.QuotedIdentifier,
            }
        }
    }

    // the quoted identifier case has already been taken care of
    // null-literal is also read here
    function readKeywordOrIdentifier(
        line: TLexerLine,
        positionStart: LexerLinePosition,
    ): LineToken {
        const lineString: LexerLineString = line.lineString;
        const text = lineString.text;
        const textIndexStart = positionStart.textIndex;

        // keyword
        if (text[textIndexStart] === "#") {
            return readKeyword(line, positionStart);
        }
        // either keyword or identifier
        else {
            const maybeTextIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, textIndexStart);
            if (maybeTextIndexEnd === undefined) {
                throw unexpectedReadError(line, positionStart);
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
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
        length: number,
    ): LineToken {
        const textIndexEnd = positionStart.textIndex + length;
        const positionEnd: LexerLinePosition = {
            textIndex: positionStart.textIndex + length,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd]
        }
        return readTokenFrom(lineTokenKind, lineString, positionStart, positionEnd);
    }

    function readTokenFrom(
        lineTokenKind: LineTokenKind,
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
        positionEnd: LexerLinePosition,
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
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineToken {
        const textLength = lineString.text.length;
        const positionEnd: LexerLinePosition = {
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
        line: TLexerLine,
        position: LexerLinePosition,
    ): LexerError.UnexpectedReadError {
        return new LexerError.UnexpectedReadError({
            lineNumber: line.lineNumber,
            ...position,
        });
    }

}
