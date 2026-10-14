// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as Pattern from "../common/patterns";
import { Assert, CommonError, Result, ResultUtils, StringUtils, TypeScriptUtils } from "../common";
import { Comment, IdentifierUtils, Keyword, Token } from "../language";
import { LexerSnapshot, LineTerminator } from "./lexerSnapshot";
import { LexError } from ".";
import { LexSettings } from "./lexSettings";

export type TriedLex = Result<LexerSnapshot, LexError.TLexError>;

export function tryLex(settings: LexSettings, text: string): TriedLex {
    const locale: string = settings.locale;

    try {
        return ResultUtils.ok(lex(settings, text));
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

type ReadToken<Kind extends Token.TokenKind | Comment.CommentKind = Token.TokenKind> = Pick<
    Token.IToken<Kind, number>,
    "kind" | "positionEnd" | "data"
>;

const TripleSlashPrefix: string = "///";
const TypeDirectiveKeyword: string = "@type";
// A failed whitespace match must not search the rest of the document at every token.
const WhitespacePattern: RegExp = new RegExp(Pattern.Whitespace.source, "y");

function lex(settings: LexSettings, text: string): LexerSnapshot {
    const tokens: Token.Token[] = [];
    const comments: Comment.TComment[] = [];
    const lineTerminators: LineTerminator[] = [];
    let position: number = 0;
    let lineNumber: number = 0;
    let lineStart: number = 0;

    settings.cancellationToken?.throwIfCancelled();

    while (position < text.length) {
        settings.cancellationToken?.throwIfCancelled();
        position = drainWhitespace(text, position);

        if (position === text.length) {
            break;
        }

        const newlineLength: number = lineTerminatorLength(text, position);

        if (newlineLength !== 0) {
            lineTerminators.push({ codeUnit: position, text: text.substring(position, position + newlineLength) });
            position += newlineLength;
            lineNumber += 1;
            lineStart = position;

            continue;
        }

        const token: ReadToken<Token.TokenKind | Comment.CommentKind> = tokenize(
            text,
            lineNumber,
            position,
            settings.locale,
        );

        const positionStart: Token.TokenPosition = {
            codeUnit: position,
            lineCodeUnit: position - lineStart,
            lineNumber,
        };

        // Record source positions without splitting multiline tokens into line fragments.
        while (position < token.positionEnd) {
            const length: number = lineTerminatorLength(text, position);

            if (length === 0) {
                position += 1;
            } else {
                settings.cancellationToken?.throwIfCancelled();
                lineTerminators.push({ codeUnit: position, text: text.substring(position, position + length) });
                position += length;
                lineNumber += 1;
                lineStart = position;
            }
        }

        const positionEnd: Token.TokenPosition = {
            codeUnit: position,
            lineCodeUnit: position - lineStart,
            lineNumber,
        };

        if (token.kind === Comment.CommentKind.Line) {
            comments.push(createLineComment(token.data, positionStart, positionEnd, settings.isTypeDirectiveAllowed));
        } else if (token.kind === Comment.CommentKind.Multiline) {
            comments.push({
                kind: token.kind,
                data: token.data,
                containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
                positionStart,
                positionEnd,
            });
        } else {
            tokens.push({ kind: token.kind, data: token.data, positionStart, positionEnd });
        }
    }

    lineTerminators.push({ codeUnit: text.length, text: "" });

    return new LexerSnapshot(text, tokens, comments, lineTerminators);
}

function graphemePositionFrom(text: string, lineNumber: number, position: number): StringUtils.GraphemePosition {
    const lineStart: number =
        position === 0
            ? 0
            : Math.max(
                  text.lastIndexOf("\n", position - 1),
                  text.lastIndexOf("\u2028", position - 1),
                  text.lastIndexOf("\u2029", position - 1),
              ) + 1;

    const lineText: string = text.substring(lineStart, indexOfLineEnd(text, position));
    const lineCodeUnit: number = position - lineStart;
    let columnNumber: number = 0;
    let codeUnit: number = 0;

    // Invalid code units may lie inside a grapheme, such as a combining mark after a number.
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
        token = readQuotedToken(text, lineNumber, positionStart, locale);
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

        if (chr2 === undefined || lineTerminatorLength(text, positionStart + 1) !== 0) {
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
            token = readQuotedToken(text, lineNumber, positionStart, locale);
        } else {
            token = readKeyword(text, lineNumber, positionStart, locale);
        }
    } else {
        token = readKeywordOrIdentifier(text, lineNumber, positionStart, locale);
    }

    return token;
}

// newlines are not considered whitespace
function drainWhitespace(text: string, position: number): number {
    while (position < text.length) {
        const length: number | undefined = StringUtils.regexMatchLength(WhitespacePattern, text, position);

        if (length) {
            position += length;
        } else {
            return position;
        }
    }

    return position;
}

function readQuotedToken(text: string, lineNumber: number, positionStart: number, locale: string): ReadToken {
    const isQuotedIdentifier: boolean = text[positionStart] === "#";
    const positionEnd: number | undefined = indexOfTextEnd(text, positionStart + (isQuotedIdentifier ? 2 : 1));

    if (positionEnd !== undefined) {
        return readTokenFrom(
            isQuotedIdentifier ? Token.TokenKind.Identifier : Token.TokenKind.TextLiteral,
            text,
            positionStart,
            positionEnd + 1,
        );
    } else {
        throw new LexError.UnterminatedMultilineTokenError(
            locale,
            graphemePositionFrom(text, lineNumber, positionStart),
            isQuotedIdentifier
                ? LexError.UnterminatedMultilineTokenKind.QuotedIdentifier
                : LexError.UnterminatedMultilineTokenKind.Text,
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
    const identifierPositionEnd: number | undefined = indexOfIdentifierEnd(text, positionStart + 1);

    if (identifierPositionEnd === undefined) {
        throw unexpectedReadError(locale, text, lineNumber, positionStart);
    }

    const data: string = text.substring(positionStart, identifierPositionEnd);
    const keywordTokenKind: Token.TokenKind | undefined = keywordTokenKindFrom(data);

    if (keywordTokenKind === undefined) {
        throw unexpectedReadError(locale, text, lineNumber, positionStart);
    } else {
        return {
            kind: keywordTokenKind,
            positionEnd: identifierPositionEnd,
            data,
        };
    }
}

// The case for quoted identifier has already been taken care of.
// The null-literal is also read here.
function readKeywordOrIdentifier(text: string, lineNumber: number, positionStart: number, locale: string): ReadToken {
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
        positionEnd,
        data,
    };
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
        positionEnd,
        data: text.substring(positionStart, positionEnd),
    };
}

function indexOfRegexEnd(pattern: RegExp, text: string, positionStart: number): number | undefined {
    const length: number | undefined = StringUtils.regexMatchLength(pattern, text, positionStart);

    return length !== undefined ? positionStart + length : undefined;
}

function lineTerminatorLength(text: string, position: number): number {
    const character: string | undefined = text[position];

    if (character === "\r" && text[position + 1] === "\n") {
        return 2;
    } else if (character === "\n" || character === "\u2028" || character === "\u2029") {
        return 1;
    } else {
        return 0;
    }
}

function indexOfLineEnd(text: string, position: number): number {
    while (position < text.length && lineTerminatorLength(text, position) === 0) {
        position += 1;
    }

    return position;
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
    let positionEnd: number = text.indexOf('"', positionStart);

    while (positionEnd !== -1) {
        if (text[positionEnd + 1] === '"') {
            positionEnd = text.indexOf('"', positionEnd + 2);
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

function createLineComment(
    data: string,
    positionStart: Token.TokenPosition,
    positionEnd: Token.TokenPosition,
    isTypeDirectiveAllowed: boolean,
): Comment.LineComment {
    const lineComment: TypeScriptUtils.StripReadonly<Comment.LineComment> = {
        kind: Comment.CommentKind.Line,
        data,
        directive: undefined,
        containsNewline: true,
        positionStart,
        positionEnd,
    };

    if (isTypeDirectiveAllowed) {
        const value: string | undefined = tryParseTypeDirectiveValue(data);

        if (value !== undefined) {
            lineComment.directive = {
                kind: Comment.DirectiveKind.Type,
                value,
                comment: lineComment,
            };
        }
    }

    return lineComment;
}

function tryParseTypeDirectiveValue(commentData: string): string | undefined {
    let position: number = 0;

    if (!commentData.startsWith(TripleSlashPrefix)) {
        return undefined;
    }

    position += TripleSlashPrefix.length;
    position = indexAfterWhitespace(commentData, position);

    if (!commentData.startsWith(TypeDirectiveKeyword, position)) {
        return undefined;
    }

    position += TypeDirectiveKeyword.length;

    const payloadStart: number = indexAfterWhitespace(commentData, position);

    if (payloadStart === position || payloadStart >= commentData.length) {
        return undefined;
    }

    const payloadEnd: number = indexBeforeTrailingWhitespace(commentData);

    if (payloadStart >= payloadEnd) {
        return undefined;
    }

    return commentData.slice(payloadStart, payloadEnd);
}

function indexAfterWhitespace(text: string, start: number): number {
    let position: number = start;

    while (position < text.length && isWhitespace(text.charCodeAt(position))) {
        position += 1;
    }

    return position;
}

function indexBeforeTrailingWhitespace(text: string): number {
    let position: number = text.length;

    while (position > 0 && isWhitespace(text.charCodeAt(position - 1))) {
        position -= 1;
    }

    return position;
}

function isWhitespace(charCode: number): boolean {
    return charCode === 32 || charCode === 9;
}
