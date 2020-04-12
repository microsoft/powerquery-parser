// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer, LexError } from ".";
import { CommonError, Result, ResultUtils, StringUtils } from "../common";
import { ILocalizationTemplates } from "../localization";
import { CommentKind, LineComment, MultilineComment, TComment } from "./comment";
import { IToken, LineTokenKind, Token, TokenKind, TokenPosition } from "./token";

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
        public readonly tokens: ReadonlyArray<Token>,
        public readonly comments: ReadonlyArray<TComment>,
        public readonly lineTerminators: ReadonlyArray<LineTerminator>,
    ) {}

    public static tryFrom(state: Lexer.State): TriedLexerSnapshot {
        try {
            return ResultUtils.okFactory(LexerSnapshot.factory(state));
        } catch (e) {
            let error: LexError.TLexError;
            if (LexError.isTInnerLexError(e)) {
                error = new LexError.LexError(e);
            } else {
                error = CommonError.ensureCommonError(state.localizationTemplates, e);
            }
            return ResultUtils.errFactory(error);
        }
    }

    public static graphemePositionStartFrom(
        text: string,
        lineTerminators: ReadonlyArray<LineTerminator>,
        flatLineToken: Token | FlatLineToken,
    ): StringUtils.GraphemePosition {
        const positionStart: TokenPosition = flatLineToken.positionStart;
        const positionEnd: TokenPosition = flatLineToken.positionEnd;

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

    public graphemePositionStartFrom(token: Token): StringUtils.GraphemePosition {
        return LexerSnapshot.graphemePositionStartFrom(this.text, this.lineTerminators, token);
    }

    public columnNumberStartFrom(token: Token): number {
        return this.graphemePositionStartFrom(token).columnNumber;
    }

    private static factory(state: Lexer.State): LexerSnapshot {
        // class properties
        const tokens: Token[] = [];
        const comments: TComment[] = [];
        const flattenedLines: FlattenedLines = flattenLineTokens(state);
        const flatTokens: ReadonlyArray<FlatLineToken> = flattenedLines.flatLineTokens;
        const numFlatTokens: number = flatTokens.length;
        const text: string = flattenedLines.text;
        const localizationTemplates: ILocalizationTemplates = state.localizationTemplates;

        let flatIndex: number = 0;
        while (flatIndex < numFlatTokens) {
            const flatToken: FlatLineToken = flatTokens[flatIndex];

            switch (flatToken.kind) {
                case LineTokenKind.LineComment:
                    comments.push(readLineComment(flatToken));
                    break;

                case LineTokenKind.MultilineComment:
                    comments.push(readSingleLineMultilineComment(flatToken));
                    break;

                case LineTokenKind.MultilineCommentStart: {
                    const concatenatedTokenRead: ConcatenatedCommentRead = readMultilineComment(
                        localizationTemplates,
                        flattenedLines,
                        flatToken,
                    );
                    comments.push(concatenatedTokenRead.comment);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                case LineTokenKind.QuotedIdentifierStart: {
                    const concatenatedTokenRead: ConcatenatedTokenRead = readQuotedIdentifier(
                        localizationTemplates,
                        flattenedLines,
                        flatToken,
                    );
                    tokens.push(concatenatedTokenRead.token);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                case LineTokenKind.TextLiteralStart: {
                    const concatenatedTokenRead: ConcatenatedTokenRead = readTextLiteral(
                        localizationTemplates,
                        flattenedLines,
                        flatToken,
                    );
                    tokens.push(concatenatedTokenRead.token);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                default:
                    // UNSAFE MARKER
                    //
                    // Purpose of code block:
                    //      Translate LineTokenKind to LineToken.
                    //
                    // Why are you trying to avoid a safer approach?
                    //      A proper mapping would require a switch statement, one case per kind in LineNodeKind
                    //
                    // Why is it safe?
                    //      Almost all of LineTokenKind and TokenKind have a 1-to-1 mapping.
                    //      The edge cases (multiline tokens) have already been taken care of above.
                    //      set(remaining variants of LineTokenKind) === set(LineKind)
                    const positionStart: TokenPosition = flatToken.positionStart;
                    const positionEnd: TokenPosition = flatToken.positionEnd;
                    tokens.push({
                        kind: (flatToken.kind as unknown) as TokenKind,
                        data: flatToken.data,
                        positionStart,
                        positionEnd,
                    });
            }

            flatIndex += 1;
        }

        return new LexerSnapshot(text, tokens, comments, flattenedLines.lineTerminators);
    }
}

function readLineComment(flatToken: FlatLineToken): LineComment {
    const positionStart: TokenPosition = flatToken.positionStart;
    const positionEnd: TokenPosition = flatToken.positionEnd;

    return {
        kind: CommentKind.Line,
        data: flatToken.data,
        containsNewline: true,
        positionStart,
        positionEnd,
    };
}

// a multiline comment that spans a single line
function readSingleLineMultilineComment(flatToken: FlatLineToken): MultilineComment {
    const positionStart: TokenPosition = flatToken.positionStart;
    const positionEnd: TokenPosition = flatToken.positionEnd;

    return {
        kind: CommentKind.Multiline,
        data: flatToken.data,
        containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
        positionStart,
        positionEnd,
    };
}

function readMultilineComment(
    localizationTemplates: ILocalizationTemplates,
    flattenedLines: FlattenedLines,
    tokenStart: FlatLineToken,
): ConcatenatedCommentRead {
    const collection: FlatLineCollection = collectWhileContent(
        flattenedLines.flatLineTokens,
        tokenStart,
        LineTokenKind.MultilineCommentContent,
    );
    const maybeTokenEnd: FlatLineToken | undefined = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        throw new LexError.UnterminatedMultilineTokenError(
            localizationTemplates,
            LexerSnapshot.graphemePositionStartFrom(flattenedLines.text, flattenedLines.lineTerminators, tokenStart),
            LexError.UnterminatedMultilineTokenKind.MultilineComment,
        );
    } else if (maybeTokenEnd.kind !== LineTokenKind.MultilineCommentEnd) {
        const details: {} = { foundTokenEnd: maybeTokenEnd };
        const message: string = `once a multiline token starts it should either reach a paired end token, or eof`;
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: TokenPosition = tokenStart.positionStart;
        const positionEnd: TokenPosition = tokenEnd.positionEnd;

        return {
            comment: {
                kind: CommentKind.Multiline,
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
    localizationTemplates: ILocalizationTemplates,
    flattenedLines: FlattenedLines,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {
    const collection: FlatLineCollection = collectWhileContent(
        flattenedLines.flatLineTokens,
        tokenStart,
        LineTokenKind.QuotedIdentifierContent,
    );
    const maybeTokenEnd: FlatLineToken | undefined = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        throw new LexError.UnterminatedMultilineTokenError(
            localizationTemplates,
            LexerSnapshot.graphemePositionStartFrom(flattenedLines.text, flattenedLines.lineTerminators, tokenStart),
            LexError.UnterminatedMultilineTokenKind.QuotedIdentifier,
        );
    } else if (maybeTokenEnd.kind !== LineTokenKind.QuotedIdentifierEnd) {
        const details: {} = { foundTokenEnd: maybeTokenEnd };
        const message: string = `once a multiline token starts it should either reach a paired end token, or eof`;
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: TokenPosition = tokenStart.positionStart;
        const positionEnd: TokenPosition = tokenEnd.positionEnd;

        return {
            token: {
                kind: TokenKind.Identifier,
                data: flattenedLines.text.substring(positionStart.codeUnit, positionEnd.codeUnit),
                positionStart,
                positionEnd,
            },
            flatIndexEnd: tokenEnd.flatIndex,
        };
    }
}

function readTextLiteral(
    localizationTemplates: ILocalizationTemplates,
    flattenedLines: FlattenedLines,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {
    const collection: FlatLineCollection = collectWhileContent(
        flattenedLines.flatLineTokens,
        tokenStart,
        LineTokenKind.TextLiteralContent,
    );
    const maybeTokenEnd: FlatLineToken | undefined = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        throw new LexError.UnterminatedMultilineTokenError(
            localizationTemplates,
            LexerSnapshot.graphemePositionStartFrom(flattenedLines.text, flattenedLines.lineTerminators, tokenStart),
            LexError.UnterminatedMultilineTokenKind.Text,
        );
    } else if (maybeTokenEnd.kind !== LineTokenKind.TextLiteralEnd) {
        const details: {} = { foundTokenEnd: maybeTokenEnd };
        const message: string = `once a multiline token starts it should either reach a paired end token, or eof`;
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: TokenPosition = tokenStart.positionStart;
        const positionEnd: TokenPosition = tokenEnd.positionEnd;

        return {
            token: {
                kind: TokenKind.TextLiteral,
                data: flattenedLines.text.substring(positionStart.codeUnit, positionEnd.codeUnit),
                positionStart,
                positionEnd,
            },
            flatIndexEnd: tokenEnd.flatIndex,
        };
    }
}

function collectWhileContent<KindVariant>(
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
    contentKind: KindVariant & LineTokenKind,
): FlatLineCollection {
    const collectedTokens: FlatLineToken[] = [];
    const numTokens: number = flatTokens.length;

    let flatIndex: number = tokenStart.flatIndex + 1;
    while (flatIndex < numTokens) {
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
    readonly comment: TComment;
    readonly flatIndexEnd: number;
}

interface ConcatenatedTokenRead {
    readonly token: Token;
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

interface FlatLineToken extends IToken<LineTokenKind, TokenPosition> {
    readonly flatIndex: number;
}
