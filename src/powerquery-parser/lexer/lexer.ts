// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    ArrayUtils,
    Assert,
    CommonError,
    ICancellationToken,
    PartialResult,
    PartialResultKind,
    PartialResultUtils,
    Pattern,
    Result,
    ResultUtils,
    StringUtils,
} from "../common";
import { Keyword, TextUtils, Token } from "../language";
import { LexError } from ".";
import { LexSettings } from "../settings";

// Call Lexer.stateFrom to instantiate a new State instance.
// Lexer functions will return a new state object.
// Call LexerSnapshot.tryFrom to perform a final validation pass before freezing the State.

// The lexer is mostly functional in nature with a few throws to make error propegation easier.
//
// To accomodate being consumed by a VSCode extension the lexer is designed to be line aware.
// Users who don't care about line awareness and simply want a complete lex pass
// can call Lexer.stateFrom using a multiline blob.
//
// The lexer will split it on any valid Power Query newline character.
// Users who want incremental control can instantiate a lexer in the same way,
// then call either appendLine/tryDeleteLine/tryUpdateLine/tryUpdateRange.

export type TriedLex = Result<State, LexError.TLexError>;

export type ErrorLineMap = Map<number, TErrorLine>;

export type TLine = TouchedLine | UntouchedLine | TouchedWithErrorLine | ErrorLine;

export type TErrorLine = ErrorLine | TouchedWithErrorLine;

export const enum LineKind {
    Error = "Error",
    Touched = "Touched",
    TouchedWithError = "TouchedWithError",
    Untouched = "Untouched",
}

// A line's LineMode determines how its tokenized.
// There are two broad categories for a LineMode:
//  * Atomic (single) line tokenization (default)
//  * Continuation of a multiline token (eg. multiline comment)
//
// All LineModes other than Default are a type of multiline tokenization.
export const enum LineMode {
    Comment = "Comment",
    Default = "Default",
    QuotedIdentifier = "QuotedIdentifier",
    Text = "Text",
}

export interface State {
    readonly lines: ReadonlyArray<TLine>;
    readonly locale: string;
    readonly cancellationToken: ICancellationToken | undefined;
}

export interface ILexerLine {
    readonly kind: LineKind;
    readonly text: string;
    readonly lineTerminator: string; // must be a valid Power Query newline character
    readonly lineModeStart: LineMode; // (the previous TLine's lineModeEnd) || LineMode.Default
    readonly lineModeEnd: LineMode;
    readonly tokens: ReadonlyArray<Token.LineToken>;
}

// An error was thrown before anything could be tokenized.
export interface ErrorLine extends ILexerLine {
    readonly kind: LineKind.Error;
    readonly error: LexError.TLexError;
}

// The line was tokenized without issue.
export interface TouchedLine extends ILexerLine {
    readonly kind: LineKind.Touched;
}

// Some tokens were read before an error was thrown.
export interface TouchedWithErrorLine extends ILexerLine {
    readonly kind: LineKind.TouchedWithError;
    readonly error: LexError.TLexError;
}

// The line hasn't been lexed yet.
export interface UntouchedLine extends ILexerLine {
    readonly kind: LineKind.Untouched;
}

export interface Range {
    readonly start: RangePosition;
    readonly end: RangePosition;
}

export interface RangePosition {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

// This export is a Result ensuring wrapper around the un-exported implementation.
export function tryLex(settings: LexSettings, text: string): TriedLex {
    return ensureCommonOrLexerResult(() => lex(settings, text), settings.locale);
}

// This export is a Result ensuring wrapper around the un-exported implementation.
export function tryAppendLine(state: State, text: string, lineTerminator: string): TriedLex {
    return ensureCommonOrLexerResult(() => appendLine(state, text, lineTerminator), state.locale);
}

// This export is a Result ensuring wrapper around the un-exported implementation.
export function tryUpdateLine(state: State, lineNumber: number, text: string): TriedLex {
    return ensureCommonOrLexerResult(() => updateLine(state, lineNumber, text), state.locale);
}

// This export is a Result ensuring wrapper around the un-exported implementation.
export function tryUpdateRange(state: State, range: Range, text: string): TriedLex {
    return ensureCommonOrLexerResult(() => updateRange(state, range, text), state.locale);
}

// This export is a Result ensuring wrapper around the un-exported implementation.
export function tryDeleteLine(state: State, lineNumber: number): TriedLex {
    return ensureCommonOrLexerResult(() => deleteLine(state, lineNumber), state.locale);
}

// deep state comparison
export function equalStates(leftState: State, rightState: State): boolean {
    return equalLines(leftState.lines, rightState.lines);
}

// deep line comparison
// partial equality as ILine.text is ignored
export function equalLines(leftLines: ReadonlyArray<TLine>, rightLines: ReadonlyArray<TLine>): boolean {
    if (leftLines.length !== rightLines.length) {
        return false;
    }

    const numLines: number = leftLines.length;

    for (let lineIndex: number = 0; lineIndex < numLines; lineIndex += 1) {
        const left: TLine = leftLines[lineIndex];
        const right: TLine = rightLines[lineIndex];
        const leftTokens: ReadonlyArray<Token.LineToken> = left.tokens;
        const rightTokens: ReadonlyArray<Token.LineToken> = right.tokens;

        const isEqualQuickCheck: boolean =
            left.kind === right.kind &&
            left.lineTerminator === right.lineTerminator &&
            left.lineModeStart === right.lineModeStart &&
            left.lineModeEnd === right.lineModeEnd &&
            leftTokens.length === rightTokens.length;

        if (!isEqualQuickCheck) {
            return false;
        }

        // isEqualQuickCheck ensures tokens.length is the same
        const numTokens: number = leftTokens.length;

        for (let tokenIndex: number = 0; tokenIndex < numTokens; tokenIndex += 1) {
            if (!equalTokens(leftTokens[tokenIndex], rightTokens[tokenIndex])) {
                return false;
            }
        }
    }

    return true;
}

// deep token comparison
export function equalTokens(leftToken: Token.LineToken, rightToken: Token.LineToken): boolean {
    return (
        leftToken.kind === rightToken.kind &&
        leftToken.data === rightToken.data &&
        leftToken.positionStart === rightToken.positionStart &&
        leftToken.positionEnd === rightToken.positionEnd
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
            throw Assert.isNever(line);
    }
}

export function errorLineMap(state: State): ErrorLineMap | undefined {
    const errorLines: ErrorLineMap = state.lines.reduce((errorLineMap: ErrorLineMap, line: TLine, index: number) => {
        if (isErrorLine(line)) {
            errorLineMap.set(index, line);
        }

        return errorLineMap;
    }, new Map());

    return errorLines.size !== 0 ? errorLines : undefined;
}

interface TokenizeChanges {
    readonly tokens: ReadonlyArray<Token.LineToken>;
    readonly lineModeEnd: LineMode;
}

interface LineModeAlteringRead {
    readonly token: Token.LineToken;
    readonly lineMode: LineMode;
}

// Attributes can't be readOnly.
// In `updateRange` text is updated by adding existing existing lines as a suffix/prefix.
// In `splitOnLineTerminators` lineTerminator is updated as the last must have no terminator, eg. ""
interface SplitLine {
    text: string;
    lineTerminator: string;
}

// Takes a string and splits it on all valid Power Query terminators.
// The split lines retain what newline was used to create the split.
function splitOnLineTerminators(startingText: string): SplitLine[] {
    let lines: SplitLine[] = startingText.split("\r\n").map((lineText: string) => ({
        text: lineText,
        lineTerminator: "\r\n",
    }));

    const lineTerminators: ReadonlyArray<string> = [
        "\n",
        "\u2028", // LINE SEPARATOR
        "\u2029", // PARAGRAPH SEPARATOR
    ];

    let index: number = 0;

    while (index < lines.length) {
        let indexWasExpanded: boolean = false;

        for (const lineTerminator of lineTerminators) {
            const splitLine: SplitLine = lines[index];
            const text: string = splitLine.text;

            if (text.indexOf(lineTerminator) !== -1) {
                indexWasExpanded = true;

                const split: ReadonlyArray<SplitLine> = text.split(lineTerminator).map((lineText: string) => ({
                    text: lineText,
                    lineTerminator,
                }));

                split[split.length - 1].lineTerminator = splitLine.lineTerminator;

                lines = [...lines.slice(0, index), ...split, ...lines.slice(index + 1)];
            }
        }

        if (!indexWasExpanded) {
            index += 1;
        }
    }

    lines[lines.length - 1].lineTerminator = "";

    return lines;
}

function ensureCommonOrLexerResult<T>(
    functionToWrap: () => T,
    locale: string,
): Result<T, CommonError.CommonError | LexError.LexError> {
    try {
        return ResultUtils.boxOk(functionToWrap());
    } catch (error) {
        Assert.isInstanceofError(error);

        let convertedError: CommonError.CommonError | LexError.LexError;

        if (LexError.isTInnerLexError(error)) {
            convertedError = new LexError.LexError(error);
        } else {
            convertedError = CommonError.ensureCommonError(error, locale);
        }

        return ResultUtils.boxError(convertedError);
    }
}

function lex(settings: LexSettings, text: string): State {
    const splitLines: ReadonlyArray<SplitLine> = splitOnLineTerminators(text);

    const tokenizedLines: ReadonlyArray<TLine> = tokenizedLinesFrom(
        splitLines,
        LineMode.Default,
        settings.locale,
        settings.cancellationToken,
    );

    return {
        lines: tokenizedLines,
        locale: settings.locale,
        cancellationToken: settings.cancellationToken,
    };
}

function appendLine(state: State, text: string, lineTerminator: string): State {
    state.cancellationToken?.throwIfCancelled();

    const lines: ReadonlyArray<TLine> = state.lines;
    const numLines: number = lines.length;
    const latestLine: TLine | undefined = lines[numLines - 1];
    const lineModeStart: LineMode = latestLine ? latestLine.lineModeEnd : LineMode.Default;
    const untokenizedLine: UntouchedLine = lineFrom(text, lineTerminator, lineModeStart);
    const tokenizedLine: TLine = tokenize(untokenizedLine, numLines, state.locale, state.cancellationToken);

    return {
        ...state,
        lines: state.lines.concat(tokenizedLine),
    };
}

function updateLine(state: State, lineNumber: number, text: string): State {
    state.cancellationToken?.throwIfCancelled();

    const error: LexError.BadLineNumberError | undefined = testLineNumberError(state, lineNumber);

    if (error !== undefined) {
        throw error;
    }

    const line: TLine = state.lines[lineNumber];
    const range: Range = rangeFrom(line, lineNumber);

    return updateRange(state, range, text);
}

function updateRange(state: State, range: Range, text: string): State {
    state.cancellationToken?.throwIfCancelled();

    const error: LexError.BadRangeError | undefined = testBadRangeError(state, range);

    if (error !== undefined) {
        throw error;
    }

    const splitLines: SplitLine[] = splitOnLineTerminators(text);

    const rangeStart: RangePosition = range.start;
    const lineStart: TLine = state.lines[rangeStart.lineNumber];
    const textPrefix: string = lineStart.text.substring(0, rangeStart.lineCodeUnit);
    splitLines[0].text = textPrefix + splitLines[0].text;

    const rangeEnd: RangePosition = range.end;
    const lineEnd: TLine = state.lines[rangeEnd.lineNumber];
    const textSuffix: string = lineEnd.text.substr(rangeEnd.lineCodeUnit);
    const lastSplitLine: SplitLine = splitLines[splitLines.length - 1];
    lastSplitLine.text = lastSplitLine.text + textSuffix;

    // make sure we have a line terminator
    lastSplitLine.lineTerminator = lineEnd.lineTerminator;

    const previousLine: TLine | undefined = state.lines[rangeStart.lineNumber - 1];
    const previousLineModeEnd: LineMode = previousLine?.lineModeEnd ?? LineMode.Default;

    const newLines: ReadonlyArray<TLine> = tokenizedLinesFrom(
        splitLines,
        previousLineModeEnd,
        state.locale,
        state.cancellationToken,
    );

    const lines: ReadonlyArray<TLine> = [
        ...state.lines.slice(0, rangeStart.lineNumber),
        ...newLines,
        ...retokenizeLines(state, rangeEnd.lineNumber + 1, newLines[newLines.length - 1].lineModeEnd),
    ];

    return {
        lines,
        locale: state.locale,
        cancellationToken: state.cancellationToken,
    };
}

function deleteLine(state: State, lineNumber: number): State {
    state.cancellationToken?.throwIfCancelled();

    const error: LexError.BadLineNumberError | undefined = testLineNumberError(state, lineNumber);

    if (error !== undefined) {
        throw error;
    }

    return {
        ...state,
        lines: ArrayUtils.removeAtIndex(state.lines, lineNumber),
    };
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

function graphemePositionFrom(text: string, lineNumber: number, lineCodeUnit: number): StringUtils.GraphemePosition {
    return StringUtils.graphemePositionFrom(text, lineCodeUnit, lineNumber, undefined);
}

function rangeFrom(line: TLine, lineNumber: number): Range {
    return {
        start: {
            lineNumber,
            lineCodeUnit: 0,
        },
        end: {
            lineNumber,
            lineCodeUnit: line.text.length,
        },
    };
}

function tokenizedLinesFrom(
    splitLines: ReadonlyArray<SplitLine>,
    previousLineModeEnd: LineMode,
    locale: string,
    cancellationToken: ICancellationToken | undefined,
): ReadonlyArray<TLine> {
    const numLines: number = splitLines.length;
    const tokenizedLines: TLine[] = [];

    for (let lineNumber: number = 0; lineNumber < numLines; lineNumber += 1) {
        const splitLine: SplitLine = splitLines[lineNumber];
        const untokenizedLine: UntouchedLine = lineFrom(splitLine.text, splitLine.lineTerminator, previousLineModeEnd);
        const tokenizedLine: TLine = tokenize(untokenizedLine, lineNumber, locale, cancellationToken);
        tokenizedLines.push(tokenizedLine);
        previousLineModeEnd = tokenizedLine.lineModeEnd;
    }

    return tokenizedLines;
}

// If an earlier line changed its lineModeEnd, eg. inserting a `"` to start a string literal,
// then the proceeding lines would need to be retokenized.
// Stops retokenizing when previous.lineModeEnd !== current.lineModeStart.
// Returns lines in the range [lineNumber, lines.length -1]
function retokenizeLines(state: State, lineNumber: number, previousLineModeEnd: LineMode): ReadonlyArray<TLine> {
    const lines: ReadonlyArray<TLine> = state.lines;

    if (lines[lineNumber] === undefined) {
        return [];
    }

    const retokenizedLines: TLine[] = [];

    if (previousLineModeEnd !== lines[lineNumber].lineModeStart) {
        const offsetLineNumber: number = lineNumber;
        let currentLine: TLine | undefined = lines[lineNumber];

        while (currentLine) {
            const line: TLine = currentLine;

            if (previousLineModeEnd !== line.lineModeStart) {
                const untokenizedLine: UntouchedLine = lineFrom(line.text, line.lineTerminator, previousLineModeEnd);

                const retokenizedLine: TLine = tokenize(
                    untokenizedLine,
                    offsetLineNumber,
                    state.locale,
                    state.cancellationToken,
                );

                retokenizedLines.push(retokenizedLine);
                previousLineModeEnd = retokenizedLine.lineModeEnd;
                lineNumber += 1;
                currentLine = lines[lineNumber];
            } else {
                return [...retokenizedLines, ...lines.slice(lineNumber + 1)];
            }
        }

        return retokenizedLines;
    } else {
        return lines.slice(lineNumber);
    }
}

// The main function of the lexer's tokenizer.
function tokenize(
    line: TLine,
    lineNumber: number,
    locale: string,
    cancellationToken: ICancellationToken | undefined,
): TLine {
    cancellationToken?.throwIfCancelled();

    switch (line.kind) {
        // Cannot tokenize something that ended with an error,
        // nothing has changed since the last tokenize.
        // Update the line's text before trying again.
        case LineKind.Error:
            return line;

        case LineKind.Touched:
            // The line was already fully lexed once.
            // Without any text changes it should throw eof to help diagnose
            // why it's trying to retokenize.
            return {
                ...line,
                kind: LineKind.Error,
                error: new LexError.LexError(new LexError.EndOfStreamError(locale)),
            };

        // Cannot tokenize something that previously ended with an error.
        // Update the line's text before trying again.
        case LineKind.TouchedWithError:
            return {
                kind: LineKind.Error,
                text: line.text,
                lineTerminator: line.lineTerminator,
                lineModeStart: line.lineModeStart,
                lineModeEnd: line.lineModeEnd,
                tokens: line.tokens,
                error: new LexError.LexError(new LexError.BadStateError(line.error, locale)),
            };

        case LineKind.Untouched:
            break;

        default:
            throw Assert.isNever(line);
    }

    const untouchedLine: UntouchedLine = line;
    const text: string = untouchedLine.text;
    const textLength: number = text.length;

    // If there's nothing to tokenize set lineModeEnd to lineModeStart.
    if (textLength === 0) {
        return {
            kind: LineKind.Touched,
            text: line.text,
            lineTerminator: line.lineTerminator,
            lineModeStart: line.lineModeStart,
            lineModeEnd: line.lineModeStart,
            tokens: [],
        };
    }

    let lineMode: LineMode = line.lineModeStart;
    let currentPosition: number = 0;

    if (lineMode === LineMode.Default) {
        currentPosition = drainWhitespace(text, currentPosition);
    }

    const newTokens: Token.LineToken[] = [];
    let continueLexing: boolean = currentPosition !== text.length;
    let lexError: LexError.TLexError | undefined;

    // While neither eof nor having encountered an error:
    //  * Lex according to lineModeStart, starting from currentPosition.
    //  * Update currentPosition and lineMode.
    //  * Drain whitespace.
    while (continueLexing) {
        cancellationToken?.throwIfCancelled();

        try {
            let readOutcome: LineModeAlteringRead;

            switch (lineMode) {
                case LineMode.Comment:
                    readOutcome = tokenizeMultilineCommentContentOrEnd(line, currentPosition);
                    break;

                case LineMode.Default:
                    readOutcome = tokenizeDefault(line, lineNumber, currentPosition, locale);
                    break;

                case LineMode.QuotedIdentifier:
                    readOutcome = tokenizeQuotedIdentifierContentOrEnd(line, currentPosition);
                    break;

                case LineMode.Text:
                    readOutcome = tokenizeTextLiteralContentOrEnd(line, currentPosition);
                    break;

                default:
                    throw Assert.isNever(lineMode);
            }

            lineMode = readOutcome.lineMode;
            const token: Token.LineToken = readOutcome.token;
            newTokens.push(token);

            if (lineMode === LineMode.Default) {
                currentPosition = drainWhitespace(text, token.positionEnd);
            } else {
                currentPosition = token.positionEnd;
            }

            if (currentPosition === textLength) {
                continueLexing = false;
            }
        } catch (exception) {
            let error: LexError.TLexError;

            if (LexError.isTInnerLexError(exception)) {
                error = new LexError.LexError(exception);
            } else {
                Assert.isInstanceofError(exception);
                error = CommonError.ensureCommonError(exception, locale);
            }

            continueLexing = false;
            lexError = error;
        }
    }

    let partialTokenizeResult: PartialResult<TokenizeChanges, TokenizeChanges, LexError.TLexError>;

    if (lexError) {
        if (newTokens.length) {
            partialTokenizeResult = PartialResultUtils.createMixed(
                {
                    tokens: newTokens,
                    lineModeEnd: lineMode,
                },
                lexError,
            );
        } else {
            partialTokenizeResult = PartialResultUtils.createError(lexError);
        }
    } else {
        partialTokenizeResult = PartialResultUtils.createOk({
            tokens: newTokens,
            lineModeEnd: lineMode,
        });
    }

    return updateLineState(line, partialTokenizeResult);
}

// Takes the return from a tokenizeX function to updates the TLine's state.
function updateLineState(
    line: TLine,
    tokenizePartialResult: PartialResult<TokenizeChanges, TokenizeChanges, LexError.TLexError>,
): TLine {
    switch (tokenizePartialResult.kind) {
        case PartialResultKind.Ok: {
            const tokenizeChanges: TokenizeChanges = tokenizePartialResult.value;
            const newTokens: ReadonlyArray<Token.LineToken> = line.tokens.concat(tokenizeChanges.tokens);

            return {
                kind: LineKind.Touched,
                text: line.text,
                lineTerminator: line.lineTerminator,
                lineModeStart: line.lineModeStart,
                lineModeEnd: tokenizeChanges.lineModeEnd,
                tokens: newTokens,
            };
        }

        case PartialResultKind.Mixed: {
            const tokenizeChanges: TokenizeChanges = tokenizePartialResult.value;
            const newTokens: ReadonlyArray<Token.LineToken> = line.tokens.concat(tokenizeChanges.tokens);

            return {
                kind: LineKind.TouchedWithError,
                text: line.text,
                lineTerminator: line.lineTerminator,
                lineModeStart: line.lineModeStart,
                lineModeEnd: tokenizeChanges.lineModeEnd,
                tokens: newTokens,
                error: tokenizePartialResult.error,
            };
        }

        case PartialResultKind.Error:
            return {
                kind: LineKind.Error,
                text: line.text,
                lineModeStart: line.lineModeStart,
                lineTerminator: line.lineTerminator,
                lineModeEnd: line.lineModeEnd,
                tokens: line.tokens,
                error: tokenizePartialResult.error,
            };

        default:
            throw Assert.isNever(tokenizePartialResult);
    }
}

// Read until either "*/" or eof
function tokenizeMultilineCommentContentOrEnd(line: TLine, positionStart: number): LineModeAlteringRead {
    const text: string = line.text;
    const indexOfCloseComment: number = text.indexOf("*/", positionStart);

    if (indexOfCloseComment === -1) {
        return {
            token: readRestOfLine(Token.LineTokenKind.MultilineCommentContent, text, positionStart),
            lineMode: LineMode.Comment,
        };
    } else {
        const positionEnd: number = indexOfCloseComment + 2;

        return {
            token: readTokenFrom(Token.LineTokenKind.MultilineCommentEnd, text, positionStart, positionEnd),
            lineMode: LineMode.Default,
        };
    }
}

// Read until either string literal end or eof
function tokenizeQuotedIdentifierContentOrEnd(line: TLine, currentPosition: number): LineModeAlteringRead {
    const read: LineModeAlteringRead = tokenizeTextLiteralContentOrEnd(line, currentPosition);

    switch (read.token.kind) {
        case Token.LineTokenKind.TextLiteralContent:
            return {
                lineMode: LineMode.QuotedIdentifier,
                token: {
                    ...read.token,
                    kind: Token.LineTokenKind.QuotedIdentifierContent,
                },
            };

        case Token.LineTokenKind.TextLiteralEnd:
            return {
                lineMode: LineMode.Default,
                token: {
                    ...read.token,
                    kind: Token.LineTokenKind.QuotedIdentifierEnd,
                },
            };

        default:
            throw new CommonError.InvariantError(
                `expected the return to be either ${Token.LineTokenKind.TextLiteralContent} or ${Token.LineTokenKind.TextLiteralEnd}`,
                { read },
            );
    }
}

// Read until either string literal end or eof
function tokenizeTextLiteralContentOrEnd(line: TLine, currentPosition: number): LineModeAlteringRead {
    const text: string = line.text;
    const positionEnd: number | undefined = maybeIndexOfTextEnd(text, currentPosition);

    if (positionEnd === undefined) {
        return {
            token: readRestOfLine(Token.LineTokenKind.TextLiteralContent, text, currentPosition),
            lineMode: LineMode.Text,
        };
    } else {
        return {
            token: readTokenFrom(Token.LineTokenKind.TextLiteralEnd, text, currentPosition, positionEnd + 1),
            lineMode: LineMode.Default,
        };
    }
}

function tokenizeDefault(line: TLine, lineNumber: number, positionStart: number, locale: string): LineModeAlteringRead {
    const text: string = line.text;

    const chr1: string = text[positionStart];
    let token: Token.LineToken;
    let lineMode: LineMode = LineMode.Default;

    if (chr1 === "!") {
        token = readConstant(Token.LineTokenKind.Bang, text, positionStart, 1);
    } else if (chr1 === "&") {
        token = readConstant(Token.LineTokenKind.Ampersand, text, positionStart, 1);
    } else if (chr1 === "(") {
        token = readConstant(Token.LineTokenKind.LeftParenthesis, text, positionStart, 1);
    } else if (chr1 === ")") {
        token = readConstant(Token.LineTokenKind.RightParenthesis, text, positionStart, 1);
    } else if (chr1 === "*") {
        token = readConstant(Token.LineTokenKind.Asterisk, text, positionStart, 1);
    } else if (chr1 === "+") {
        token = readConstant(Token.LineTokenKind.Plus, text, positionStart, 1);
    } else if (chr1 === ",") {
        token = readConstant(Token.LineTokenKind.Comma, text, positionStart, 1);
    } else if (chr1 === "-") {
        token = readConstant(Token.LineTokenKind.Minus, text, positionStart, 1);
    } else if (chr1 === ";") {
        token = readConstant(Token.LineTokenKind.Semicolon, text, positionStart, 1);
    } else if (chr1 === "?") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "?") {
            token = readConstant(Token.LineTokenKind.NullCoalescingOperator, text, positionStart, 2);
        } else {
            token = readConstant(Token.LineTokenKind.QuestionMark, text, positionStart, 1);
        }
    } else if (chr1 === "@") {
        token = readConstant(Token.LineTokenKind.AtSign, text, positionStart, 1);
    } else if (chr1 === "[") {
        token = readConstant(Token.LineTokenKind.LeftBracket, text, positionStart, 1);
    } else if (chr1 === "]") {
        token = readConstant(Token.LineTokenKind.RightBracket, text, positionStart, 1);
    } else if (chr1 === "{") {
        token = readConstant(Token.LineTokenKind.LeftBrace, text, positionStart, 1);
    } else if (chr1 === "}") {
        token = readConstant(Token.LineTokenKind.RightBrace, text, positionStart, 1);
    } else if (chr1 === '"') {
        const read: LineModeAlteringRead = readOrStartTextLiteral(text, positionStart);
        token = read.token;
        lineMode = read.lineMode;
    } else if (chr1 === "0") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "x" || chr2 === "X") {
            token = readHexLiteral(text, lineNumber, positionStart, locale);
        } else {
            token = readNumericLiteral(text, lineNumber, positionStart, locale);
        }
    } else if ("1" <= chr1 && chr1 <= "9") {
        token = readNumericLiteral(text, lineNumber, positionStart, locale);
    } else if (chr1 === ".") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === undefined) {
            throw new LexError.UnexpectedEofError(graphemePositionFrom(text, lineNumber, positionStart), locale);
        } else if ("1" <= chr2 && chr2 <= "9") {
            token = readNumericLiteral(text, lineNumber, positionStart, locale);
        } else if (chr2 === ".") {
            const chr3: string = text[positionStart + 2];

            if (chr3 === ".") {
                token = readConstant(Token.LineTokenKind.Ellipsis, text, positionStart, 3);
            } else {
                token = readConstant(Token.LineTokenKind.DotDot, text, positionStart, 2);
            }
        } else {
            throw unexpectedReadError(locale, text, lineNumber, positionStart);
        }
    } else if (chr1 === ">") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "=") {
            token = readConstant(Token.LineTokenKind.GreaterThanEqualTo, text, positionStart, 2);
        } else {
            token = readConstant(Token.LineTokenKind.GreaterThan, text, positionStart, 1);
        }
    } else if (chr1 === "<") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "=") {
            token = readConstant(Token.LineTokenKind.LessThanEqualTo, text, positionStart, 2);
        } else if (chr2 === ">") {
            token = readConstant(Token.LineTokenKind.NotEqual, text, positionStart, 2);
        } else {
            token = readConstant(Token.LineTokenKind.LessThan, text, positionStart, 1);
        }
    } else if (chr1 === "=") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === ">") {
            token = readConstant(Token.LineTokenKind.FatArrow, text, positionStart, 2);
        } else {
            token = readConstant(Token.LineTokenKind.Equal, text, positionStart, 1);
        }
    } else if (chr1 === "/") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "/") {
            token = readLineComment(text, positionStart);
        } else if (chr2 === "*") {
            const read: LineModeAlteringRead = readOrStartMultilineComment(text, positionStart);
            token = read.token;
            lineMode = read.lineMode;
        } else {
            token = readConstant(Token.LineTokenKind.Division, text, positionStart, 1);
        }
    } else if (chr1 === "#") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === '"') {
            const read: LineModeAlteringRead = readOrStartQuotedIdentifier(text, positionStart);
            token = read.token;
            lineMode = read.lineMode;
        } else {
            token = readKeyword(text, lineNumber, positionStart, locale);
        }
    } else {
        token = readKeywordOrIdentifier(text, lineNumber, positionStart, locale);
    }

    return {
        token,
        lineMode,
    };
}

// newlines are not considered whitespace
function drainWhitespace(text: string, position: number): number {
    let continueDraining: boolean = text[position] !== undefined;

    while (continueDraining) {
        const maybeLength: number | undefined = StringUtils.regexMatchLength(Pattern.Whitespace, text, position);

        if (maybeLength) {
            position += maybeLength;
        } else {
            continueDraining = false;
        }
    }

    return position;
}

function readOrStartTextLiteral(text: string, currentPosition: number): LineModeAlteringRead {
    const maybePositionEnd: number | undefined = maybeIndexOfTextEnd(text, currentPosition + 1);

    if (maybePositionEnd !== undefined) {
        const positionEnd: number = maybePositionEnd + 1;

        return {
            token: readTokenFrom(Token.LineTokenKind.TextLiteral, text, currentPosition, positionEnd),
            lineMode: LineMode.Default,
        };
    } else {
        return {
            token: readRestOfLine(Token.LineTokenKind.TextLiteralStart, text, currentPosition),
            lineMode: LineMode.Text,
        };
    }
}

function readHexLiteral(text: string, lineNumber: number, positionStart: number, locale: string): Token.LineToken {
    const maybePositionEnd: number | undefined = maybeIndexOfRegexEnd(Pattern.Hex, text, positionStart);

    if (maybePositionEnd === undefined) {
        throw new LexError.ExpectedError(
            graphemePositionFrom(text, lineNumber, positionStart),
            LexError.ExpectedKind.HexLiteral,
            locale,
        );
    }

    const positionEnd: number = maybePositionEnd;

    return readTokenFrom(Token.LineTokenKind.HexLiteral, text, positionStart, positionEnd);
}

function readNumericLiteral(text: string, lineNumber: number, positionStart: number, locale: string): Token.LineToken {
    const maybePositionEnd: number | undefined = maybeIndexOfRegexEnd(Pattern.Numeric, text, positionStart);

    if (maybePositionEnd === undefined) {
        throw new LexError.ExpectedError(
            graphemePositionFrom(text, lineNumber, positionStart),
            LexError.ExpectedKind.Numeric,
            locale,
        );
    }

    const positionEnd: number = maybePositionEnd;

    return readTokenFrom(Token.LineTokenKind.NumericLiteral, text, positionStart, positionEnd);
}

function readLineComment(text: string, positionStart: number): Token.LineToken {
    return readRestOfLine(Token.LineTokenKind.LineComment, text, positionStart);
}

function readOrStartMultilineComment(text: string, positionStart: number): LineModeAlteringRead {
    const indexOfCloseComment: number = text.indexOf("*/", positionStart + 2);

    if (indexOfCloseComment === -1) {
        return {
            token: readRestOfLine(Token.LineTokenKind.MultilineCommentStart, text, positionStart),
            lineMode: LineMode.Comment,
        };
    } else {
        const positionEnd: number = indexOfCloseComment + 2;

        return {
            token: readTokenFrom(Token.LineTokenKind.MultilineComment, text, positionStart, positionEnd),
            lineMode: LineMode.Default,
        };
    }
}

function readKeyword(text: string, lineNumber: number, positionStart: number, locale: string): Token.LineToken {
    const maybeLineToken: Token.LineToken | undefined = maybeReadKeyword(text, positionStart);

    if (maybeLineToken) {
        return maybeLineToken;
    } else {
        throw unexpectedReadError(locale, text, lineNumber, positionStart);
    }
}

function maybeReadKeyword(text: string, currentPosition: number): Token.LineToken | undefined {
    const identifierPositionStart: number = text[currentPosition] === "#" ? currentPosition + 1 : currentPosition;

    const maybeIdentifierPositionEnd: number | undefined = maybeIndexOfIdentifierEnd(text, identifierPositionStart);

    if (maybeIdentifierPositionEnd === undefined) {
        return undefined;
    }

    const identifierPositionEnd: number = maybeIdentifierPositionEnd;

    const data: string = text.substring(currentPosition, identifierPositionEnd);
    const maybeKeywordTokenKind: Token.LineTokenKind | undefined = maybeKeywordLineTokenKindFrom(data);

    if (maybeKeywordTokenKind === undefined) {
        return undefined;
    } else {
        return {
            kind: maybeKeywordTokenKind,
            positionStart: currentPosition,
            positionEnd: identifierPositionEnd,
            data,
        };
    }
}

function readOrStartQuotedIdentifier(text: string, currentPosition: number): LineModeAlteringRead {
    const maybePositionEnd: number | undefined = maybeIndexOfTextEnd(text, currentPosition + 2);

    if (maybePositionEnd !== undefined) {
        const positionEnd: number = maybePositionEnd + 1;

        return {
            token: readTokenFrom(Token.LineTokenKind.Identifier, text, currentPosition, positionEnd),
            lineMode: LineMode.Default,
        };
    } else {
        return {
            token: readRestOfLine(Token.LineTokenKind.QuotedIdentifierStart, text, currentPosition),
            lineMode: LineMode.QuotedIdentifier,
        };
    }
}

// The case for quoted identifier has already been taken care of.
// The null-literal is also read here.
function readKeywordOrIdentifier(
    text: string,
    lineNumber: number,
    positionStart: number,
    locale: string,
): Token.LineToken {
    // keyword
    if (text[positionStart] === "#") {
        return readKeyword(text, lineNumber, positionStart, locale);
    }
    // either keyword or identifier
    else {
        const maybePositionEnd: number | undefined = maybeIndexOfIdentifierEnd(text, positionStart);

        if (maybePositionEnd === undefined) {
            throw new LexError.ExpectedError(
                graphemePositionFrom(text, lineNumber, positionStart),
                LexError.ExpectedKind.KeywordOrIdentifier,
                locale,
            );
        }

        const positionEnd: number = maybePositionEnd;
        const data: string = text.substring(positionStart, positionEnd);
        const maybeKeywordTokenKind: Token.LineTokenKind | undefined = maybeKeywordLineTokenKindFrom(data);

        let tokenKind: Token.LineTokenKind;

        if (maybeKeywordTokenKind !== undefined) {
            tokenKind = maybeKeywordTokenKind;
        } else if (data === "null") {
            tokenKind = Token.LineTokenKind.NullLiteral;
        } else {
            tokenKind = Token.LineTokenKind.Identifier;
        }

        return {
            kind: tokenKind,
            positionStart,
            positionEnd,
            data,
        };
    }
}

function readConstant(
    lineTokenKind: Token.LineTokenKind,
    text: string,
    positionStart: number,
    length: number,
): Token.LineToken {
    const positionEnd: number = positionStart + length;

    return readTokenFrom(lineTokenKind, text, positionStart, positionEnd);
}

function readTokenFrom(
    lineTokenKind: Token.LineTokenKind,
    text: string,
    positionStart: number,
    positionEnd: number,
): Token.LineToken {
    return {
        kind: lineTokenKind,
        positionStart,
        positionEnd,
        data: text.substring(positionStart, positionEnd),
    };
}

function readRestOfLine(lineTokenKind: Token.LineTokenKind, text: string, positionStart: number): Token.LineToken {
    const positionEnd: number = text.length;

    return readTokenFrom(lineTokenKind, text, positionStart, positionEnd);
}

function maybeIndexOfRegexEnd(pattern: RegExp, text: string, positionStart: number): number | undefined {
    const maybeLength: number | undefined = StringUtils.regexMatchLength(pattern, text, positionStart);

    return maybeLength !== undefined ? positionStart + maybeLength : undefined;
}

function maybeIndexOfIdentifierEnd(text: string, positionStart: number): number | undefined {
    const maybeLength: number | undefined = TextUtils.identifierLength(text, positionStart, true);

    return maybeLength !== undefined ? positionStart + maybeLength : undefined;
}

function maybeKeywordLineTokenKindFrom(data: string): Token.LineTokenKind | undefined {
    switch (data) {
        case Keyword.KeywordKind.And:
            return Token.LineTokenKind.KeywordAnd;
        case Keyword.KeywordKind.As:
            return Token.LineTokenKind.KeywordAs;
        case Keyword.KeywordKind.Each:
            return Token.LineTokenKind.KeywordEach;
        case Keyword.KeywordKind.Else:
            return Token.LineTokenKind.KeywordElse;
        case Keyword.KeywordKind.Error:
            return Token.LineTokenKind.KeywordError;
        case Keyword.KeywordKind.False:
            return Token.LineTokenKind.KeywordFalse;
        case Keyword.KeywordKind.If:
            return Token.LineTokenKind.KeywordIf;
        case Keyword.KeywordKind.In:
            return Token.LineTokenKind.KeywordIn;
        case Keyword.KeywordKind.Is:
            return Token.LineTokenKind.KeywordIs;
        case Keyword.KeywordKind.Let:
            return Token.LineTokenKind.KeywordLet;
        case Keyword.KeywordKind.Meta:
            return Token.LineTokenKind.KeywordMeta;
        case Keyword.KeywordKind.Not:
            return Token.LineTokenKind.KeywordNot;
        case Keyword.KeywordKind.Or:
            return Token.LineTokenKind.KeywordOr;
        case Keyword.KeywordKind.Otherwise:
            return Token.LineTokenKind.KeywordOtherwise;
        case Keyword.KeywordKind.Section:
            return Token.LineTokenKind.KeywordSection;
        case Keyword.KeywordKind.Shared:
            return Token.LineTokenKind.KeywordShared;
        case Keyword.KeywordKind.Then:
            return Token.LineTokenKind.KeywordThen;
        case Keyword.KeywordKind.True:
            return Token.LineTokenKind.KeywordTrue;
        case Keyword.KeywordKind.Try:
            return Token.LineTokenKind.KeywordTry;
        case Keyword.KeywordKind.Type:
            return Token.LineTokenKind.KeywordType;
        case Keyword.KeywordKind.HashBinary:
            return Token.LineTokenKind.KeywordHashBinary;
        case Keyword.KeywordKind.HashDate:
            return Token.LineTokenKind.KeywordHashDate;
        case Keyword.KeywordKind.HashDateTime:
            return Token.LineTokenKind.KeywordHashDateTime;
        case Keyword.KeywordKind.HashDateTimeZone:
            return Token.LineTokenKind.KeywordHashDateTimeZone;
        case Keyword.KeywordKind.HashDuration:
            return Token.LineTokenKind.KeywordHashDuration;
        case Keyword.KeywordKind.HashInfinity:
            return Token.LineTokenKind.KeywordHashInfinity;
        case Keyword.KeywordKind.HashNan:
            return Token.LineTokenKind.KeywordHashNan;
        case Keyword.KeywordKind.HashSections:
            return Token.LineTokenKind.KeywordHashSections;
        case Keyword.KeywordKind.HashShared:
            return Token.LineTokenKind.KeywordHashShared;
        case Keyword.KeywordKind.HashTable:
            return Token.LineTokenKind.KeywordHashTable;
        case Keyword.KeywordKind.HashTime:
            return Token.LineTokenKind.KeywordHashTime;
        default:
            return undefined;
    }
}

function maybeIndexOfTextEnd(text: string, positionStart: number): number | undefined {
    let indexLow: number = positionStart;
    let positionEnd: number = text.indexOf('"', indexLow);

    while (positionEnd !== -1) {
        if (text[positionEnd + 1] === '"') {
            indexLow = positionEnd + 2;
            positionEnd = text.indexOf('"', indexLow);
        } else {
            return positionEnd;
        }
    }

    return undefined;
}

function unexpectedReadError(
    locale: string,
    text: string,
    lineNumber: number,
    lineCodeUnit: number,
): LexError.UnexpectedReadError {
    return new LexError.UnexpectedReadError(graphemePositionFrom(text, lineNumber, lineCodeUnit), locale);
}

function testLineNumberError(state: State, lineNumber: number): LexError.BadLineNumberError | undefined {
    const numLines: number = state.lines.length;

    if (lineNumber >= numLines) {
        return new LexError.BadLineNumberError(
            LexError.BadLineNumberKind.GreaterThanNumLines,
            lineNumber,
            numLines,
            state.locale,
        );
    } else if (lineNumber < 0) {
        return new LexError.BadLineNumberError(
            LexError.BadLineNumberKind.LessThanZero,
            lineNumber,
            numLines,
            state.locale,
        );
    } else {
        return undefined;
    }
}

// Validator for Range.
function testBadRangeError(state: State, range: Range): LexError.BadRangeError | undefined {
    const start: RangePosition = range.start;
    const end: RangePosition = range.end;
    const numLines: number = state.lines.length;

    let maybeKind: LexError.BadRangeKind | undefined;

    if (start.lineNumber === end.lineNumber && start.lineCodeUnit > end.lineCodeUnit) {
        maybeKind = LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher;
    } else if (start.lineNumber > end.lineNumber) {
        maybeKind = LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd;
    } else if (start.lineNumber < 0) {
        maybeKind = LexError.BadRangeKind.LineNumberStart_LessThan_Zero;
    } else if (start.lineNumber >= numLines) {
        maybeKind = LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines;
    } else if (end.lineNumber >= numLines) {
        maybeKind = LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines;
    }

    if (maybeKind !== undefined) {
        const kind: LexError.BadRangeKind = maybeKind;

        return new LexError.BadRangeError(range, kind, state.locale);
    }

    const lines: ReadonlyArray<TLine> = state.lines;
    const rangeStart: RangePosition = range.start;
    const rangeEnd: RangePosition = range.end;

    const lineStart: TLine = lines[rangeStart.lineNumber];
    const lineEnd: TLine = lines[rangeEnd.lineNumber];

    if (rangeStart.lineCodeUnit > lineStart.text.length) {
        maybeKind = LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength;
    } else if (rangeEnd.lineCodeUnit > lineEnd.text.length) {
        maybeKind = LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength;
    }

    if (maybeKind !== undefined) {
        return new LexError.BadRangeError(range, maybeKind, state.locale);
    }

    return undefined;
}
