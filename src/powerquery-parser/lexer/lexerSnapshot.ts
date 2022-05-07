// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ICancellationToken, Result, ResultUtils, StringUtils } from "../common";
import { Comment, Token } from "../language";
import { Lexer } from "..";
import { LexError } from ".";

// The lexer is a multiline aware lexer.
// That in part means multiline tokens are split up into <begin>, <content>, and <end> components.
// The LexerSnapshot takes those multiline tokens and condenses them into a <begin, content, end> token,
// along with throwing any multiline errors (eg. a <begin> but not <end>).
//
// One area for future optimization is to remove this all together by improving the naive parser logic.
// It would mostly be a memory + code size improvement. The CPU cost is currently relatively minimal.

export type TriedLexerSnapshot = Result<LexerSnapshot, LexError.TLexError>;

export class LexerSnapshot {
    constructor(
        public readonly text: string,
        public readonly tokens: ReadonlyArray<Token.Token>,
        public readonly comments: ReadonlyArray<Comment.TComment>,
        public readonly lineTerminators: ReadonlyArray<LineTerminator>,
    ) {}

    public static graphemePositionStartFrom(
        text: string,
        lineTerminators: ReadonlyArray<LineTerminator>,
        flatLineToken: Token.Token | FlatLineToken,
    ): StringUtils.GraphemePosition {
        const positionStart: Token.TokenPosition = flatLineToken.positionStart;
        const positionEnd: Token.TokenPosition = flatLineToken.positionEnd;

        let substringPositionStart: number = 0;
        let substringPositionEnd: number = text.length;

        for (const lineTerminator of lineTerminators) {
            if (lineTerminator.codeUnit < positionStart.codeUnit) {
                substringPositionStart = lineTerminator.codeUnit + lineTerminator.text.length;
            }

            if (lineTerminator.codeUnit >= positionEnd.codeUnit) {
                substringPositionEnd = lineTerminator.codeUnit + lineTerminator.text.length;
                break;
            }
        }

        return StringUtils.graphemePositionFrom(
            text.substring(substringPositionStart, substringPositionEnd),
            positionStart.lineCodeUnit,
            positionStart.lineNumber,
            positionEnd.codeUnit,
        );
    }

    public graphemePositionStartFrom(token: Token.Token): StringUtils.GraphemePosition {
        return LexerSnapshot.graphemePositionStartFrom(this.text, this.lineTerminators, token);
    }

    public columnNumberStartFrom(token: Token.Token): number {
        return this.graphemePositionStartFrom(token).columnNumber;
    }
}

export function trySnapshot(state: Lexer.State): TriedLexerSnapshot {
    try {
        return ResultUtils.boxOk(createSnapshot(state));
    } catch (e) {
        let error: LexError.TLexError;

        if (LexError.isTInnerLexError(e)) {
            error = new LexError.LexError(e);
        } else {
            Assert.isInstanceofError(e);
            error = CommonError.ensureCommonError(e, state.locale);
        }

        return ResultUtils.boxError(error);
    }
}

function createSnapshot(state: Lexer.State): LexerSnapshot {
    // class properties
    const tokens: Token.Token[] = [];
    const comments: Comment.TComment[] = [];
    const flattenedLines: FlattenedLines = flattenLineTokens(state);
    const flatTokens: ReadonlyArray<FlatLineToken> = flattenedLines.flatLineTokens;
    const numFlatTokens: number = flatTokens.length;
    const text: string = flattenedLines.text;
    const maybeCancellationToken: ICancellationToken | undefined = state.maybeCancellationToken;

    let flatIndex: number = 0;

    while (flatIndex < numFlatTokens) {
        state.maybeCancellationToken?.throwIfCancelled();

        const flatToken: FlatLineToken = flatTokens[flatIndex];

        switch (flatToken.kind) {
            case Token.LineTokenKind.LineComment:
                comments.push(readLineComment(flatToken));
                break;

            case Token.LineTokenKind.MultilineComment:
                comments.push(readSingleLineMultilineComment(flatToken));
                break;

            case Token.LineTokenKind.MultilineCommentStart: {
                const concatenatedTokenRead: ConcatenatedCommentRead = readMultilineComment(
                    flattenedLines,
                    flatToken,
                    state.locale,
                    maybeCancellationToken,
                );

                comments.push(concatenatedTokenRead.comment);
                flatIndex = concatenatedTokenRead.flatIndexEnd;
                break;
            }

            case Token.LineTokenKind.QuotedIdentifierStart: {
                const concatenatedTokenRead: ConcatenatedTokenRead = readQuotedIdentifier(
                    flattenedLines,
                    flatToken,
                    state.locale,
                    maybeCancellationToken,
                );

                tokens.push(concatenatedTokenRead.token);
                flatIndex = concatenatedTokenRead.flatIndexEnd;
                break;
            }

            case Token.LineTokenKind.TextLiteralStart: {
                const concatenatedTokenRead: ConcatenatedTokenRead = readTextLiteral(
                    flattenedLines,
                    flatToken,
                    state.locale,
                    maybeCancellationToken,
                );

                tokens.push(concatenatedTokenRead.token);
                flatIndex = concatenatedTokenRead.flatIndexEnd;
                break;
            }

            default: {
                const positionStart: Token.TokenPosition = flatToken.positionStart;
                const positionEnd: Token.TokenPosition = flatToken.positionEnd;

                tokens.push({
                    kind: flatToken.kind as unknown as Token.TokenKind,
                    data: flatToken.data,
                    positionStart,
                    positionEnd,
                });
            }
        }

        flatIndex += 1;
    }

    return new LexerSnapshot(text, tokens, comments, flattenedLines.lineTerminators);
}

function readLineComment(flatToken: FlatLineToken): Comment.LineComment {
    const positionStart: Token.TokenPosition = flatToken.positionStart;
    const positionEnd: Token.TokenPosition = flatToken.positionEnd;

    return {
        kind: Comment.CommentKind.Line,
        data: flatToken.data,
        containsNewline: true,
        positionStart,
        positionEnd,
    };
}

// a multiline comment that spans a single line
function readSingleLineMultilineComment(flatToken: FlatLineToken): Comment.MultilineComment {
    const positionStart: Token.TokenPosition = flatToken.positionStart;
    const positionEnd: Token.TokenPosition = flatToken.positionEnd;

    return {
        kind: Comment.CommentKind.Multiline,
        data: flatToken.data,
        containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
        positionStart,
        positionEnd,
    };
}

function readMultilineComment(
    flattenedLines: FlattenedLines,
    tokenStart: FlatLineToken,
    locale: string,
    maybeCancellationToken: ICancellationToken | undefined,
): ConcatenatedCommentRead {
    const collection: FlatLineCollection = collectWhileContent(
        flattenedLines.flatLineTokens,
        tokenStart,
        Token.LineTokenKind.MultilineCommentContent,
        maybeCancellationToken,
    );

    const maybeTokenEnd: FlatLineToken | undefined = collection.maybeTokenEnd;

    if (!maybeTokenEnd) {
        throw new LexError.UnterminatedMultilineTokenError(
            locale,
            LexerSnapshot.graphemePositionStartFrom(flattenedLines.text, flattenedLines.lineTerminators, tokenStart),
            LexError.UnterminatedMultilineTokenKind.MultilineComment,
        );
    } else if (maybeTokenEnd.kind !== Token.LineTokenKind.MultilineCommentEnd) {
        const details: { foundTokenEnd: FlatLineToken | undefined } = { foundTokenEnd: maybeTokenEnd };
        const message: string = `once a multiline token starts it should either reach a paired end token, or eof`;
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: Token.TokenPosition = tokenStart.positionStart;
        const positionEnd: Token.TokenPosition = tokenEnd.positionEnd;

        return {
            comment: {
                kind: Comment.CommentKind.Multiline,
                data: flattenedLines.text.substring(positionStart.codeUnit, positionEnd.codeUnit),
                containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
                positionStart,
                positionEnd,
            },
            flatIndexEnd: tokenEnd.flatIndex,
        };
    }
}

function readQuotedIdentifier(
    flattenedLines: FlattenedLines,
    tokenStart: FlatLineToken,
    locale: string,
    maybeCancellationToken: ICancellationToken | undefined,
): ConcatenatedTokenRead {
    const collection: FlatLineCollection = collectWhileContent(
        flattenedLines.flatLineTokens,
        tokenStart,
        Token.LineTokenKind.QuotedIdentifierContent,
        maybeCancellationToken,
    );

    const maybeTokenEnd: FlatLineToken | undefined = collection.maybeTokenEnd;

    if (!maybeTokenEnd) {
        throw new LexError.UnterminatedMultilineTokenError(
            locale,
            LexerSnapshot.graphemePositionStartFrom(flattenedLines.text, flattenedLines.lineTerminators, tokenStart),
            LexError.UnterminatedMultilineTokenKind.QuotedIdentifier,
        );
    } else if (maybeTokenEnd.kind !== Token.LineTokenKind.QuotedIdentifierEnd) {
        const details: { foundTokenEnd: FlatLineToken } = { foundTokenEnd: maybeTokenEnd };
        const message: string = `once a multiline token starts it should either reach a paired end token, or eof`;
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: Token.TokenPosition = tokenStart.positionStart;
        const positionEnd: Token.TokenPosition = tokenEnd.positionEnd;

        return {
            token: {
                kind: Token.TokenKind.Identifier,
                data: flattenedLines.text.substring(positionStart.codeUnit, positionEnd.codeUnit),
                positionStart,
                positionEnd,
            },
            flatIndexEnd: tokenEnd.flatIndex,
        };
    }
}

function readTextLiteral(
    flattenedLines: FlattenedLines,
    tokenStart: FlatLineToken,
    locale: string,
    maybeCancellationToken: ICancellationToken | undefined,
): ConcatenatedTokenRead {
    const collection: FlatLineCollection = collectWhileContent(
        flattenedLines.flatLineTokens,
        tokenStart,
        Token.LineTokenKind.TextLiteralContent,
        maybeCancellationToken,
    );

    const maybeTokenEnd: FlatLineToken | undefined = collection.maybeTokenEnd;

    if (!maybeTokenEnd) {
        throw new LexError.UnterminatedMultilineTokenError(
            locale,
            LexerSnapshot.graphemePositionStartFrom(flattenedLines.text, flattenedLines.lineTerminators, tokenStart),
            LexError.UnterminatedMultilineTokenKind.Text,
        );
    } else if (maybeTokenEnd.kind !== Token.LineTokenKind.TextLiteralEnd) {
        const details: { foundTokenEnd: FlatLineToken } = { foundTokenEnd: maybeTokenEnd };
        const message: string = `once a multiline token starts it should either reach a paired end token, or eof`;
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: Token.TokenPosition = tokenStart.positionStart;
        const positionEnd: Token.TokenPosition = tokenEnd.positionEnd;

        return {
            token: {
                kind: Token.TokenKind.TextLiteral,
                data: flattenedLines.text.substring(positionStart.codeUnit, positionEnd.codeUnit),
                positionStart,
                positionEnd,
            },
            flatIndexEnd: tokenEnd.flatIndex,
        };
    }
}

function collectWhileContent<KindVariant extends Token.LineTokenKind>(
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
    contentKind: KindVariant,
    maybeCancellationToken: ICancellationToken | undefined,
): FlatLineCollection {
    const collectedTokens: FlatLineToken[] = [];
    const numTokens: number = flatTokens.length;

    let flatIndex: number = tokenStart.flatIndex + 1;

    while (flatIndex < numTokens) {
        maybeCancellationToken?.throwIfCancelled();

        const token: FlatLineToken = flatTokens[flatIndex];

        if (token.kind !== contentKind) {
            break;
        }

        collectedTokens.push(token);
        flatIndex += 1;
    }

    return {
        tokenStart,
        collectedTokens,
        maybeTokenEnd: flatTokens[flatIndex],
    };
}

function flattenLineTokens(state: Lexer.State): FlattenedLines {
    const lines: ReadonlyArray<Lexer.TLine> = state.lines;
    const lineTerminators: LineTerminator[] = [];
    const numLines: number = lines.length;

    let text: string = "";
    const flatLineTokens: FlatLineToken[] = [];

    let lineTextOffset: number = 0;
    let flatIndex: number = 0;

    for (let lineNumber: number = 0; lineNumber < numLines; lineNumber += 1) {
        const line: Lexer.TLine = lines[lineNumber];

        text += line.text;

        if (lineNumber !== numLines - 1) {
            text += line.lineTerminator;
        }

        for (const lineToken of line.tokens) {
            const linePositionStart: number = lineToken.positionStart;
            const linePositionEnd: number = lineToken.positionEnd;

            flatLineTokens.push({
                kind: lineToken.kind,
                data: lineToken.data,
                positionStart: {
                    codeUnit: lineTextOffset + linePositionStart,
                    lineCodeUnit: linePositionStart,
                    lineNumber,
                },
                positionEnd: {
                    codeUnit: lineTextOffset + linePositionEnd,
                    lineCodeUnit: linePositionEnd,
                    lineNumber,
                },
                flatIndex,
            });

            flatIndex += 1;
        }

        const lineTerminatorCodeUnit: number = lineTextOffset + line.text.length;

        lineTerminators.push({
            codeUnit: lineTerminatorCodeUnit,
            text: line.lineTerminator,
        });

        lineTextOffset = lineTerminatorCodeUnit + line.lineTerminator.length;
    }

    return {
        text,
        lineTerminators,
        flatLineTokens,
    };
}

interface FlattenedLines {
    text: string;
    lineTerminators: ReadonlyArray<LineTerminator>;
    flatLineTokens: ReadonlyArray<FlatLineToken>;
}

interface ConcatenatedCommentRead {
    readonly comment: Comment.TComment;
    readonly flatIndexEnd: number;
}

interface ConcatenatedTokenRead {
    readonly token: Token.Token;
    readonly flatIndexEnd: number;
}

interface FlatLineCollection {
    readonly tokenStart: FlatLineToken;
    readonly collectedTokens: ReadonlyArray<FlatLineToken>;
    readonly maybeTokenEnd: FlatLineToken | undefined;
}

interface LineTerminator {
    readonly codeUnit: number;
    readonly text: string;
}

interface FlatLineToken extends Token.IToken<Token.LineTokenKind, Token.TokenPosition> {
    readonly flatIndex: number;
}
