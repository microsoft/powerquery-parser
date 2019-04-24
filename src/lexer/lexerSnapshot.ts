import { CommonError, Option } from "../common";
import { LexerError } from "./error";
import { LexerState, TLexerLine } from "./lexerContracts";
import { LineTokenKind, Token, TokenKind, TokenPosition } from "./token";

export class LexerSnapshot {
    public readonly text: string;
    public readonly tokens: ReadonlyArray<Token>;

    constructor(state: LexerState) {
        // class properties
        const tokens: Token[] = [];
        const [text, flatTokens]: [string, ReadonlyArray<FlatLineToken>] = flattenLineTokens(state);
        const numFlatTokens = flatTokens.length;

        let flatIndex = 0;
        while (flatIndex < numFlatTokens) {
            const flatToken: FlatLineToken = flatTokens[flatIndex];

            switch (flatToken.kind) {
                case LineTokenKind.MultilineCommentStart: {
                    const concatenatedTokenRead = readMultilineComment(text, flatTokens, flatToken);
                    tokens.push(concatenatedTokenRead.token);
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
                    //      one switch statement per LineKind
                    // why it's safe:
                    //      the above TokenLineKinds are taken care of, along with their Content and End variants,
                    //      leaving the rest to be a 1-to-1 match with TokenKind.
                    //      eg. set(LineTokenKind) & set(remaining variants) === set(LineKind)
                    const positionStart = flatToken.positionStart;
                    const positionEnd = flatToken.positionEnd;
                    tokens.push({
                        kind: flatToken.kind as unknown as TokenKind,
                        data: flatToken.data,
                        positionStart: {
                            textIndex: positionStart.textIndex,
                            lineNumber: positionStart.lineNumber,
                            columnNumber: positionStart.columnNumber,
                        },
                        positionEnd: {
                            textIndex: positionEnd.textIndex,
                            lineNumber: positionEnd.lineNumber,
                            columnNumber: positionEnd.columnNumber,
                        }
                    });
                    break;
            }

            flatIndex += 1;
        }

        this.text = text;
        this.tokens = tokens;
    }
}

function readMultilineComment(
    text: string,
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {
    const collection = collectWhileContent(flatTokens, tokenStart, LineTokenKind.MultilineCommentContent);
    const maybeTokenEnd = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart = tokenStart.positionStart;
        throw new LexerError.UnterminatedMultilineCommentError({
            textIndex: positionStart.textIndex,
            lineNumber: positionStart.lineNumber,
            columnNumber: positionStart.columnNumber,
        })
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
        token: {
            kind: TokenKind.MultilineComment,
            data: text.substring(positionStart.textIndex, positionEnd.textIndex),
            positionStart: {
                textIndex: positionStart.textIndex,
                lineNumber: positionStart.lineNumber,
                columnNumber: positionStart.columnNumber,
            },
            positionEnd: {
                textIndex: positionEnd.textIndex,
                lineNumber: positionEnd.lineNumber,
                columnNumber: positionEnd.columnNumber,
            },
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
        throw new LexerError.UnterminatedQuotedIdentierError({
            textIndex: positionStart.textIndex,
            lineNumber: positionStart.lineNumber,
            columnNumber: positionStart.columnNumber,
        })
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
            data: text.substring(positionStart.textIndex, positionEnd.textIndex),
            positionStart: {
                textIndex: positionStart.textIndex,
                lineNumber: positionStart.lineNumber,
                columnNumber: positionStart.columnNumber,
            },
            positionEnd: {
                textIndex: positionEnd.textIndex,
                lineNumber: positionEnd.lineNumber,
                columnNumber: positionEnd.columnNumber,
            },
        },
        flatIndexEnd: tokenEnd.flatIndex,
    }
}

function readStringLiteral(
    text: string,
    flatTokens: ReadonlyArray<FlatLineToken>,
    tokenStart: FlatLineToken,
): ConcatenatedTokenRead {    const collection = collectWhileContent(flatTokens, tokenStart, LineTokenKind.StringLiteralContent);
    const maybeTokenEnd = collection.maybeTokenEnd;
    if (!maybeTokenEnd) {
        const positionStart = tokenStart.positionStart;
        throw new LexerError.UnterminatedStringError({
            textIndex: positionStart.textIndex,
            lineNumber: positionStart.lineNumber,
            columnNumber: positionStart.columnNumber,
        })
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
            data: text.substring(positionStart.textIndex, positionEnd.textIndex),
            positionStart: {
                textIndex: positionStart.textIndex,
                lineNumber: positionStart.lineNumber,
                columnNumber: positionStart.columnNumber,
            },
            positionEnd: {
                textIndex: positionEnd.textIndex,
                lineNumber: positionEnd.lineNumber,
                columnNumber: positionEnd.columnNumber,
            },
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

function flattenLineTokens(state: LexerState): [string, ReadonlyArray<FlatLineToken>] {
    const lines: ReadonlyArray<TLexerLine> = state.lines;
    const numLines = lines.length;

    let text = "";
    let flatTokens: FlatLineToken[] = [];

    let lineTextOffset = 0;
    let flatIndex = 0;

    for (let line of lines) {
        let lineNumber = line.lineNumber;
        text += line.lineString.text;
        if (lineNumber !== numLines - 1) {
            text += state.lineSeparator;
        }

        for (let lineToken of line.tokens) {
            flatTokens.push({
                kind: lineToken.kind,
                data: lineToken.data,
                positionStart: {
                    lineTextIndex: lineToken.positionStart.textIndex,
                    textIndex: lineTextOffset + lineToken.positionStart.textIndex,
                    lineNumber,
                    columnNumber: lineToken.positionStart.columnNumber,
                },
                positionEnd: {
                    lineTextIndex: lineToken.positionEnd.textIndex,
                    textIndex: lineTextOffset + lineToken.positionEnd.textIndex,
                    lineNumber,
                    columnNumber: lineToken.positionEnd.columnNumber,
                },
                flatIndex,
            });

            flatIndex += 1;
        }

        lineTextOffset += (line.lineString.text.length + state.lineSeparator.length);
    }

    return [text, flatTokens];
}

interface ConcatenatedTokenRead {
    readonly token: Token,
    readonly flatIndexEnd: number,
}

interface FlatLineToken {
    readonly kind: LineTokenKind,
    // range is [start, end)
    readonly positionStart: FlatTokenPosition,
    readonly positionEnd: FlatTokenPosition,
    readonly data: string,
    readonly flatIndex: number,
}

interface FlatTokenPosition extends TokenPosition {
    readonly lineTextIndex: number,
}

interface FlatLineCollection {
    readonly tokenStart: FlatLineToken,
    readonly collectedTokens: ReadonlyArray<FlatLineToken>,
    readonly maybeTokenEnd: Option<FlatLineToken>,
}
