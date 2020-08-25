// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LexError } from ".";
import { Language } from "..";
import {
    Assert,
    CommonError,
    PartialResult,
    PartialResultKind,
    PartialResultUtils,
    Pattern,
    Result,
    ResultUtils,
    StringUtils,
} from "../common";
import { getLocalizationTemplates, ILocalizationTemplates } from "../localization";
import { LexSettings } from "../settings";

// Call Lexer.stateFrom to instantiate a new State instance.
// Lexer functions will return a new state object.
// Call LexerSnapshot.tryFrom to perform a final validation pass before freezing the State.

// The lexer is mostly functional in nature,
// with a few throws to make error propegation to prevent a bunch of checks against a Result.
//
// To accomodate being consumed by a VSCode extension the lexer is designed to be line aware.
// Users who don't care about line awareness can simply call Lexer.stateFrom and pass in a multiline blob.
//
// The lexer will split it on any valid M newline character.
// Users who want incremental control can instantiate a lexer in the same way,
// then call either appendLine/tryDeleteLine/tryUpdateLine/tryUpdateRange.

export type TriedLexerUpdate = Result<State, LexError.LexError>;

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
    readonly localizationTemplates: ILocalizationTemplates;
}

export interface ILexerLine {
    readonly kind: LineKind;
    readonly text: string;
    readonly lineTerminator: string; // must be a valid Power Query newline character
    readonly lineModeStart: LineMode; // (the previous TLine's lineModeEnd) || LineMode.Default
    readonly lineModeEnd: LineMode;
    readonly tokens: ReadonlyArray<Language.LineToken>;
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

export function stateFrom(settings: LexSettings, text: string): State {
    const localizationTemplates: ILocalizationTemplates = getLocalizationTemplates(settings.locale);
    const splitLines: ReadonlyArray<SplitLine> = splitOnLineTerminators(text);
    const tokenizedLines: ReadonlyArray<TLine> = tokenizedLinesFrom(
        getLocalizationTemplates(settings.locale),
        splitLines,
        LineMode.Default,
    );
    return {
        lines: tokenizedLines,
        localizationTemplates,
    };
}

export function appendLine(state: State, text: string, lineTerminator: string): State {
    const lines: ReadonlyArray<TLine> = state.lines;
    const numLines: number = lines.length;
    const maybeLatestLine: TLine | undefined = lines[numLines - 1];
    const lineModeStart: LineMode = maybeLatestLine ? maybeLatestLine.lineModeEnd : LineMode.Default;
    const untokenizedLine: UntouchedLine = lineFrom(text, lineTerminator, lineModeStart);
    const tokenizedLine: TLine = tokenize(state.localizationTemplates, untokenizedLine, numLines);

    return {
        ...state,
        lines: state.lines.concat(tokenizedLine),
    };
}

export function tryUpdateLine(state: State, lineNumber: number, text: string): TriedLexerUpdate {
    const lines: ReadonlyArray<TLine> = state.lines;

    const maybeError: LexError.BadLineNumberError | undefined = maybeBadLineNumberError(state, lineNumber);
    if (maybeError) {
        return ResultUtils.errFactory(new LexError.LexError(maybeError));
    }

    const line: TLine = lines[lineNumber];
    const range: Range = rangeFrom(line, lineNumber);
    return tryUpdateRange(state, range, text);
}

export function tryUpdateRange(state: State, range: Range, text: string): TriedLexerUpdate {
    const maybeError: LexError.BadRangeError | undefined = maybeBadRangeError(state, range);
    if (maybeError) {
        return ResultUtils.errFactory(new LexError.LexError(maybeError));
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

    const maybePreviousLine: TLine | undefined = state.lines[rangeStart.lineNumber - 1];
    const previousLineModeEnd: LineMode = maybePreviousLine?.lineModeEnd ?? LineMode.Default;
    const newLines: ReadonlyArray<TLine> = tokenizedLinesFrom(
        state.localizationTemplates,
        splitLines,
        previousLineModeEnd,
    );

    const lines: ReadonlyArray<TLine> = [
        ...state.lines.slice(0, rangeStart.lineNumber),
        ...newLines,
        ...retokenizeLines(state, rangeEnd.lineNumber + 1, newLines[newLines.length - 1].lineModeEnd),
    ];

    return ResultUtils.okFactory({
        lines,
        localizationTemplates: state.localizationTemplates,
    });
}

export function tryDeleteLine(state: State, lineNumber: number): TriedLexerUpdate {
    const lines: ReadonlyArray<TLine> = state.lines;

    const maybeError: LexError.BadLineNumberError | undefined = maybeBadLineNumberError(state, lineNumber);
    if (maybeError) {
        ResultUtils.errFactory(new LexError.LexError(maybeError));
    }

    return ResultUtils.okFactory({
        ...state,
        lines: [...lines.slice(0, lineNumber), ...lines.slice(lineNumber + 1)],
    });
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
        const leftTokens: ReadonlyArray<Language.LineToken> = left.tokens;
        const rightTokens: ReadonlyArray<Language.LineToken> = right.tokens;

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
export function equalTokens(leftToken: Language.LineToken, rightToken: Language.LineToken): boolean {
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

export function maybeErrorLineMap(state: State): ErrorLineMap | undefined {
    const errorLines: ErrorLineMap = new Map();
    const lines: ReadonlyArray<TLine> = state.lines;
    const numLines: number = lines.length;

    let errorsExist: boolean = false;
    for (let index: number = 0; index < numLines; index += 1) {
        const line: TLine = lines[index];
        if (isErrorLine(line)) {
            errorLines.set(index, line);
            errorsExist = true;
        }
    }

    return errorsExist ? errorLines : undefined;
}

interface TokenizeChanges {
    readonly tokens: ReadonlyArray<Language.LineToken>;
    readonly lineModeEnd: LineMode;
}

interface LineModeAlteringRead {
    readonly token: Language.LineToken;
    readonly lineMode: LineMode;
}

// Attributes can't be readyonly.
// In `updateRange` text is updated by adding existing existing lines as a suffix/prefix.
// In `splitOnLineTerminators` lineTerminator is updated as the last must have no terminator, eg. ""
interface SplitLine {
    text: string;
    lineTerminator: string;
}

// Takes a string and splits it on all valid Power Query terminators.
// The split lines retain what newline was used to create the split.
function splitOnLineTerminators(startingText: string): SplitLine[] {
    let lines: SplitLine[] = startingText.split("\r\n").map((lineText: string) => {
        return {
            text: lineText,
            lineTerminator: "\r\n",
        };
    });
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

                const split: ReadonlyArray<SplitLine> = text.split(lineTerminator).map((lineText: string) => {
                    return {
                        text: lineText,
                        lineTerminator,
                    };
                });
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
    localizationTemplates: ILocalizationTemplates,
    splitLines: ReadonlyArray<SplitLine>,
    previousLineModeEnd: LineMode,
): ReadonlyArray<TLine> {
    const numLines: number = splitLines.length;
    const tokenizedLines: TLine[] = [];

    for (let lineNumber: number = 0; lineNumber < numLines; lineNumber += 1) {
        const splitLine: SplitLine = splitLines[lineNumber];
        const untokenizedLine: UntouchedLine = lineFrom(splitLine.text, splitLine.lineTerminator, previousLineModeEnd);
        const tokenizedLine: TLine = tokenize(localizationTemplates, untokenizedLine, lineNumber);
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
    const localizationTemplates: ILocalizationTemplates = state.localizationTemplates;

    if (lines[lineNumber] === undefined) {
        return [];
    }

    const retokenizedLines: TLine[] = [];
    if (previousLineModeEnd !== lines[lineNumber].lineModeStart) {
        const offsetLineNumber: number = lineNumber;
        let maybeCurrentLine: TLine | undefined = lines[lineNumber];

        while (maybeCurrentLine) {
            const line: TLine = maybeCurrentLine;

            if (previousLineModeEnd !== line.lineModeStart) {
                const untokenizedLine: UntouchedLine = lineFrom(line.text, line.lineTerminator, previousLineModeEnd);
                const retokenizedLine: TLine = tokenize(localizationTemplates, untokenizedLine, offsetLineNumber);
                retokenizedLines.push(retokenizedLine);
                previousLineModeEnd = retokenizedLine.lineModeEnd;
                lineNumber += 1;
                maybeCurrentLine = lines[lineNumber];
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
function tokenize(localizationTemplates: ILocalizationTemplates, line: TLine, lineNumber: number): TLine {
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
                error: new LexError.LexError(new LexError.EndOfStreamError(localizationTemplates)),
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
                error: new LexError.LexError(new LexError.BadStateError(localizationTemplates, line.error)),
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

    const newTokens: Language.LineToken[] = [];
    let continueLexing: boolean = currentPosition !== text.length;
    let maybeError: LexError.TLexError | undefined;

    // While neither eof nor having encountered an error:
    //  * Lex according to lineModeStart, starting from currentPosition.
    //  * Update currentPosition and lineMode.
    //  * Drain whitespace.
    while (continueLexing) {
        try {
            let readOutcome: LineModeAlteringRead;
            switch (lineMode) {
                case LineMode.Comment:
                    readOutcome = tokenizeMultilineCommentContentOrEnd(line, currentPosition);
                    break;

                case LineMode.Default:
                    readOutcome = tokenizeDefault(localizationTemplates, line, lineNumber, currentPosition);
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
            const token: Language.LineToken = readOutcome.token;
            newTokens.push(token);

            if (lineMode === LineMode.Default) {
                currentPosition = drainWhitespace(text, token.positionEnd);
            } else {
                currentPosition = token.positionEnd;
            }

            if (currentPosition === textLength) {
                continueLexing = false;
            }
        } catch (e) {
            let error: LexError.TLexError;
            if (LexError.isTInnerLexError(e)) {
                error = new LexError.LexError(e);
            } else {
                error = CommonError.ensureCommonError(localizationTemplates, e);
            }
            continueLexing = false;
            maybeError = error;
        }
    }

    let partialTokenizeResult: PartialResult<TokenizeChanges, TokenizeChanges, LexError.TLexError>;
    if (maybeError) {
        if (newTokens.length) {
            partialTokenizeResult = PartialResultUtils.mixedFactory(
                {
                    tokens: newTokens,
                    lineModeEnd: lineMode,
                },
                maybeError,
            );
        } else {
            partialTokenizeResult = PartialResultUtils.errFactory(maybeError);
        }
    } else {
        partialTokenizeResult = PartialResultUtils.okFactory({
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
            const newTokens: ReadonlyArray<Language.LineToken> = line.tokens.concat(tokenizeChanges.tokens);

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
            const newTokens: ReadonlyArray<Language.LineToken> = line.tokens.concat(tokenizeChanges.tokens);

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

        case PartialResultKind.Err:
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

// read either "*/" or eof
function tokenizeMultilineCommentContentOrEnd(line: TLine, positionStart: number): LineModeAlteringRead {
    const text: string = line.text;
    const indexOfCloseComment: number = text.indexOf("*/", positionStart);

    if (indexOfCloseComment === -1) {
        return {
            token: readRestOfLine(Language.LineTokenKind.MultilineCommentContent, text, positionStart),
            lineMode: LineMode.Comment,
        };
    } else {
        const positionEnd: number = indexOfCloseComment + 2;
        return {
            token: readTokenFrom(Language.LineTokenKind.MultilineCommentEnd, text, positionStart, positionEnd),
            lineMode: LineMode.Default,
        };
    }
}

// read either string literal end or eof
function tokenizeQuotedIdentifierContentOrEnd(line: TLine, currentPosition: number): LineModeAlteringRead {
    const read: LineModeAlteringRead = tokenizeTextLiteralContentOrEnd(line, currentPosition);
    switch (read.token.kind) {
        case Language.LineTokenKind.TextLiteralContent:
            return {
                lineMode: LineMode.QuotedIdentifier,
                token: {
                    ...read.token,
                    kind: Language.LineTokenKind.QuotedIdentifierContent,
                },
            };

        case Language.LineTokenKind.TextLiteralEnd:
            return {
                lineMode: LineMode.Default,
                token: {
                    ...read.token,
                    kind: Language.LineTokenKind.QuotedIdentifierEnd,
                },
            };

        default:
            const details: {} = { read };
            throw new CommonError.InvariantError(
                `expected the return to be either ${Language.LineTokenKind.TextLiteralContent} or ${Language.LineTokenKind.TextLiteralEnd}`,
                details,
            );
    }
}

// read either string literal end or eof
function tokenizeTextLiteralContentOrEnd(line: TLine, currentPosition: number): LineModeAlteringRead {
    const text: string = line.text;
    const maybePositionEnd: number | undefined = maybeIndexOfTextEnd(text, currentPosition);

    if (maybePositionEnd === undefined) {
        return {
            token: readRestOfLine(Language.LineTokenKind.TextLiteralContent, text, currentPosition),
            lineMode: LineMode.Text,
        };
    } else {
        const positionEnd: number = maybePositionEnd + 1;
        return {
            token: readTokenFrom(Language.LineTokenKind.TextLiteralEnd, text, currentPosition, positionEnd),
            lineMode: LineMode.Default,
        };
    }
}

function tokenizeDefault(
    localizationTemplates: ILocalizationTemplates,
    line: TLine,
    lineNumber: number,
    positionStart: number,
): LineModeAlteringRead {
    const text: string = line.text;

    const chr1: string = text[positionStart];
    let token: Language.LineToken;
    let lineMode: LineMode = LineMode.Default;

    if (chr1 === "!") {
        token = readConstant(Language.LineTokenKind.Bang, text, positionStart, 1);
    } else if (chr1 === "&") {
        token = readConstant(Language.LineTokenKind.Ampersand, text, positionStart, 1);
    } else if (chr1 === "(") {
        token = readConstant(Language.LineTokenKind.LeftParenthesis, text, positionStart, 1);
    } else if (chr1 === ")") {
        token = readConstant(Language.LineTokenKind.RightParenthesis, text, positionStart, 1);
    } else if (chr1 === "*") {
        token = readConstant(Language.LineTokenKind.Asterisk, text, positionStart, 1);
    } else if (chr1 === "+") {
        token = readConstant(Language.LineTokenKind.Plus, text, positionStart, 1);
    } else if (chr1 === ",") {
        token = readConstant(Language.LineTokenKind.Comma, text, positionStart, 1);
    } else if (chr1 === "-") {
        token = readConstant(Language.LineTokenKind.Minus, text, positionStart, 1);
    } else if (chr1 === ";") {
        token = readConstant(Language.LineTokenKind.Semicolon, text, positionStart, 1);
    } else if (chr1 === "?") {
        const chr2: string | undefined = text[positionStart + 1];
        if (chr2 === "?") {
            token = readConstant(Language.LineTokenKind.NullCoalescingOperator, text, positionStart, 2);
        } else {
            token = readConstant(Language.LineTokenKind.QuestionMark, text, positionStart, 1);
        }
    } else if (chr1 === "@") {
        token = readConstant(Language.LineTokenKind.AtSign, text, positionStart, 1);
    } else if (chr1 === "[") {
        token = readConstant(Language.LineTokenKind.LeftBracket, text, positionStart, 1);
    } else if (chr1 === "]") {
        token = readConstant(Language.LineTokenKind.RightBracket, text, positionStart, 1);
    } else if (chr1 === "{") {
        token = readConstant(Language.LineTokenKind.LeftBrace, text, positionStart, 1);
    } else if (chr1 === "}") {
        token = readConstant(Language.LineTokenKind.RightBrace, text, positionStart, 1);
    } else if (chr1 === '"') {
        const read: LineModeAlteringRead = readOrStartTextLiteral(text, positionStart);
        token = read.token;
        lineMode = read.lineMode;
    } else if (chr1 === "0") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "x" || chr2 === "X") {
            token = readHexLiteral(localizationTemplates, text, lineNumber, positionStart);
        } else {
            token = readNumericLiteral(localizationTemplates, text, lineNumber, positionStart);
        }
    } else if ("1" <= chr1 && chr1 <= "9") {
        token = readNumericLiteral(localizationTemplates, text, lineNumber, positionStart);
    } else if (chr1 === ".") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === undefined) {
            throw new LexError.UnexpectedEofError(
                localizationTemplates,
                graphemePositionFrom(text, lineNumber, positionStart),
            );
        } else if ("1" <= chr2 && chr2 <= "9") {
            token = readNumericLiteral(localizationTemplates, text, lineNumber, positionStart);
        } else if (chr2 === ".") {
            const chr3: string = text[positionStart + 2];

            if (chr3 === ".") {
                token = readConstant(Language.LineTokenKind.Ellipsis, text, positionStart, 3);
            } else {
                token = readConstant(Language.LineTokenKind.DotDot, text, positionStart, 2);
            }
        } else {
            throw unexpectedReadError(localizationTemplates, text, lineNumber, positionStart);
        }
    } else if (chr1 === ">") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "=") {
            token = readConstant(Language.LineTokenKind.GreaterThanEqualTo, text, positionStart, 2);
        } else {
            token = readConstant(Language.LineTokenKind.GreaterThan, text, positionStart, 1);
        }
    } else if (chr1 === "<") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "=") {
            token = readConstant(Language.LineTokenKind.LessThanEqualTo, text, positionStart, 2);
        } else if (chr2 === ">") {
            token = readConstant(Language.LineTokenKind.NotEqual, text, positionStart, 2);
        } else {
            token = readConstant(Language.LineTokenKind.LessThan, text, positionStart, 1);
        }
    } else if (chr1 === "=") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === ">") {
            token = readConstant(Language.LineTokenKind.FatArrow, text, positionStart, 2);
        } else {
            token = readConstant(Language.LineTokenKind.Equal, text, positionStart, 1);
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
            token = readConstant(Language.LineTokenKind.Division, text, positionStart, 1);
        }
    } else if (chr1 === "#") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === '"') {
            const read: LineModeAlteringRead = readOrStartQuotedIdentifier(text, positionStart);
            token = read.token;
            lineMode = read.lineMode;
        } else {
            token = readKeyword(localizationTemplates, text, lineNumber, positionStart);
        }
    } else {
        token = readKeywordOrIdentifier(localizationTemplates, text, lineNumber, positionStart);
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
        const maybeLength: number | undefined = StringUtils.maybeRegexMatchLength(Pattern.Whitespace, text, position);
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
            token: readTokenFrom(Language.LineTokenKind.TextLiteral, text, currentPosition, positionEnd),
            lineMode: LineMode.Default,
        };
    } else {
        return {
            token: readRestOfLine(Language.LineTokenKind.TextLiteralStart, text, currentPosition),
            lineMode: LineMode.Text,
        };
    }
}

function readHexLiteral(
    localizationTemplates: ILocalizationTemplates,
    text: string,
    lineNumber: number,
    positionStart: number,
): Language.LineToken {
    const maybePositionEnd: number | undefined = maybeIndexOfRegexEnd(Pattern.Hex, text, positionStart);
    if (maybePositionEnd === undefined) {
        throw new LexError.ExpectedError(
            localizationTemplates,
            graphemePositionFrom(text, lineNumber, positionStart),
            LexError.ExpectedKind.HexLiteral,
        );
    }
    const positionEnd: number = maybePositionEnd;

    return readTokenFrom(Language.LineTokenKind.HexLiteral, text, positionStart, positionEnd);
}

function readNumericLiteral(
    localizationTemplates: ILocalizationTemplates,
    text: string,
    lineNumber: number,
    positionStart: number,
): Language.LineToken {
    const maybePositionEnd: number | undefined = maybeIndexOfRegexEnd(Pattern.Numeric, text, positionStart);
    if (maybePositionEnd === undefined) {
        throw new LexError.ExpectedError(
            localizationTemplates,
            graphemePositionFrom(text, lineNumber, positionStart),
            LexError.ExpectedKind.Numeric,
        );
    }
    const positionEnd: number = maybePositionEnd;

    return readTokenFrom(Language.LineTokenKind.NumericLiteral, text, positionStart, positionEnd);
}

function readLineComment(text: string, positionStart: number): Language.LineToken {
    return readRestOfLine(Language.LineTokenKind.LineComment, text, positionStart);
}

function readOrStartMultilineComment(text: string, positionStart: number): LineModeAlteringRead {
    const indexOfCloseComment: number = text.indexOf("*/", positionStart + 2);
    if (indexOfCloseComment === -1) {
        return {
            token: readRestOfLine(Language.LineTokenKind.MultilineCommentStart, text, positionStart),
            lineMode: LineMode.Comment,
        };
    } else {
        const positionEnd: number = indexOfCloseComment + 2;
        return {
            token: readTokenFrom(Language.LineTokenKind.MultilineComment, text, positionStart, positionEnd),
            lineMode: LineMode.Default,
        };
    }
}

function readKeyword(
    localizationTemplates: ILocalizationTemplates,
    text: string,
    lineNumber: number,
    positionStart: number,
): Language.LineToken {
    const maybeLineToken: Language.LineToken | undefined = maybeReadKeyword(text, positionStart);
    if (maybeLineToken) {
        return maybeLineToken;
    } else {
        throw unexpectedReadError(localizationTemplates, text, lineNumber, positionStart);
    }
}

function maybeReadKeyword(text: string, currentPosition: number): Language.LineToken | undefined {
    const identifierPositionStart: number = text[currentPosition] === "#" ? currentPosition + 1 : currentPosition;

    const maybeIdentifierPositionEnd: number | undefined = maybeIndexOfIdentifierEnd(text, identifierPositionStart);
    if (maybeIdentifierPositionEnd === undefined) {
        return undefined;
    }
    const identifierPositionEnd: number = maybeIdentifierPositionEnd;

    const data: string = text.substring(currentPosition, identifierPositionEnd);
    const maybeKeywordTokenKind: Language.LineTokenKind | undefined = maybeKeywordLineTokenKindFrom(data);
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
            token: readTokenFrom(Language.LineTokenKind.Identifier, text, currentPosition, positionEnd),
            lineMode: LineMode.Default,
        };
    } else {
        return {
            token: readRestOfLine(Language.LineTokenKind.QuotedIdentifierStart, text, currentPosition),
            lineMode: LineMode.QuotedIdentifier,
        };
    }
}

// The case for quoted identifier has already been taken care of.
// The null-literal is also read here.
function readKeywordOrIdentifier(
    localizationTemplates: ILocalizationTemplates,
    text: string,
    lineNumber: number,
    positionStart: number,
): Language.LineToken {
    // keyword
    if (text[positionStart] === "#") {
        return readKeyword(localizationTemplates, text, lineNumber, positionStart);
    }
    // either keyword or identifier
    else {
        const maybePositionEnd: number | undefined = maybeIndexOfIdentifierEnd(text, positionStart);
        if (maybePositionEnd === undefined) {
            throw new LexError.ExpectedError(
                localizationTemplates,
                graphemePositionFrom(text, lineNumber, positionStart),
                LexError.ExpectedKind.KeywordOrIdentifier,
            );
        }
        const positionEnd: number = maybePositionEnd;
        const data: string = text.substring(positionStart, positionEnd);
        const maybeKeywordTokenKind: Language.LineTokenKind | undefined = maybeKeywordLineTokenKindFrom(data);

        let tokenKind: Language.LineTokenKind;
        if (maybeKeywordTokenKind !== undefined) {
            tokenKind = maybeKeywordTokenKind;
        } else if (data === "null") {
            tokenKind = Language.LineTokenKind.NullLiteral;
        } else {
            tokenKind = Language.LineTokenKind.Identifier;
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
    lineTokenKind: Language.LineTokenKind,
    text: string,
    positionStart: number,
    length: number,
): Language.LineToken {
    const positionEnd: number = positionStart + length;
    return readTokenFrom(lineTokenKind, text, positionStart, positionEnd);
}

function readTokenFrom(
    lineTokenKind: Language.LineTokenKind,
    text: string,
    positionStart: number,
    positionEnd: number,
): Language.LineToken {
    return {
        kind: lineTokenKind,
        positionStart,
        positionEnd,
        data: text.substring(positionStart, positionEnd),
    };
}

function readRestOfLine(
    lineTokenKind: Language.LineTokenKind,
    text: string,
    positionStart: number,
): Language.LineToken {
    const positionEnd: number = text.length;
    return readTokenFrom(lineTokenKind, text, positionStart, positionEnd);
}

function maybeIndexOfRegexEnd(pattern: RegExp, text: string, positionStart: number): number | undefined {
    const maybeLength: number | undefined = StringUtils.maybeRegexMatchLength(pattern, text, positionStart);
    return maybeLength !== undefined ? positionStart + maybeLength : undefined;
}

function maybeIndexOfIdentifierEnd(text: string, positionStart: number): number | undefined {
    const maybeLength: number | undefined = StringUtils.maybeIdentifierLength(text, positionStart, true);
    return maybeLength !== undefined ? positionStart + maybeLength : undefined;
}

function maybeKeywordLineTokenKindFrom(data: string): Language.LineTokenKind | undefined {
    switch (data) {
        case Language.KeywordKind.And:
            return Language.LineTokenKind.KeywordAnd;
        case Language.KeywordKind.As:
            return Language.LineTokenKind.KeywordAs;
        case Language.KeywordKind.Each:
            return Language.LineTokenKind.KeywordEach;
        case Language.KeywordKind.Else:
            return Language.LineTokenKind.KeywordElse;
        case Language.KeywordKind.Error:
            return Language.LineTokenKind.KeywordError;
        case Language.KeywordKind.False:
            return Language.LineTokenKind.KeywordFalse;
        case Language.KeywordKind.If:
            return Language.LineTokenKind.KeywordIf;
        case Language.KeywordKind.In:
            return Language.LineTokenKind.KeywordIn;
        case Language.KeywordKind.Is:
            return Language.LineTokenKind.KeywordIs;
        case Language.KeywordKind.Let:
            return Language.LineTokenKind.KeywordLet;
        case Language.KeywordKind.Meta:
            return Language.LineTokenKind.KeywordMeta;
        case Language.KeywordKind.Not:
            return Language.LineTokenKind.KeywordNot;
        case Language.KeywordKind.Or:
            return Language.LineTokenKind.KeywordOr;
        case Language.KeywordKind.Otherwise:
            return Language.LineTokenKind.KeywordOtherwise;
        case Language.KeywordKind.Section:
            return Language.LineTokenKind.KeywordSection;
        case Language.KeywordKind.Shared:
            return Language.LineTokenKind.KeywordShared;
        case Language.KeywordKind.Then:
            return Language.LineTokenKind.KeywordThen;
        case Language.KeywordKind.True:
            return Language.LineTokenKind.KeywordTrue;
        case Language.KeywordKind.Try:
            return Language.LineTokenKind.KeywordTry;
        case Language.KeywordKind.Type:
            return Language.LineTokenKind.KeywordType;
        case Language.KeywordKind.HashBinary:
            return Language.LineTokenKind.KeywordHashBinary;
        case Language.KeywordKind.HashDate:
            return Language.LineTokenKind.KeywordHashDate;
        case Language.KeywordKind.HashDateTime:
            return Language.LineTokenKind.KeywordHashDateTime;
        case Language.KeywordKind.HashDateTimeZone:
            return Language.LineTokenKind.KeywordHashDateTimeZone;
        case Language.KeywordKind.HashDuration:
            return Language.LineTokenKind.KeywordHashDuration;
        case Language.KeywordKind.HashInfinity:
            return Language.LineTokenKind.KeywordHashInfinity;
        case Language.KeywordKind.HashNan:
            return Language.LineTokenKind.KeywordHashNan;
        case Language.KeywordKind.HashSections:
            return Language.LineTokenKind.KeywordHashSections;
        case Language.KeywordKind.HashShared:
            return Language.LineTokenKind.KeywordHashShared;
        case Language.KeywordKind.HashTable:
            return Language.LineTokenKind.KeywordHashTable;
        case Language.KeywordKind.HashTime:
            return Language.LineTokenKind.KeywordHashTime;
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
    localizationTemplates: ILocalizationTemplates,
    text: string,
    lineNumber: number,
    lineCodeUnit: number,
): LexError.UnexpectedReadError {
    return new LexError.UnexpectedReadError(
        localizationTemplates,
        graphemePositionFrom(text, lineNumber, lineCodeUnit),
    );
}

function maybeBadLineNumberError(state: State, lineNumber: number): LexError.BadLineNumberError | undefined {
    const numLines: number = state.lines.length;
    if (lineNumber >= numLines) {
        return new LexError.BadLineNumberError(
            state.localizationTemplates,
            LexError.BadLineNumberKind.GreaterThanNumLines,
            lineNumber,
            numLines,
        );
    } else if (lineNumber < 0) {
        return new LexError.BadLineNumberError(
            state.localizationTemplates,
            LexError.BadLineNumberKind.LessThanZero,
            lineNumber,
            numLines,
        );
    } else {
        return undefined;
    }
}

// Validator for Range.
function maybeBadRangeError(state: State, range: Range): LexError.BadRangeError | undefined {
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

    if (maybeKind) {
        const kind: LexError.BadRangeKind = maybeKind;
        return new LexError.BadRangeError(state.localizationTemplates, range, kind);
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

    if (maybeKind) {
        return new LexError.BadRangeError(state.localizationTemplates, range, maybeKind);
    }

    return undefined;
}
