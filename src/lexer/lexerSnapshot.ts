// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, Option, Result, ResultKind, StringHelpers } from "../common";
import { CommentKind, LineComment, MultilineComment, TComment } from "./comment";
import { LexerError } from "./error";
import { Lexer } from "./lexer";
import { LineTokenKind, Token, TokenKind } from "./token";

export class LexerSnapshot {
    constructor(
        public readonly text: string,
        public readonly tokens: ReadonlyArray<Token>,
        public readonly comments: ReadonlyArray<TComment>,
    ) { }

    static tryFrom(state: Lexer.State): Result<LexerSnapshot, LexerError.TLexerError> {
        try {
            return {
                kind: ResultKind.Ok,
                value: LexerSnapshot.factory(state),
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

    private static factory(state: Lexer.State): LexerSnapshot {
        // class properties
        const tokens: Token[] = [];
        const comments: TComment[] = [];
        const [text, flatTokens]: [string, ReadonlyArray<FlatLineToken>] = flattenLineTokens(state);
        const numFlatTokens = flatTokens.length;

        let flatIndex = 0;
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
                    const concatenatedTokenRead = readMultilineComment(text, flatTokens, flatToken);
                    comments.push(concatenatedTokenRead.comment);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                case LineTokenKind.QuotedIdentifierStart: {
                    const concatenatedTokenRead = readQuotedIdentifier(text, flatTokens, flatToken);
                    tokens.push(concatenatedTokenRead.token);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                case LineTokenKind.StringLiteralStart: {
                    const concatenatedTokenRead = readStringLiteral(text, flatTokens, flatToken);
                    tokens.push(concatenatedTokenRead.token);
                    flatIndex = concatenatedTokenRead.flatIndexEnd;
                    break;
                }

                default:
                    // unsafe action:
                    //      casting TokenLineKind to TokenKind
                    // what I'm trying to avoid:
                    //      the cost of properly casting, aka one switch statement per LineTokenKind
                    // why it's safe:
                    //      the above TokenLineKinds are taken care of, along with their Content and End variants,
                    //      leaving the rest to be a 1-to-1 match with TokenKind.
                    //      eg. set(LineTokenKind) & set(remaining variants) === set(LineKind)
                    const positionStart = flatToken.positionStart;
                    const positionEnd = flatToken.positionEnd;
                    tokens.push({
                        kind: flatToken.kind as unknown as TokenKind,
                        data: flatToken.data,
                        positionStart,
                        positionEnd,
                    });
                    break;
            }

            flatIndex += 1;
        }

        return new LexerSnapshot(text, tokens, comments);
    }
}

function readLineComment(
    flatToken: FlatLineToken
): LineComment {
    const positionStart = flatToken.positionStart;
    const positionEnd = flatToken.positionEnd;
    return {
        kind: CommentKind.Line,
        data: flatToken.data,
        containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
        positionStart,
        positionEnd,
    };
}

// a multiline comment that spans a single line
function readSingleLineMultilineComment(
    flatToken: FlatLineToken
): MultilineComment {
    const positionStart = flatToken.positionStart;
    const positionEnd = flatToken.positionEnd;
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
    const collection = collectWhileContent(flatTokens, tokenStart, LineTokenKind.MultilineCommentContent);
    const maybeTokenEnd = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart = tokenStart.positionStart;
        throw new LexerError.UnterminatedMultilineCommentError(positionStart)
    }
    else if (maybeTokenEnd.kind !== LineTokenKind.MultilineCommentEnd) {
        const details = { foundTokenEnd: maybeTokenEnd };
        const message = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message, details);
    }
    const tokenEnd = maybeTokenEnd;

    const positionStart = tokenStart.positionStart;
    const positionEnd = tokenEnd.positionEnd;

    return {
        comment: {
            kind: CommentKind.Multiline,
            data: text.substring(positionStart.codeUnit, positionEnd.codeUnit),
            containsNewline: positionStart.lineNumber !== positionEnd.lineNumber,
            positionStart,
            positionEnd,
        },
        flatIndexEnd: tokenEnd.flatIndex,
    }
}

function readQuotedIdentifier(
    text: string,
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {
    const collection = collectWhileContent(flatTokens, tokenStart, LineTokenKind.QuotedIdentifierContent);
    const maybeTokenEnd = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart = tokenStart.positionStart;
        throw new LexerError.UnterminatedQuotedIdentierError(positionStart)
    }
    else if (maybeTokenEnd.kind !== LineTokenKind.QuotedIdentifierEnd) {
        const details = { foundTokenEnd: maybeTokenEnd };
        const message = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message, details);
    }
    const tokenEnd = maybeTokenEnd;

    const positionStart = tokenStart.positionStart;
    const positionEnd = tokenEnd.positionEnd;

    return {
        token: {
            kind: TokenKind.Identifier,
            data: text.substring(positionStart.codeUnit, positionEnd.codeUnit),
            positionStart,
            positionEnd,
        },
        flatIndexEnd: tokenEnd.flatIndex,
    }
}

function readStringLiteral(
    text: string,
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {
    const collection = collectWhileContent(flatTokens, tokenStart, LineTokenKind.StringLiteralContent);
    const maybeTokenEnd = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart = tokenStart.positionStart;
        throw new LexerError.UnterminatedStringError(positionStart)
    }
    else if (maybeTokenEnd.kind !== LineTokenKind.StringLiteralEnd) {
        const details = { foundTokenEnd: maybeTokenEnd };
        const message = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message, details);
    }
    const tokenEnd = maybeTokenEnd;

    const positionStart = tokenStart.positionStart;
    const positionEnd = tokenEnd.positionEnd;

    return {
        token: {
            kind: TokenKind.StringLiteral,
            data: text.substring(positionStart.codeUnit, positionEnd.codeUnit),
            positionStart,
            positionEnd,
        },
        flatIndexEnd: tokenEnd.flatIndex,
    }
}

function collectWhileContent<KindVariant>(
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
    contentKind: KindVariant & LineTokenKind,
): FlatLineCollection {
    const collectedTokens: FlatLineToken[] = [];
    const numTokens = flatTokens.length;

    let flatIndex = tokenStart.flatIndex + 1;
    while (flatIndex < numTokens) {
        const token = flatTokens[flatIndex];
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
    }
}

function flattenLineTokens(state: Lexer.State): [string, ReadonlyArray<FlatLineToken>] {
    const lines: ReadonlyArray<Lexer.TLine> = state.lines;
    const numLines = lines.length;

    let text = "";
    let flatTokens: FlatLineToken[] = [];

    let lineTextOffset = 0;
    let flatIndex = 0;

    for (let lineNumber = 0; lineNumber < numLines; lineNumber++) {
        const line = lines[lineNumber];
        text += line.text;

        if (lineNumber !== numLines - 1) {
            text += state.lineTerminator;
        }

        const columnNumberMap: ColumnNumberMap = getColumnNumberMap(text);

        for (let lineToken of line.tokens) {
            const linePositionStart = lineToken.positionStart;
            const linePositionEnd = lineToken.positionEnd;

            flatTokens.push({
                kind: lineToken.kind,
                data: lineToken.data,
                positionStart: {
                    codeUnit: text.length,
                    lineCodeUnit: linePositionStart,
                    lineNumber,
                    columnNumber: columnNumberMap[linePositionStart],
                },
                positionEnd: {
                    codeUnit: text.length + lineToken.data.length,
                    lineCodeUnit: linePositionEnd,
                    lineNumber,
                    columnNumber: columnNumberMap[linePositionEnd],
                },
                flatIndex,
            });

            flatIndex += 1;
        }

        lineTextOffset += (line.text.length + state.lineTerminator.length);
    }

    return [text, flatTokens];
}

function getColumnNumberMap(text: string): ColumnNumberMap {
    const graphemes: ReadonlyArray<string> = StringHelpers.graphemeSplitter.splitGraphemes(text);
    const numGraphemes = graphemes.length;
    const map: ColumnNumberMap = {};

    let summedCodeUnits = 0;
    for (let index = 0; index < numGraphemes; index += 1) {
        map[summedCodeUnits] = index;
        const grapheme: string = graphemes[index];
        summedCodeUnits += grapheme.length;
    }

    map[numGraphemes] = text.length;

    return map;
}

type ColumnNumberMap = {[codeUnit: number]: number};

interface ConcatenatedCommentRead {
    readonly comment: TComment,
    readonly flatIndexEnd: number,
}

interface ConcatenatedTokenRead {
    readonly token: Token,
    readonly flatIndexEnd: number,
}

interface FlatLineToken {
    readonly kind: LineTokenKind,
    // range is [start, end)
    readonly positionStart: StringHelpers.ExtendedGraphemePosition,
    readonly positionEnd: StringHelpers.ExtendedGraphemePosition,
    readonly data: string,
    readonly flatIndex: number,
}

interface FlatLineCollection {
    readonly tokenStart: FlatLineToken,
    readonly collectedTokens: ReadonlyArray<FlatLineToken>,
    readonly maybeTokenEnd: Option<FlatLineToken>,
}
