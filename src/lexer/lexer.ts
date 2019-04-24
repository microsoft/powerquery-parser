import { CommonError, isNever, Pattern, Result, ResultKind, StringHelpers } from "../common";
import { Option } from "../common/option";
import { PartialResult, PartialResultKind } from "../common/partialResult";
import { LexerError } from "./error";
import { Keyword } from "./keywords";
import { LexerSnapshot } from "./lexerSnapshot";
import { LineToken, LineTokenKind } from "./token";

// the lexer is
//  * functional
//  * represented by a discriminate union (TLexer which are implementations for ILexer)
//  * incremental, allowing line-by-line lexing

// instantiate an instance using Lexer.from
// calling Lexer.appendToDocument, Lexer.next, Lexer.remaining returns an updated lexer state
// Lexer.snapshot creates a frozen copy of a lexer state

export namespace Lexer {

    export type TLexerLineExceptUntouched = Exclude<TLexerLine, UntouchedLine>;

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

    export interface LexerState {
        readonly lines: ReadonlyArray<TLexerLine>,
        readonly lineSeparator: string,
    }

    export const enum LexerMultilineKind {
        Comment = "Comment",
        Default = "Default",
        QuotedIdentifier = "QuotedIdentifier",
        String = "String",
    }

    export interface ILexerLine {
        readonly kind: LexerLineKind,
        readonly lineString: LexerLineString,               // text representation for the line
        readonly numberOfActions: number,                   // allows for quick LexerLine equality comparisons
        readonly lineNumber: number,                        // what line number is this
        readonly tokens: ReadonlyArray<LineToken>,          // LineTokens lexed so far
        readonly multilineKind: LexerMultilineKind,
    }

    export interface LexerLineString {
        readonly text: string,
        readonly graphemes: ReadonlyArray<string>,
        readonly textIndex2GraphemeIndex: { [textIndex: number]: number; }
        readonly graphemeIndex2TextIndex: { [graphemeIndex: number]: number; }
    }

    export const enum LexerLineKind {
        Error = "Error",
        Touched = "Touched",
        TouchedWithError = "TouchedWithError",
        Untouched = "Untouched",
    }

    export interface ErrorLine extends ILexerLine {
        readonly kind: LexerLineKind.Error,
        readonly error: LexerError.TLexerError,
    }

    // the last read attempt succeeded without encountering an error.
    // possible that only whitespace was consumed.
    export interface TouchedLine extends ILexerLine {
        readonly kind: LexerLineKind.Touched,
        readonly lastRead: LexerRead,
    }

    // the last read attempt read at least one token or comment before encountering an error
    export interface TouchedWithErrorLine extends ILexerLine {
        readonly kind: LexerLineKind.TouchedWithError,
        readonly error: LexerError.TLexerError,
        readonly lastRead: LexerRead,
    }

    // a call to appendtToDocument clears existing state marking it ready to be lexed
    export interface UntouchedLine extends ILexerLine {
        readonly kind: LexerLineKind.Untouched,
        readonly maybeLastRead: Option<LexerRead>,
    }

    export interface LexerLinePosition {
        readonly textIndex: number,
        readonly columnNumber: number,
    }

    export interface LexerRead {
        readonly tokens: ReadonlyArray<LineToken>,
        readonly multilineKind: LexerMultilineKind,
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

    export function from(blob: string, lineSeparator = "\n"): LexerState {
        let newState: LexerState = {
            lines: [lineFrom(blob, 0, LexerMultilineKind.Default)],
            lineSeparator,
        };
        return tokenizeLine(newState, 0);
    }

    export function fromSplit(blob: string, lineSeparator: string): LexerState {
        const lines = blob.split(lineSeparator);
        const numLines = lines.length;

        let state = from(lines[0]);
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

    export function trySnapshotFrom(state: LexerState): Result<LexerSnapshot, LexerError.TLexerError> {
        try {
            return {
                kind: ResultKind.Ok,
                value: new LexerSnapshot(state),
            }
        } catch (e) {
            let error: LexerError.TLexerError;
            if (LexerError.isTInnerLexerError(e)) {
                error = new LexerError.LexerError(e);
            }
            else {
                error = CommonError.ensureCommonError(e);
            }
            return {
                kind: ResultKind.Err,
                error,
            };
        }
    }

    export function appendNewLine(state: LexerState, blob: string): LexerState {
        const lines = state.lines;
        const numLines = lines.length;
        const maybeLatestLine: Option<TLexerLine> = lines[numLines - 1];
        const multilineKind = maybeLatestLine !== undefined
            ? maybeLatestLine.multilineKind
            : LexerMultilineKind.Default;

        const newLine = lineFrom(blob, numLines, multilineKind)

        let newState: LexerState = {
            ...state,
            lines: state.lines.concat(newLine),
        };
        return tokenizeLine(newState, newState.lines.length - 1);
    }

    interface ReadOutcome {
        readonly token: LineToken,
        readonly multilineKind: LexerMultilineKind,
    }

    function tokenizeLine(state: LexerState, lineNumber: number): LexerState {
        const maybeLine = state.lines[lineNumber];
        if (maybeLine === undefined) {
            throw new Error("invalid line number");
        }

        let line: TLexerLine = maybeLine;
        switch (line.kind) {
            case LexerLineKind.Touched:
            case LexerLineKind.Untouched:
                const lexResult = tokenize(line);
                line = updateLineState(line, lexResult);
                break;

            case LexerLineKind.Error:
                line = {
                    ...line,
                    numberOfActions: line.numberOfActions + 1,
                };
                break;

            case LexerLineKind.TouchedWithError:
                line = {
                    kind: LexerLineKind.Error,
                    lineString: line.lineString,
                    numberOfActions: line.numberOfActions + 1,
                    lineNumber: line.lineNumber,
                    tokens: line.tokens,
                    multilineKind: line.multilineKind,
                    error: new LexerError.LexerError(new LexerError.BadStateError(line.error)),
                };
                break;

            default:
                throw isNever(line);
        }

        // unsafe action:
        //      change ReadonlyArray into standard array
        // what I'm trying to avoid:
        //      1-2 elements needs to be updated, avoids recreating the container/objects.
        // why it's safe:
        //      same as re-creating the array
        const lines: TLexerLine[] = state.lines as TLexerLine[];
        lines[lineNumber] = line;

        return state;
    }

    function lineFrom(blob: string, lineNumber: number, multilineKind: LexerMultilineKind): UntouchedLine {
        return {
            kind: LexerLineKind.Untouched,
            lineString: lexerLineStringFrom(blob),
            numberOfActions: 0,
            lineNumber,
            tokens: [],
            multilineKind,
            maybeLastRead: undefined,
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

    export function maybeFirstErrorLine(state: LexerState): Option<TErrorLexerLine> {
        for (let line of state.lines) {
            if (isErrorLine(line)) {
                return line;
            }
        }

        return undefined;
    }

    function updateLineState(
        originalState: TLexerLine,
        lexPartialResult: PartialResult<LexerRead, LexerError.TLexerError>,
    ): TLexerLine {
        switch (lexPartialResult.kind) {
            case PartialResultKind.Ok: {
                const lexerRead: LexerRead = lexPartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = originalState.tokens.concat(lexerRead.tokens);

                return {
                    kind: LexerLineKind.Touched,
                    lineString: originalState.lineString,
                    numberOfActions: originalState.numberOfActions + 1,
                    lineNumber: originalState.lineNumber,
                    tokens: newTokens,
                    multilineKind: lexerRead.multilineKind,
                    lastRead: lexerRead,
                }
            }

            case PartialResultKind.Partial: {
                const lexerRead: LexerRead = lexPartialResult.value;
                const newTokens: ReadonlyArray<LineToken> = originalState.tokens.concat(lexerRead.tokens);

                return {
                    kind: LexerLineKind.TouchedWithError,
                    lineString: originalState.lineString,
                    numberOfActions: originalState.numberOfActions + 1,
                    lineNumber: originalState.lineNumber,
                    tokens: newTokens,
                    multilineKind: lexerRead.multilineKind,
                    error: lexPartialResult.error,
                    lastRead: lexerRead,
                }
            }

            case PartialResultKind.Err:
                return {
                    kind: LexerLineKind.Error,
                    lineString: originalState.lineString,
                    numberOfActions: originalState.numberOfActions,
                    tokens: originalState.tokens,
                    lineNumber: originalState.lineNumber,
                    multilineKind: originalState.multilineKind,
                    error: lexPartialResult.error,
                }

            default:
                throw isNever(lexPartialResult);
        }
    }

    function tokenize(line: TLexerLine): PartialResult<LexerRead, LexerError.TLexerError> {
        if (!line.lineString.text) {
            return {
                kind: PartialResultKind.Ok,
                value: {
                    tokens: [],
                    multilineKind: LexerMultilineKind.Default,
                }
            };
        }

        const lineString = line.lineString;
        const text = lineString.text;
        const textLength = text.length;
        let multilineKind = line.multilineKind;
        let currentPosition: LexerLinePosition = {
            textIndex: 0,
            columnNumber: 0,
        };

        if (multilineKind === LexerMultilineKind.Default) {
            currentPosition = drainWhitespace(lineString, currentPosition);
        }

        let continueLexing = currentPosition.textIndex < textLength;
        if (!continueLexing) {
            return {
                kind: PartialResultKind.Err,
                error: new LexerError.LexerError(new LexerError.EndOfStreamError()),
            }
        }

        const newTokens: LineToken[] = [];
        let maybeError: Option<LexerError.TLexerError>;
        while (continueLexing) {
            try {
                let readOutcome: ReadOutcome;
                switch (multilineKind) {
                    case LexerMultilineKind.Comment:
                        readOutcome = tokenizeMultilineCommentContentOrEnd(line, currentPosition);
                        break;

                    case LexerMultilineKind.Default:
                        readOutcome = tokenizeDefault(line, currentPosition);
                        break;

                    case LexerMultilineKind.QuotedIdentifier:
                        throw new Error("todo");

                    case LexerMultilineKind.String:
                        readOutcome = tokenizeStringLiteralContentOrEnd(line, currentPosition);
                        break;

                    default:
                        throw isNever(multilineKind);
                }

                multilineKind = readOutcome.multilineKind;
                const token = readOutcome.token;
                newTokens.push(token);

                if (multilineKind === LexerMultilineKind.Default) {
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

        if (maybeError) {
            if (newTokens.length) {
                return {
                    kind: PartialResultKind.Partial,
                    value: {
                        tokens: newTokens,
                        multilineKind,
                    },
                    error: maybeError,
                };
            }
            else {
                return {
                    kind: PartialResultKind.Err,
                    error: maybeError,
                }
            }
        }
        else {
            return {
                kind: PartialResultKind.Ok,
                value: {
                    tokens: newTokens,
                    multilineKind,
                }
            }
        }
    }

    function tokenizeMultilineCommentContentOrEnd(
        line: TLexerLine,
        currentPosition: LexerLinePosition,
    ): ReadOutcome {
        const lineString = line.lineString;
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
                multilineKind: LexerMultilineKind.Comment,
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
                multilineKind: LexerMultilineKind.Default,
            }
        }
    }

    function tokenizeStringLiteralContentOrEnd(
        line: TLexerLine,
        currentPosition: LexerLinePosition,
    ): ReadOutcome {
        const lineString = line.lineString;
        const text = lineString.text;
        const maybeTextIndexEnd = maybeIndexOfStringEnd(text, currentPosition.textIndex);

        if (maybeTextIndexEnd === undefined) {
            const textLength = text.length;
            const positionEnd: LexerLinePosition = {
                textIndex: textLength,
                columnNumber: lineString.textIndex2GraphemeIndex[textLength],
            };

            return {
                token: readTokenFrom(LineTokenKind.StringLiteralContent, lineString, currentPosition, positionEnd),
                multilineKind: LexerMultilineKind.String,
            }
        }
        else {
            const textIndexEnd = maybeTextIndexEnd;
            const positionEnd: LexerLinePosition = {
                textIndex: textIndexEnd,
                columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
            };

            return {
                token: readTokenFrom(LineTokenKind.StringLiteralEnd, lineString, currentPosition, positionEnd),
                multilineKind: LexerMultilineKind.Default,
            }
        }
    }

    function tokenizeDefault(line: TLexerLine, currentPosition: LexerLinePosition): ReadOutcome {
        const lineString = line.lineString;
        const text = lineString.text;

        const chr1: string = text[currentPosition.textIndex];
        let token: LineToken;
        let multilineKind = LexerMultilineKind.Default;

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
            const chr2 = text[currentPosition.textIndex + 1];
            const chr3 = text[currentPosition.textIndex + 2];

            if (chr2 == "\"" && chr3 !== "\"") { token = readConstant(LineTokenKind.StringLiteral, lineString, currentPosition, 2); }
            else {
                token = readStringLiteralStart(lineString, currentPosition);
                multilineKind = LexerMultilineKind.String;
            }
        }

        else if (chr1 === "0") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "x" || chr2 === "X") { token = readHexLiteral(lineString, currentPosition); }
            else { token = readNumericLiteral(lineString, currentPosition); }
        }

        else if ("1" <= chr1 && chr1 <= "9") { token = readNumericLiteral(lineString, currentPosition); }

        else if (chr1 === ".") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === undefined) {
                const LexerLinePosition = StringHelpers.graphemePositionAt(text, currentPosition.textIndex);
                throw new LexerError.UnexpectedEofError(LexerLinePosition);
            }
            else if ("1" <= chr2 && chr2 <= "9") { token = readNumericLiteral(lineString, currentPosition); }
            else if (chr2 === ".") {
                const chr3 = text[currentPosition.textIndex + 2];

                if (chr3 === ".") { token = readConstant(LineTokenKind.Ellipsis, lineString, currentPosition, 3); }
                else { throw unexpectedReadError(text, currentPosition.textIndex) }
            }
            else { throw unexpectedReadError(text, currentPosition.textIndex) }
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
                token = readMultilineCommentStart(lineString, currentPosition);
                multilineKind = LexerMultilineKind.Comment;
            }
            else { token = readConstant(LineTokenKind.Division, lineString, currentPosition, 1); }
        }

        else if (chr1 === "#") {
            const chr2 = text[currentPosition.textIndex + 1];

            if (chr2 === "\"") { token = readQuotedIdentifier(lineString, currentPosition); }
            else { token = readKeyword(lineString, currentPosition); }
        }

        else { token = readKeywordOrIdentifier(lineString, currentPosition); }

        return {
            token,
            multilineKind,
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

    function readStringLiteralStart(
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineToken {
        const positionEnd: LexerLinePosition = {
            textIndex: positionStart.textIndex + 1,
            columnNumber: positionStart.columnNumber + 1,
        }
        return readTokenFrom(LineTokenKind.StringLiteralStart, lineString, positionStart, positionEnd);
    }

    function readHexLiteral(
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineToken {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpHex, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            const LexerLinePosition = StringHelpers.graphemePositionAt(lineString.text, positionStart.textIndex);
            throw new LexerError.ExpectedHexLiteralError(LexerLinePosition);
        }
        const textIndexEnd: number = maybeTextIndexEnd;

        const positionEnd: LexerLinePosition = {
            textIndex: textIndexEnd,
            columnNumber: lineString.textIndex2GraphemeIndex[textIndexEnd],
        }
        return readTokenFrom(LineTokenKind.HexLiteral, lineString, positionStart, positionEnd);
    }

    function readNumericLiteral(lineString: LexerLineString, positionStart: LexerLinePosition): LineToken {
        const maybeTextIndexEnd: Option<number> = maybeIndexOfRegexEnd(Pattern.RegExpNumeric, lineString.text, positionStart.textIndex);
        if (maybeTextIndexEnd === undefined) {
            const LexerLinePosition = StringHelpers.graphemePositionAt(lineString.text, positionStart.textIndex);
            throw new LexerError.ExpectedNumericLiteralError(LexerLinePosition);
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

    function readMultilineCommentStart(
        lineString: LexerLineString,
        positionStart: LexerLinePosition,
    ): LineToken {
        const positionEnd: LexerLinePosition = {
            textIndex: positionStart.textIndex + 2,
            columnNumber: positionStart.columnNumber + 2,
        }
        return readTokenFrom(LineTokenKind.MultilineCommentStart, lineString, positionStart, positionEnd);
    }

    function readKeyword(lineString: LexerLineString, positionStart: LexerLinePosition): LineToken {
        const maybeToken: Option<LineToken> = maybeReadKeyword(lineString, positionStart);
        if (maybeToken) {
            return maybeToken;
        }
        else {
            throw unexpectedReadError(lineString.text, positionStart.textIndex);
        }
    }

    function maybeReadKeyword(lineString: LexerLineString, positionStart: LexerLinePosition): Option<LineToken> {
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

    function readQuotedIdentifier(_document: LexerLineString, _position: LexerLinePosition): LineToken {
        throw new Error("not supported");
    }

    // the quoted identifier case has already been taken care of
    // null-literal is also read here
    function readKeywordOrIdentifier(lineString: LexerLineString, positionStart: LexerLinePosition): LineToken {
        const text = lineString.text;
        const textIndexStart = positionStart.textIndex;

        // keyword
        if (text[textIndexStart] === "#") {
            return readKeyword(lineString, positionStart);
        }
        // either keyword or identifier
        else {
            const maybeTextIndexEnd = maybeIndexOfRegexEnd(Pattern.RegExpIdentifier, text, textIndexStart);
            if (maybeTextIndexEnd === undefined) {
                throw unexpectedReadError(text, textIndexStart);
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
                return indexHigh + 1;
            }
        }

        return undefined;
    }

    function unexpectedReadError(
        text: string,
        textIndex: number,
    ): LexerError.UnexpectedReadError {
        const LexerLinePosition = StringHelpers.graphemePositionAt(text, textIndex);
        return new LexerError.UnexpectedReadError(LexerLinePosition);
    }

}
