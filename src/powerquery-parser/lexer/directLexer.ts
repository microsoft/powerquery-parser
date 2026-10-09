// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LexError from "./error";

import { Assert, CommonError, Pattern, Result, ResultUtils, StringUtils } from "../common";
import { Comment, IdentifierUtils, Keyword, Token } from "../language";
import { LexerSnapshot, LineTerminator } from "./lexerSnapshot";
import { LexSettings } from "./lexSettings";

export type TriedLexSnapshot = Result<LexerSnapshot, LexError.TLexError>;

const TripleSlashPrefix: string = "///";
const TypeDirectiveKeyword: string = "@type";

export function tryLexSnapshot(settings: LexSettings, text: string): TriedLexSnapshot {
    try {
        return ResultUtils.ok(new DirectLexer(settings, text).lex());
    } catch (caught: unknown) {
        Assert.isInstanceofError(caught);

        if (LexError.isTInnerLexError(caught)) {
            return ResultUtils.error(new LexError.LexError(caught));
        }

        return ResultUtils.error(CommonError.ensureCommonError(caught, settings.locale));
    }
}

class DirectLexer {
    private readonly tokens: Token.Token[] = [];
    private readonly comments: Comment.TComment[] = [];
    private readonly lineTerminators: LineTerminator[] = [];
    private position: number = 0;
    private lineNumber: number = 0;
    private linePositionStart: number = 0;

    constructor(
        private readonly settings: LexSettings,
        private readonly text: string,
    ) {}

    public lex(): LexerSnapshot {
        while (this.position < this.text.length) {
            this.settings.cancellationToken?.throwIfCancelled();

            const lineTerminator: string | undefined = this.lineTerminatorAt(this.position);

            if (lineTerminator !== undefined) {
                this.consumeLineTerminator(lineTerminator);
                continue;
            }

            const whitespaceLength: number | undefined = StringUtils.regexMatchLength(
                Pattern.Whitespace,
                this.text,
                this.position,
            );

            if (whitespaceLength !== undefined) {
                this.position += whitespaceLength;
                continue;
            }

            this.readNext();
        }

        this.lineTerminators.push({
            codeUnit: this.text.length,
            text: "",
        });

        return new LexerSnapshot(this.text, this.tokens, this.comments, this.lineTerminators);
    }

    private readNext(): void {
        const positionStart: number = this.position;
        const chr1: string = this.text[positionStart];

        switch (chr1) {
            case "!":
                this.pushConstant(Token.TokenKind.Bang, 1);
                return;

            case "&":
                this.pushConstant(Token.TokenKind.Ampersand, 1);
                return;

            case "(":
                this.pushConstant(Token.TokenKind.LeftParenthesis, 1);
                return;

            case ")":
                this.pushConstant(Token.TokenKind.RightParenthesis, 1);
                return;

            case "*":
                this.pushConstant(Token.TokenKind.Asterisk, 1);
                return;

            case "+":
                this.pushConstant(Token.TokenKind.Plus, 1);
                return;

            case ",":
                this.pushConstant(Token.TokenKind.Comma, 1);
                return;

            case "-":
                this.pushConstant(Token.TokenKind.Minus, 1);
                return;

            case ";":
                this.pushConstant(Token.TokenKind.Semicolon, 1);
                return;

            case "@":
                this.pushConstant(Token.TokenKind.AtSign, 1);
                return;

            case "[":
                this.pushConstant(Token.TokenKind.LeftBracket, 1);
                return;

            case "]":
                this.pushConstant(Token.TokenKind.RightBracket, 1);
                return;

            case "{":
                this.pushConstant(Token.TokenKind.LeftBrace, 1);
                return;

            case "}":
                this.pushConstant(Token.TokenKind.RightBrace, 1);
                return;

            case "?":
                this.pushConstant(
                    this.characterWithinLine(1) === "?"
                        ? Token.TokenKind.NullCoalescingOperator
                        : Token.TokenKind.QuestionMark,
                    this.characterWithinLine(1) === "?" ? 2 : 1,
                );
                return;

            case '"':
                this.readTextLiteral();
                return;

            case ".":
                this.readDot();
                return;

            case ">":
                this.pushConstant(
                    this.characterWithinLine(1) === "="
                        ? Token.TokenKind.GreaterThanEqualTo
                        : Token.TokenKind.GreaterThan,
                    this.characterWithinLine(1) === "=" ? 2 : 1,
                );
                return;

            case "<":
                this.readLessThan();
                return;

            case "=":
                this.pushConstant(
                    this.characterWithinLine(1) === ">" ? Token.TokenKind.FatArrow : Token.TokenKind.Equal,
                    this.characterWithinLine(1) === ">" ? 2 : 1,
                );
                return;

            case "/":
                this.readSlash();
                return;

            case "#":
                this.readHash();
                return;

            default:
                if (chr1 === "0" && ["x", "X"].includes(this.characterWithinLine(1) ?? "")) {
                    this.readRegexToken(Pattern.Hex, Token.TokenKind.HexLiteral, LexError.ExpectedKind.HexLiteral);
                } else if ("0" <= chr1 && chr1 <= "9") {
                    this.readRegexToken(Pattern.Numeric, Token.TokenKind.NumericLiteral, LexError.ExpectedKind.Numeric);
                } else {
                    this.readKeywordOrIdentifier();
                }
        }
    }

    private readDot(): void {
        const chr2: string | undefined = this.characterWithinLine(1);

        if (chr2 === undefined) {
            throw new LexError.UnexpectedEofError(this.graphemePosition(), this.settings.locale);
        }

        if ("1" <= chr2 && chr2 <= "9") {
            this.readRegexToken(Pattern.Numeric, Token.TokenKind.NumericLiteral, LexError.ExpectedKind.Numeric);
        } else if (chr2 === ".") {
            this.pushConstant(
                this.characterWithinLine(2) === "." ? Token.TokenKind.Ellipsis : Token.TokenKind.DotDot,
                this.characterWithinLine(2) === "." ? 3 : 2,
            );
        } else {
            throw new LexError.UnexpectedReadError(this.graphemePosition(), this.settings.locale);
        }
    }

    private readLessThan(): void {
        const chr2: string | undefined = this.characterWithinLine(1);

        if (chr2 === "=") {
            this.pushConstant(Token.TokenKind.LessThanEqualTo, 2);
        } else if (chr2 === ">") {
            this.pushConstant(Token.TokenKind.NotEqual, 2);
        } else {
            this.pushConstant(Token.TokenKind.LessThan, 1);
        }
    }

    private readSlash(): void {
        const chr2: string | undefined = this.characterWithinLine(1);

        if (chr2 === "/") {
            this.readLineComment();
        } else if (chr2 === "*") {
            this.readMultilineComment();
        } else {
            this.pushConstant(Token.TokenKind.Division, 1);
        }
    }

    private readHash(): void {
        if (this.characterWithinLine(1) === '"') {
            this.readQuotedIdentifier();
            return;
        }

        const positionEnd: number | undefined = this.identifierPositionEnd(this.position + 1);

        if (positionEnd === undefined) {
            throw new LexError.UnexpectedReadError(this.graphemePosition(), this.settings.locale);
        }

        const data: string = this.text.substring(this.position, positionEnd);
        const tokenKind: Token.TokenKind | undefined = keywordTokenKindFrom(data);

        if (tokenKind === undefined) {
            throw new LexError.UnexpectedReadError(this.graphemePosition(), this.settings.locale);
        }

        this.pushToken(tokenKind, positionEnd);
    }

    private readKeywordOrIdentifier(): void {
        const positionEnd: number | undefined = this.identifierPositionEnd(this.position);

        if (positionEnd === undefined) {
            throw new LexError.ExpectedError(
                this.graphemePosition(),
                LexError.ExpectedKind.KeywordOrIdentifier,
                this.settings.locale,
            );
        }

        const data: string = this.text.substring(this.position, positionEnd);
        const tokenKind: Token.TokenKind =
            keywordTokenKindFrom(data) ?? (data === "null" ? Token.TokenKind.NullLiteral : Token.TokenKind.Identifier);

        this.pushToken(tokenKind, positionEnd);
    }

    private readRegexToken(pattern: RegExp, tokenKind: Token.TokenKind, expectedKind: LexError.ExpectedKind): void {
        const length: number | undefined = StringUtils.regexMatchLength(pattern, this.text, this.position);

        if (length === undefined) {
            throw new LexError.ExpectedError(this.graphemePosition(), expectedKind, this.settings.locale);
        }

        this.pushToken(tokenKind, this.position + length);
    }

    private readTextLiteral(): void {
        const positionEnd: number | undefined = this.indexOfTextEnd(this.position + 1);

        if (positionEnd === undefined) {
            throw new LexError.UnterminatedMultilineTokenError(
                this.settings.locale,
                this.graphemePosition(),
                LexError.UnterminatedMultilineTokenKind.Text,
            );
        }

        this.pushToken(Token.TokenKind.TextLiteral, positionEnd + 1, true);
    }

    private readQuotedIdentifier(): void {
        const positionEnd: number | undefined = this.indexOfTextEnd(this.position + 2);

        if (positionEnd === undefined) {
            throw new LexError.UnterminatedMultilineTokenError(
                this.settings.locale,
                this.graphemePosition(),
                LexError.UnterminatedMultilineTokenKind.QuotedIdentifier,
            );
        }

        this.pushToken(Token.TokenKind.Identifier, positionEnd + 1, true);
    }

    private readLineComment(): void {
        const positionStart: Token.TokenPosition = this.currentTokenPosition();
        const positionEndCodeUnit: number = this.indexOfLineEnd(this.position);
        const data: string = this.text.substring(this.position, positionEndCodeUnit);
        this.position = positionEndCodeUnit;
        const positionEnd: Token.TokenPosition = this.currentTokenPosition();

        const comment: Comment.LineComment = {
            kind: Comment.CommentKind.Line,
            data,
            directive: undefined,
            containsNewline: true,
            positionStart,
            positionEnd,
        };

        if (this.settings.isTypeDirectiveAllowed) {
            (comment as { directive: Comment.TDirective | undefined }).directive = tryParseTypeDirective(data, comment);
        }

        this.comments.push(comment);
    }

    private readMultilineComment(): void {
        const positionStartCodeUnit: number = this.position;
        const positionStart: Token.TokenPosition = this.currentTokenPosition();
        const closePosition: number = this.text.indexOf("*/", this.position + 2);

        if (closePosition === -1) {
            throw new LexError.UnterminatedMultilineTokenError(
                this.settings.locale,
                this.graphemePosition(),
                LexError.UnterminatedMultilineTokenKind.MultilineComment,
            );
        }

        const positionEndCodeUnit: number = closePosition + 2;
        this.advanceTo(positionEndCodeUnit);
        const positionEnd: Token.TokenPosition = this.currentTokenPosition();

        this.comments.push({
            kind: Comment.CommentKind.Multiline,
            data: this.text.substring(positionStartCodeUnit, positionEndCodeUnit),
            containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
            positionStart,
            positionEnd,
        });
    }

    private pushConstant(tokenKind: Token.TokenKind, length: number): void {
        this.pushToken(tokenKind, this.position + length);
    }

    private pushToken(
        tokenKind: Token.TokenKind,
        positionEndCodeUnit: number,
        mayContainNewline: boolean = false,
    ): void {
        const positionStartCodeUnit: number = this.position;
        const positionStart: Token.TokenPosition = this.currentTokenPosition();

        if (mayContainNewline) {
            this.advanceTo(positionEndCodeUnit);
        } else {
            this.position = positionEndCodeUnit;
        }

        this.tokens.push({
            kind: tokenKind,
            data: this.text.substring(positionStartCodeUnit, positionEndCodeUnit),
            positionStart,
            positionEnd: this.currentTokenPosition(),
        });
    }

    private advanceTo(positionEnd: number): void {
        while (this.position < positionEnd) {
            const lineTerminator: string | undefined = this.lineTerminatorAt(this.position);

            if (lineTerminator !== undefined) {
                this.consumeLineTerminator(lineTerminator);
            } else {
                this.position += 1;
            }
        }
    }

    private consumeLineTerminator(lineTerminator: string): void {
        this.lineTerminators.push({
            codeUnit: this.position,
            text: lineTerminator,
        });

        this.position += lineTerminator.length;
        this.lineNumber += 1;
        this.linePositionStart = this.position;
    }

    private characterWithinLine(offset: number): string | undefined {
        const position: number = this.position + offset;

        if (position >= this.text.length || this.lineTerminatorAt(position) !== undefined) {
            return undefined;
        }

        return this.text[position];
    }

    private lineTerminatorAt(position: number): string | undefined {
        if (this.text.startsWith("\r\n", position)) {
            return "\r\n";
        }

        const character: string | undefined = this.text[position];

        return character === "\n" || character === "\u2028" || character === "\u2029" ? character : undefined;
    }

    private indexOfLineEnd(positionStart: number): number {
        let position: number = positionStart;

        while (position < this.text.length && this.lineTerminatorAt(position) === undefined) {
            position += 1;
        }

        return position;
    }

    private indexOfTextEnd(positionStart: number): number | undefined {
        let positionEnd: number = this.text.indexOf('"', positionStart);

        while (positionEnd !== -1) {
            if (this.text[positionEnd + 1] === '"') {
                positionEnd = this.text.indexOf('"', positionEnd + 2);
            } else {
                return positionEnd;
            }
        }

        return undefined;
    }

    private identifierPositionEnd(positionStart: number): number | undefined {
        const length: number | undefined = IdentifierUtils.getIdentifierLength(this.text, positionStart, {
            allowTrailingPeriod: true,
        });

        return length === undefined ? undefined : positionStart + length;
    }

    private currentTokenPosition(): Token.TokenPosition {
        return {
            codeUnit: this.position,
            lineCodeUnit: this.position - this.linePositionStart,
            lineNumber: this.lineNumber,
        };
    }

    private graphemePosition(): StringUtils.GraphemePosition {
        const lineEnd: number = this.indexOfLineEnd(this.position);

        return StringUtils.graphemePositionFrom(
            this.text.substring(this.linePositionStart, lineEnd),
            this.position - this.linePositionStart,
            this.lineNumber,
            undefined,
        );
    }
}

function tryParseTypeDirective(commentData: string, comment: Comment.LineComment): Comment.TypeDirective | undefined {
    let position: number = 0;

    if (!commentData.startsWith(TripleSlashPrefix)) {
        return undefined;
    }

    position = indexAfterWhitespace(commentData, TripleSlashPrefix.length);

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

    return {
        kind: Comment.DirectiveKind.Type,
        value: commentData.slice(payloadStart, payloadEnd),
        comment,
    };
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
