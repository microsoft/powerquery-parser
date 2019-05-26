// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, Option, Result, ResultKind, StringHelpers } from "../common";
import { CommentKind, LineComment, MultilineComment, TComment } from "./comment";
import * as LexerError from "./error";
import * as Lexer from "./lexer";
import { LineTokenKind, Token, TokenKind } from "./token";

export type TriedLexerSnapshot = Result<LexerSnapshot, LexerError.TLexerError>;

export class LexerSnapshot {
    constructor(
        public readonly text: string,
        public readonly tokens: ReadonlyArray<Token>,
        public readonly comments: ReadonlyArray<TComment>,
    ) {}

    public static tryFrom(state: Lexer.State): Result<LexerSnapshot, LexerError.TLexerError> {
        try {
            return {
                kind: ResultKind.Ok,
                value: LexerSnapshot.factory(state),
            };
        } catch (e) {
            let error: LexerError.TLexerError;
            if (LexerError.isTInnerLexerError(e)) {
                error = new LexerError.LexerError(e);
            } else {
                error = CommonError.ensureCommonError(e);
            }
            return {
                kind: ResultKind.Err,
                error,
            };
        }
    }

    private static factory(state: Lexer.State): LexerSnapshot {
        // class properties
        const tokens: Token[] = [];
        const comments: TComment[] = [];
        const [text, flatTokens]: [string, ReadonlyArray<FlatLineToken>] = flattenLineTokens(state);
        const numFlatTokens: number = flatTokens.length;

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
                        text,
                        flatTokens,
                        flatToken,
                    );
                    comments.push(concatenatedTokenRead.comment);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                case LineTokenKind.QuotedIdentifierStart: {
                    const concatenatedTokenRead: ConcatenatedTokenRead = readQuotedIdentifier(
                        text,
                        flatTokens,
                        flatToken,
                    );
                    tokens.push(concatenatedTokenRead.token);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                case LineTokenKind.StringLiteralStart: {
                    const concatenatedTokenRead: ConcatenatedTokenRead = readStringLiteral(text, flatTokens, flatToken);
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
                    const positionStart: StringHelpers.ExtendedGraphemePosition = flatToken.positionStart;
                    const positionEnd: StringHelpers.ExtendedGraphemePosition = flatToken.positionEnd;
                    tokens.push({
                        kind: (flatToken.kind as unknown) as TokenKind,
                        data: flatToken.data,
                        positionStart,
                        positionEnd,
                    });
            }

            flatIndex += 1;
        }

        return new LexerSnapshot(text, tokens, comments);
    }
}

function readLineComment(flatToken: FlatLineToken): LineComment {
    const positionStart: StringHelpers.ExtendedGraphemePosition = flatToken.positionStart;
    const positionEnd: StringHelpers.ExtendedGraphemePosition = flatToken.positionEnd;

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
    const positionStart: StringHelpers.ExtendedGraphemePosition = flatToken.positionStart;
    const positionEnd: StringHelpers.ExtendedGraphemePosition = flatToken.positionEnd;

    return {
        kind: CommentKind.Multiline,
        data: flatToken.data,
        containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
        positionStart,
        positionEnd,
    };
}

function readMultilineComment(
    text: string,
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
): ConcatenatedCommentRead {
    const collection: FlatLineCollection = collectWhileContent(
        flatTokens,
        tokenStart,
        LineTokenKind.MultilineCommentContent,
    );
    const maybeTokenEnd: Option<FlatLineToken> = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart: StringHelpers.ExtendedGraphemePosition = tokenStart.positionStart;
        throw new LexerError.UnterminatedMultilineTokenError(
            positionStart,
            LexerError.UnterminatedMultilineTokenKind.MultilineComment,
        );
    } else if (maybeTokenEnd.kind !== LineTokenKind.MultilineCommentEnd) {
        const details: {} = { foundTokenEnd: maybeTokenEnd };
        const message: string = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: StringHelpers.ExtendedGraphemePosition = tokenStart.positionStart;
        const positionEnd: StringHelpers.ExtendedGraphemePosition = tokenEnd.positionEnd;

        return {
            comment: {
                kind: CommentKind.Multiline,
                data: text.substring(positionStart.codeUnit, positionEnd.codeUnit),
                containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
                positionStart,
                positionEnd,
            },
            flatIndexEnd: tokenEnd.flatIndex,
        };
    }
}

function readQuotedIdentifier(
    text: string,
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {
    const collection: FlatLineCollection = collectWhileContent(
        flatTokens,
        tokenStart,
        LineTokenKind.QuotedIdentifierContent,
    );
    const maybeTokenEnd: Option<FlatLineToken> = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart: StringHelpers.ExtendedGraphemePosition = tokenStart.positionStart;
        throw new LexerError.UnterminatedMultilineTokenError(
            positionStart,
            LexerError.UnterminatedMultilineTokenKind.QuotedIdentifier,
        );
    } else if (maybeTokenEnd.kind !== LineTokenKind.QuotedIdentifierEnd) {
        const details: {} = { foundTokenEnd: maybeTokenEnd };
        const message: string = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: StringHelpers.ExtendedGraphemePosition = tokenStart.positionStart;
        const positionEnd: StringHelpers.ExtendedGraphemePosition = tokenEnd.positionEnd;

        return {
            token: {
                kind: TokenKind.Identifier,
                data: text.substring(positionStart.codeUnit, positionEnd.codeUnit),
                positionStart,
                positionEnd,
            },
            flatIndexEnd: tokenEnd.flatIndex,
        };
    }
}

function readStringLiteral(
    text: string,
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {
    const collection: FlatLineCollection = collectWhileContent(
        flatTokens,
        tokenStart,
        LineTokenKind.StringLiteralContent,
    );
    const maybeTokenEnd: Option<FlatLineToken> = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart: StringHelpers.ExtendedGraphemePosition = tokenStart.positionStart;
        throw new LexerError.UnterminatedMultilineTokenError(
            positionStart,
            LexerError.UnterminatedMultilineTokenKind.String,
        );
    } else if (maybeTokenEnd.kind !== LineTokenKind.StringLiteralEnd) {
        const details: {} = { foundTokenEnd: maybeTokenEnd };
        const message: string = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message, details);
    } else {
        const tokenEnd: FlatLineToken = maybeTokenEnd;
        const positionStart: StringHelpers.ExtendedGraphemePosition = tokenStart.positionStart;
        const positionEnd: StringHelpers.ExtendedGraphemePosition = tokenEnd.positionEnd;

        return {
            token: {
                kind: TokenKind.StringLiteral,
                data: text.substring(positionStart.codeUnit, positionEnd.codeUnit),
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
        collectedTokens: collectedTokens,
        maybeTokenEnd: flatTokens[flatIndex],
    };
}

function flattenLineTokens(state: Lexer.State): [string, ReadonlyArray<FlatLineToken>] {
    const lines: ReadonlyArray<Lexer.TLine> = state.lines;
    const numLines: number = lines.length;

    let text: string = "";
    const flatTokens: FlatLineToken[] = [];

    let lineTextOffset: number = 0;
    let flatIndex: number = 0;

    for (let lineNumber: number = 0; lineNumber < numLines; lineNumber++) {
        const line: Lexer.TLine = lines[lineNumber];

        text += line.text;
        if (lineNumber !== numLines - 1) {
            text += line.lineTerminator;
        }

        const columnNumberMap: ColumnNumberMap = getColumnNumberMap(text);

        for (const lineToken of line.tokens) {
            const linePositionStart: number = lineToken.positionStart;
            const linePositionEnd: number = lineToken.positionEnd;

            flatTokens.push({
                kind: lineToken.kind,
                data: lineToken.data,
                positionStart: {
                    codeUnit: lineTextOffset + linePositionStart,
                    lineCodeUnit: linePositionStart,
                    lineNumber,
                    columnNumber: columnNumberMap[linePositionStart],
                },
                positionEnd: {
                    codeUnit: lineTextOffset + linePositionEnd,
                    lineCodeUnit: linePositionEnd,
                    lineNumber,
                    columnNumber: columnNumberMap[linePositionEnd],
                },
                flatIndex,
            });

            flatIndex += 1;
        }

        lineTextOffset += line.text.length + line.lineTerminator.length;
    }

    return [text, flatTokens];
}

function getColumnNumberMap(text: string): ColumnNumberMap {
    const graphemes: ReadonlyArray<string> = StringHelpers.graphemeSplitter.splitGraphemes(text);
    const numGraphemes: number = graphemes.length;
    const map: ColumnNumberMap = {};

    let summedCodeUnits: number = 0;
    for (let index: number = 0; index < numGraphemes; index += 1) {
        map[summedCodeUnits] = index;
        const grapheme: string = graphemes[index];
        summedCodeUnits += grapheme.length;
    }

    map[numGraphemes] = text.length;

    return map;
}

type ColumnNumberMap = { [codeUnit: number]: number };

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
    readonly maybeTokenEnd: Option<FlatLineToken>;
}

interface FlatLineToken {
    readonly kind: LineTokenKind;
    // range is [start, end)
    readonly positionStart: StringHelpers.ExtendedGraphemePosition;
    readonly positionEnd: StringHelpers.ExtendedGraphemePosition;
    readonly data: string;
    readonly flatIndex: number;
}
