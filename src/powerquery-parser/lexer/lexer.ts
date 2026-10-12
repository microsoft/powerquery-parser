// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ICancellationToken, Pattern, Result, ResultUtils, StringUtils } from "../common";
import { Comment, IdentifierUtils, Keyword, Token } from "../language";
import { LexerSnapshot, LineTerminator } from "./lexerSnapshot";
import { LexError } from ".";
import { LexSettings } from "./lexSettings";

export type TriedLex = Result<LexerSnapshot, LexError.TLexError>;

export interface State {
    readonly text: string;
    readonly locale: string;
    readonly cancellationToken: ICancellationToken | undefined;
    readonly isTypeDirectiveAllowed: boolean;
    readonly tokens: Token.Token[];
    readonly comments: Comment.TComment[];
    readonly lineTerminators: LineTerminator[];
    position: number;
    lineNumber: number;
    linePositionStart: number;
}

// Readers return document offsets; the scanner supplies final source positions.
type ReadToken<Kind extends Token.TokenKind | Comment.CommentKind = Token.TokenKind> = Token.IToken<Kind, number>;

// This export is a Result ensuring wrapper around the un-exported implementation.
export function tryLex(settings: LexSettings, text: string): TriedLex {
    return ensureCommonOrLexerResult(() => lex(settings, text), settings.locale);
}

function ensureCommonOrLexerResult<T>(
    functionToWrap: () => T,
    locale: string,
): Result<T, CommonError.CommonError | LexError.LexError> {
    try {
        return ResultUtils.ok(functionToWrap());
    } catch (caught: unknown) {
        Assert.isInstanceofError(caught);

        let convertedError: CommonError.CommonError | LexError.LexError;

        if (LexError.isTInnerLexError(caught)) {
            convertedError = new LexError.LexError(caught);
        } else {
            convertedError = CommonError.ensureCommonError(caught, locale);
        }

        return ResultUtils.error(convertedError);
    }
}

function lex(settings: LexSettings, text: string): LexerSnapshot {
    const state: State = {
        text,
        // Preserve caller-backed settings when cancellation callbacks change their values.
        get locale(): string {
            return settings.locale;
        },
        get cancellationToken(): ICancellationToken | undefined {
            return settings.cancellationToken;
        },
        get isTypeDirectiveAllowed(): boolean {
            return settings.isTypeDirectiveAllowed;
        },
        tokens: [],
        comments: [],
        lineTerminators: [],
        position: 0,
        lineNumber: 0,
        linePositionStart: 0,
    };

    state.cancellationToken?.throwIfCancelled();

    while (state.position < text.length) {
        state.cancellationToken?.throwIfCancelled();

        const lineTerminator: string | undefined = lineTerminatorAt(text, state.position);

        if (lineTerminator !== undefined) {
            consumeLineTerminator(state, lineTerminator);

            continue;
        }

        const whitespaceLength: number | undefined = StringUtils.regexMatchLength(
            Pattern.Whitespace,
            text,
            state.position,
        );

        if (whitespaceLength !== undefined) {
            state.position += whitespaceLength;

            continue;
        }

        const token: ReadToken<Token.TokenKind | Comment.CommentKind> = tokenize(
            text,
            state.lineNumber,
            state.position,
            state.locale,
        );

        const positionStart: Token.TokenPosition = currentTokenPosition(state);

        if (
            token.kind === Token.TokenKind.TextLiteral ||
            token.kind === Comment.CommentKind.Multiline ||
            (token.kind === Token.TokenKind.Identifier && token.data.startsWith('#"'))
        ) {
            advanceTo(state, token.positionEnd);
        } else {
            state.position = token.positionEnd;
        }

        const positionEnd: Token.TokenPosition = currentTokenPosition(state);

        if (token.kind === Comment.CommentKind.Line) {
            const comment: Comment.LineComment = {
                kind: token.kind,
                data: token.data,
                directive: undefined,
                containsNewline: true,
                positionStart,
                positionEnd,
            };

            if (state.isTypeDirectiveAllowed) {
                (comment as { directive: Comment.TDirective | undefined }).directive = tryParseTypeDirective(
                    token.data,
                    comment,
                );
            }

            state.comments.push(comment);
        } else if (token.kind === Comment.CommentKind.Multiline) {
            state.comments.push({
                kind: token.kind,
                data: token.data,
                containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
                positionStart,
                positionEnd,
            });
        } else {
            state.tokens.push({
                kind: token.kind,
                data: token.data,
                positionStart,
                positionEnd,
            });
        }
    }

    state.lineTerminators.push({ codeUnit: text.length, text: "" });

    return new LexerSnapshot(text, state.tokens, state.comments, state.lineTerminators);
}

function graphemePositionFrom(text: string, lineNumber: number, position: number): StringUtils.GraphemePosition {
    const linePositionStart: number =
        position === 0
            ? 0
            : Math.max(
                  text.lastIndexOf("\n", position - 1),
                  text.lastIndexOf("\u2028", position - 1),
                  text.lastIndexOf("\u2029", position - 1),
              ) + 1;

    const lineText: string = text.substring(linePositionStart, indexOfLineEnd(text, position));
    const lineCodeUnit: number = position - linePositionStart;
    let columnNumber: number = 0;
    let codeUnit: number = 0;

    // An invalid character can fall inside a grapheme (for example, a combining
    // mark after a numeric literal). Report its containing column, not an invariant error.
    for (const grapheme of StringUtils.graphemeSplitter.splitGraphemes(lineText)) {
        codeUnit += grapheme.length;

        if (codeUnit > lineCodeUnit) {
            break;
        }

        columnNumber += 1;
    }

    return { lineNumber, lineCodeUnit, columnNumber, codeUnit: position };
}

function tokenize(
    text: string,
    lineNumber: number,
    positionStart: number,
    locale: string,
): ReadToken<Token.TokenKind | Comment.CommentKind> {
    const chr1: string = StringUtils.assertGet(text, positionStart);
    let token: ReadToken<Token.TokenKind | Comment.CommentKind>;

    if (chr1 === "!") {
        token = readConstant(Token.TokenKind.Bang, text, positionStart, 1);
    } else if (chr1 === "&") {
        token = readConstant(Token.TokenKind.Ampersand, text, positionStart, 1);
    } else if (chr1 === "(") {
        token = readConstant(Token.TokenKind.LeftParenthesis, text, positionStart, 1);
    } else if (chr1 === ")") {
        token = readConstant(Token.TokenKind.RightParenthesis, text, positionStart, 1);
    } else if (chr1 === "*") {
        token = readConstant(Token.TokenKind.Asterisk, text, positionStart, 1);
    } else if (chr1 === "+") {
        token = readConstant(Token.TokenKind.Plus, text, positionStart, 1);
    } else if (chr1 === ",") {
        token = readConstant(Token.TokenKind.Comma, text, positionStart, 1);
    } else if (chr1 === "-") {
        token = readConstant(Token.TokenKind.Minus, text, positionStart, 1);
    } else if (chr1 === ";") {
        token = readConstant(Token.TokenKind.Semicolon, text, positionStart, 1);
    } else if (chr1 === "?") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "?") {
            token = readConstant(Token.TokenKind.NullCoalescingOperator, text, positionStart, 2);
        } else {
            token = readConstant(Token.TokenKind.QuestionMark, text, positionStart, 1);
        }
    } else if (chr1 === "@") {
        token = readConstant(Token.TokenKind.AtSign, text, positionStart, 1);
    } else if (chr1 === "[") {
        token = readConstant(Token.TokenKind.LeftBracket, text, positionStart, 1);
    } else if (chr1 === "]") {
        token = readConstant(Token.TokenKind.RightBracket, text, positionStart, 1);
    } else if (chr1 === "{") {
        token = readConstant(Token.TokenKind.LeftBrace, text, positionStart, 1);
    } else if (chr1 === "}") {
        token = readConstant(Token.TokenKind.RightBrace, text, positionStart, 1);
    } else if (chr1 === '"') {
        token = readTextLiteral(text, positionStart, lineNumber, locale);
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

        if (chr2 === undefined || lineTerminatorAt(text, positionStart + 1) !== undefined) {
            throw new LexError.UnexpectedEofError(graphemePositionFrom(text, lineNumber, positionStart), locale);
        } else if ("1" <= chr2 && chr2 <= "9") {
            token = readNumericLiteral(text, lineNumber, positionStart, locale);
        } else if (chr2 === ".") {
            const chr3: string | undefined = text[positionStart + 2];

            if (chr3 === ".") {
                token = readConstant(Token.TokenKind.Ellipsis, text, positionStart, 3);
            } else {
                token = readConstant(Token.TokenKind.DotDot, text, positionStart, 2);
            }
        } else {
            throw unexpectedReadError(locale, text, lineNumber, positionStart);
        }
    } else if (chr1 === ">") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "=") {
            token = readConstant(Token.TokenKind.GreaterThanEqualTo, text, positionStart, 2);
        } else {
            token = readConstant(Token.TokenKind.GreaterThan, text, positionStart, 1);
        }
    } else if (chr1 === "<") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "=") {
            token = readConstant(Token.TokenKind.LessThanEqualTo, text, positionStart, 2);
        } else if (chr2 === ">") {
            token = readConstant(Token.TokenKind.NotEqual, text, positionStart, 2);
        } else {
            token = readConstant(Token.TokenKind.LessThan, text, positionStart, 1);
        }
    } else if (chr1 === "=") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === ">") {
            token = readConstant(Token.TokenKind.FatArrow, text, positionStart, 2);
        } else {
            token = readConstant(Token.TokenKind.Equal, text, positionStart, 1);
        }
    } else if (chr1 === "/") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === "/") {
            token = readLineComment(text, positionStart);
        } else if (chr2 === "*") {
            token = readMultilineComment(text, positionStart, lineNumber, locale);
        } else {
            token = readConstant(Token.TokenKind.Division, text, positionStart, 1);
        }
    } else if (chr1 === "#") {
        const chr2: string | undefined = text[positionStart + 1];

        if (chr2 === '"') {
            token = readQuotedIdentifier(text, positionStart, lineNumber, locale);
        } else {
            token = readKeyword(text, lineNumber, positionStart, locale);
        }
    } else {
        token = readKeywordOrIdentifier(text, lineNumber, positionStart, locale);
    }

    return token;
}

function readTextLiteral(text: string, currentPosition: number, lineNumber: number, locale: string): ReadToken {
    const positionEnd: number | undefined = indexOfTextEnd(text, currentPosition + 1);

    if (positionEnd !== undefined) {
        return readTokenFrom(Token.TokenKind.TextLiteral, text, currentPosition, positionEnd + 1);
    } else {
        throw new LexError.UnterminatedMultilineTokenError(
            locale,
            graphemePositionFrom(text, lineNumber, currentPosition),
            LexError.UnterminatedMultilineTokenKind.Text,
        );
    }
}

function readHexLiteral(text: string, lineNumber: number, positionStart: number, locale: string): ReadToken {
    const positionEnd: number | undefined = indexOfRegexEnd(Pattern.Hex, text, positionStart);

    if (positionEnd === undefined) {
        throw new LexError.ExpectedError(
            graphemePositionFrom(text, lineNumber, positionStart),
            LexError.ExpectedKind.HexLiteral,
            locale,
        );
    }

    return readTokenFrom(Token.TokenKind.HexLiteral, text, positionStart, positionEnd);
}

function readNumericLiteral(text: string, lineNumber: number, positionStart: number, locale: string): ReadToken {
    const positionEnd: number | undefined = indexOfRegexEnd(Pattern.Numeric, text, positionStart);

    if (positionEnd === undefined) {
        throw new LexError.ExpectedError(
            graphemePositionFrom(text, lineNumber, positionStart),
            LexError.ExpectedKind.Numeric,
            locale,
        );
    }

    return readTokenFrom(Token.TokenKind.NumericLiteral, text, positionStart, positionEnd);
}

function readLineComment(text: string, positionStart: number): ReadToken<Comment.CommentKind.Line> {
    return readTokenFrom(Comment.CommentKind.Line, text, positionStart, indexOfLineEnd(text, positionStart));
}

function readMultilineComment(
    text: string,
    positionStart: number,
    lineNumber: number,
    locale: string,
): ReadToken<Comment.CommentKind.Multiline> {
    const indexOfCloseComment: number = text.indexOf("*/", positionStart + 2);

    if (indexOfCloseComment === -1) {
        throw new LexError.UnterminatedMultilineTokenError(
            locale,
            graphemePositionFrom(text, lineNumber, positionStart),
            LexError.UnterminatedMultilineTokenKind.MultilineComment,
        );
    } else {
        const positionEnd: number = indexOfCloseComment + 2;

        return readTokenFrom(Comment.CommentKind.Multiline, text, positionStart, positionEnd);
    }
}

function readKeyword(text: string, lineNumber: number, positionStart: number, locale: string): ReadToken {
    const token: ReadToken | undefined = readKeywordHelper(text, positionStart);

    if (token) {
        return token;
    } else {
        throw unexpectedReadError(locale, text, lineNumber, positionStart);
    }
}

function readKeywordHelper(text: string, currentPosition: number): ReadToken | undefined {
    const identifierPositionStart: number = text[currentPosition] === "#" ? currentPosition + 1 : currentPosition;
    const identifierPositionEnd: number | undefined = indexOfIdentifierEnd(text, identifierPositionStart);

    if (identifierPositionEnd === undefined) {
        return undefined;
    }

    const data: string = text.substring(currentPosition, identifierPositionEnd);
    const keywordTokenKind: Token.TokenKind | undefined = keywordTokenKindFrom(data);

    if (keywordTokenKind === undefined) {
        return undefined;
    } else {
        return {
            kind: keywordTokenKind,
            positionStart: currentPosition,
            positionEnd: identifierPositionEnd,
            data,
        };
    }
}

function readQuotedIdentifier(text: string, currentPosition: number, lineNumber: number, locale: string): ReadToken {
    const positionEnd: number | undefined = indexOfTextEnd(text, currentPosition + 2);

    if (positionEnd !== undefined) {
        return readTokenFrom(Token.TokenKind.Identifier, text, currentPosition, positionEnd + 1);
    } else {
        throw new LexError.UnterminatedMultilineTokenError(
            locale,
            graphemePositionFrom(text, lineNumber, currentPosition),
            LexError.UnterminatedMultilineTokenKind.QuotedIdentifier,
        );
    }
}

// The case for quoted identifier has already been taken care of.
// The null-literal is also read here.
function readKeywordOrIdentifier(text: string, lineNumber: number, positionStart: number, locale: string): ReadToken {
    // keyword
    if (text[positionStart] === "#") {
        return readKeyword(text, lineNumber, positionStart, locale);
    }
    // either keyword or identifier
    else {
        const positionEnd: number | undefined = indexOfIdentifierEnd(text, positionStart);

        if (positionEnd === undefined) {
            throw new LexError.ExpectedError(
                graphemePositionFrom(text, lineNumber, positionStart),
                LexError.ExpectedKind.KeywordOrIdentifier,
                locale,
            );
        }

        const data: string = text.substring(positionStart, positionEnd);
        const keywordTokenKind: Token.TokenKind | undefined = keywordTokenKindFrom(data);

        let tokenKind: Token.TokenKind;

        if (keywordTokenKind !== undefined) {
            tokenKind = keywordTokenKind;
        } else if (data === "null") {
            tokenKind = Token.TokenKind.NullLiteral;
        } else {
            tokenKind = Token.TokenKind.Identifier;
        }

        return {
            kind: tokenKind,
            positionStart,
            positionEnd,
            data,
        };
    }
}

function readConstant(tokenKind: Token.TokenKind, text: string, positionStart: number, length: number): ReadToken {
    const positionEnd: number = positionStart + length;

    return readTokenFrom(tokenKind, text, positionStart, positionEnd);
}

function readTokenFrom<Kind extends Token.TokenKind | Comment.CommentKind>(
    tokenKind: Kind,
    text: string,
    positionStart: number,
    positionEnd: number,
): ReadToken<Kind> {
    return {
        kind: tokenKind,
        positionStart,
        positionEnd,
        data: text.substring(positionStart, positionEnd),
    };
}

function indexOfRegexEnd(pattern: RegExp, text: string, positionStart: number): number | undefined {
    const length: number | undefined = StringUtils.regexMatchLength(pattern, text, positionStart);

    return length !== undefined ? positionStart + length : undefined;
}

function indexOfIdentifierEnd(text: string, positionStart: number): number | undefined {
    const length: number | undefined = IdentifierUtils.getIdentifierLength(text, positionStart, {
        allowTrailingPeriod: true,
    });

    return length !== undefined ? positionStart + length : undefined;
}

function keywordTokenKindFrom(data: string): Token.TokenKind | undefined {
    switch (data) {
        case Keyword.KeywordKind.And:
            return Token.TokenKind.KeywordAnd;

        case Keyword.KeywordKind.As:
            return Token.TokenKind.KeywordAs;

        case Keyword.KeywordKind.Each:
            return Token.TokenKind.KeywordEach;

        case Keyword.KeywordKind.Else:
            return Token.TokenKind.KeywordElse;

        case Keyword.KeywordKind.Error:
            return Token.TokenKind.KeywordError;

        case Keyword.KeywordKind.False:
            return Token.TokenKind.KeywordFalse;

        case Keyword.KeywordKind.If:
            return Token.TokenKind.KeywordIf;

        case Keyword.KeywordKind.In:
            return Token.TokenKind.KeywordIn;

        case Keyword.KeywordKind.Is:
            return Token.TokenKind.KeywordIs;

        case Keyword.KeywordKind.Let:
            return Token.TokenKind.KeywordLet;

        case Keyword.KeywordKind.Meta:
            return Token.TokenKind.KeywordMeta;

        case Keyword.KeywordKind.Not:
            return Token.TokenKind.KeywordNot;

        case Keyword.KeywordKind.Or:
            return Token.TokenKind.KeywordOr;

        case Keyword.KeywordKind.Otherwise:
            return Token.TokenKind.KeywordOtherwise;

        case Keyword.KeywordKind.Section:
            return Token.TokenKind.KeywordSection;

        case Keyword.KeywordKind.Shared:
            return Token.TokenKind.KeywordShared;

        case Keyword.KeywordKind.Then:
            return Token.TokenKind.KeywordThen;

        case Keyword.KeywordKind.True:
            return Token.TokenKind.KeywordTrue;

        case Keyword.KeywordKind.Try:
            return Token.TokenKind.KeywordTry;

        case Keyword.KeywordKind.Type:
            return Token.TokenKind.KeywordType;

        case Keyword.KeywordKind.HashBinary:
            return Token.TokenKind.KeywordHashBinary;

        case Keyword.KeywordKind.HashDate:
            return Token.TokenKind.KeywordHashDate;

        case Keyword.KeywordKind.HashDateTime:
            return Token.TokenKind.KeywordHashDateTime;

        case Keyword.KeywordKind.HashDateTimeZone:
            return Token.TokenKind.KeywordHashDateTimeZone;

        case Keyword.KeywordKind.HashDuration:
            return Token.TokenKind.KeywordHashDuration;

        case Keyword.KeywordKind.HashInfinity:
            return Token.TokenKind.KeywordHashInfinity;

        case Keyword.KeywordKind.HashNan:
            return Token.TokenKind.KeywordHashNan;

        case Keyword.KeywordKind.HashSections:
            return Token.TokenKind.KeywordHashSections;

        case Keyword.KeywordKind.HashShared:
            return Token.TokenKind.KeywordHashShared;

        case Keyword.KeywordKind.HashTable:
            return Token.TokenKind.KeywordHashTable;

        case Keyword.KeywordKind.HashTime:
            return Token.TokenKind.KeywordHashTime;

        default:
            return undefined;
    }
}

function indexOfTextEnd(text: string, positionStart: number): number | undefined {
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
    position: number,
): LexError.UnexpectedReadError {
    return new LexError.UnexpectedReadError(graphemePositionFrom(text, lineNumber, position), locale);
}

function advanceTo(state: State, positionEnd: number): void {
    while (state.position < positionEnd) {
        const lineTerminator: string | undefined = lineTerminatorAt(state.text, state.position);

        if (lineTerminator !== undefined) {
            consumeLineTerminator(state, lineTerminator);
        } else {
            state.position += 1;
        }
    }
}

function consumeLineTerminator(state: State, lineTerminator: string): void {
    state.cancellationToken?.throwIfCancelled();

    state.lineTerminators.push({
        codeUnit: state.position,
        text: lineTerminator,
    });

    state.position += lineTerminator.length;
    state.lineNumber += 1;
    state.linePositionStart = state.position;
}

function lineTerminatorAt(text: string, position: number): string | undefined {
    if (text.startsWith("\r\n", position)) {
        return "\r\n";
    }

    const character: string | undefined = text[position];

    return character === "\n" || character === "\u2028" || character === "\u2029" ? character : undefined;
}

function indexOfLineEnd(text: string, positionStart: number): number {
    let position: number = positionStart;

    while (position < text.length && lineTerminatorAt(text, position) === undefined) {
        position += 1;
    }

    return position;
}

function currentTokenPosition(state: State): Token.TokenPosition {
    return {
        codeUnit: state.position,
        lineCodeUnit: state.position - state.linePositionStart,
        lineNumber: state.lineNumber,
    };
}

function tryParseTypeDirective(commentData: string, comment: Comment.LineComment): Comment.TypeDirective | undefined {
    const prefix: string = "///";
    const keyword: string = "@type";

    if (!commentData.startsWith(prefix)) {
        return undefined;
    }

    let position: number = indexAfterWhitespace(commentData, prefix.length);

    if (!commentData.startsWith(keyword, position)) {
        return undefined;
    }

    position += keyword.length;
    const payloadStart: number = indexAfterWhitespace(commentData, position);

    if (payloadStart === position || payloadStart >= commentData.length) {
        return undefined;
    }

    let payloadEnd: number = commentData.length;

    while (payloadEnd > payloadStart && isDirectiveWhitespace(commentData.charCodeAt(payloadEnd - 1))) {
        payloadEnd -= 1;
    }

    if (payloadStart >= payloadEnd) {
        return undefined;
    }

    return { kind: Comment.DirectiveKind.Type, value: commentData.slice(payloadStart, payloadEnd), comment };
}

function indexAfterWhitespace(text: string, start: number): number {
    let position: number = start;

    while (position < text.length && isDirectiveWhitespace(text.charCodeAt(position))) {
        position += 1;
    }

    return position;
}

function isDirectiveWhitespace(charCode: number): boolean {
    return charCode === 32 || charCode === 9;
}
