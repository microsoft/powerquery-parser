import { TComment, MultilineComment, CommentKind, LineComment } from "./comment";
import { LexerState, TLexerLine } from "./lexerContracts";
import { LineToken, LineTokenKind, Token, TokenPosition, LexerLinePosition, TokenKind } from "./token";
import { Option, CommonError } from "../common";
import { LexerError } from "./error";

export class LexerSnapshot {
    public readonly text: string;
    public readonly tokens: ReadonlyArray<Token>;
    public readonly comments: ReadonlyArray<TComment>;

    constructor(state: LexerState) {
        // class properties
        const tokens: Token[] = [];
        const comments: TComment[] = [];
        let text = "";

        let textIndexOffset = 0;
        for (let line of state.lines) {
            const lineTokens: ReadonlyArray<LineToken> = line.tokens;

            for (let lineToken of lineTokens) {
                text += lineToken.data;

                switch (lineToken.kind) {
                    case LineTokenKind.LineComment:
                        comments.push(LexerSnapshot.readLineComment(lineToken, textIndexOffset, line.lineNumber));
                        break;

                    case LineTokenKind.MultilineCommentStart:
                        comments.push(LexerSnapshot.readMultilineComment(state, textIndexOffset, line.lineNumber, lineToken));
                        break;

                    case LineTokenKind.QuotedIdentifierStart:
                        tokens.push(LexerSnapshot.readQuotedIdentifier(state, textIndexOffset, line.lineNumber, lineToken));
                        break;

                    case LineTokenKind.StringLiteralStart:
                        tokens.push(LexerSnapshot.readString(state, textIndexOffset, line.lineNumber, lineToken));
                        break;

                    default:
                        // unsafe action:
                        //      casting TokenLineKind to TokenKind
                        // what I'm trying to avoid:
                        //      one switch statement per LineKind
                        // why it's safe:
                        //      the above TokenLineKinds are taken care of, along with their Content and End variants,
                        //      leaving the rest to be a 1-to-1 match with TokenKind.
                        //      eg. set(LineTokenKind) & set(remaining variants) === set(LineKind)
                        const tokenKind: TokenKind = lineToken.kind as unknown as TokenKind;
                        const tokenPositionStart = lineToken.positionStart;
                        const tokenPositionEnd = lineToken.positionEnd;
                        tokens.push({
                            kind: tokenKind,
                            data: lineToken.data,
                            positionStart: {
                                textIndex: textIndexOffset + tokenPositionStart.textIndex,
                                lineNumber: line.lineNumber,
                                columnNumber: tokenPositionStart.columnNumber,
                            },
                            positionEnd: {
                                textIndex: textIndexOffset + tokenPositionEnd.textIndex,
                                lineNumber: line.lineNumber,
                                columnNumber: tokenPositionEnd.columnNumber,
                            },
                        })
                        break;
                }
            }

            textIndexOffset += (line.lineString.text.length + state.lineSeparator.length);
            text += state.lineSeparator;
        }

        this.text = text;
        this.tokens = tokens;
        this.comments = comments;
    }

    private static readLineComment(
        lineToken: LineToken,
        textIndexOffset: number,
        lineNumber: number,
    ): LineComment {
        return {
            kind: CommentKind.Line,
            containsNewline: true,
            data: lineToken.data,
            positionStart: {
                textIndex: textIndexOffset + lineToken.positionStart.textIndex,
                lineNumber: lineNumber,
                columnNumber: lineToken.positionStart.columnNumber,
            },
            positionEnd: {
                textIndex: textIndexOffset + lineToken.positionEnd.textIndex,
                lineNumber,
                columnNumber: lineToken.positionEnd.columnNumber,
            }
        }
    }

    private static readMultilineComment(
        state: LexerState,
        lineTextOffset: number,
        lineNumber: number,
        firstLineToken: LineToken,
    ): MultilineComment {
        const columnNumber = firstLineToken.positionStart.columnNumber;
        const maybeNextTokenPosition = LexerSnapshot.maybeNextTokenPositionStart(state, lineTextOffset, lineNumber, columnNumber);
        if (!maybeNextTokenPosition) {
            throw new LexerError.LexerError(LexerSnapshot.unterminatedMultilineCommentError(lineNumber, firstLineToken));
        }

        else {
            const nextTokenPosition = maybeNextTokenPosition;
            const collection: LineTokenCollection = LexerSnapshot.collectWhile(
                state,
                nextTokenPosition,
                (token: LineToken) => token.kind === LineTokenKind.MultilineCommentContent,
            );

            if (!collection.maybeTerminator) {
                throw new LexerError.LexerError(LexerSnapshot.unterminatedMultilineCommentError(lineNumber, firstLineToken));
            }

            const terminator = collection.maybeTerminator;
            const lastLineToken: LineToken = terminator.token;
            const lastLineTokenPosition = terminator.position
            if (lastLineToken.kind !== LineTokenKind.MultilineCommentEnd) {
                throw LexerSnapshot.invalidMultilineEndError(lastLineToken);
            }

            return {
                kind: CommentKind.Multiline,
                containsNewline: lineNumber !== lastLineTokenPosition.lineNumber,
                data: [
                    firstLineToken.data,
                    ...collection.lineTokens.map((lineToken: LineToken) => lineToken.data),
                    lastLineToken.data,
                ].join(state.lineSeparator),
                positionStart: {
                    textIndex: firstLineToken.positionStart.textIndex,
                    lineNumber,
                    columnNumber: firstLineToken.positionStart.columnNumber,
                },
                positionEnd: {
                    textIndex: lastLineTokenPosition.textIndex + lastLineToken.data.length,
                    lineNumber: lastLineTokenPosition.lineNumber,
                    columnNumber: lastLineToken.positionEnd.columnNumber,
                },
            }
        }
    }

    private static readQuotedIdentifier(
        state: LexerState,
        lineTextOffset: number,
        lineNumber: number,
        firstLineToken: LineToken,
    ): Token {
        const columnNumber = firstLineToken.positionStart.columnNumber;
        const maybeNextTokenPosition = LexerSnapshot.maybeNextTokenPositionStart(state, lineTextOffset, lineNumber, columnNumber);
        if (!maybeNextTokenPosition) {
            throw new LexerError.LexerError(LexerSnapshot.unterminatedQuotedIdentierError(lineNumber, firstLineToken));
        }

        else {
            const nextTokenPosition = maybeNextTokenPosition;
            const collection: LineTokenCollection = LexerSnapshot.collectWhile(
                state,
                nextTokenPosition,
                (token: LineToken) => token.kind === LineTokenKind.QuotedIdentifierContent,
            );

            if (!collection.maybeTerminator) {
                throw new LexerError.LexerError(LexerSnapshot.unterminatedQuotedIdentierError(lineNumber, firstLineToken));
            }

            const terminator = collection.maybeTerminator;
            const lastLineToken: LineToken = terminator.token;
            const lastLinePositionStart = terminator.position
            if (lastLineToken.kind !== LineTokenKind.QuotedIdentifierEnd) {
                throw LexerSnapshot.invalidMultilineEndError(lastLineToken);
            }

            return {
                kind: TokenKind.Identifier,
                data: [
                    firstLineToken.data,
                    ...collection.lineTokens.map((lineToken: LineToken) => lineToken.data),
                    lastLineToken.data,
                ].join(state.lineSeparator),
                positionStart: {
                    textIndex: firstLineToken.positionStart.textIndex,
                    lineNumber,
                    columnNumber: firstLineToken.positionStart.columnNumber,
                },
                positionEnd: {
                    textIndex: lastLinePositionStart.textIndex + lastLineToken.data.length,
                    lineNumber: lastLinePositionStart.lineNumber,
                    columnNumber: lastLineToken.positionEnd.columnNumber,
                },
            }
        }
    }

    private static readString(
        state: LexerState,
        lineTextOffset: number,
        lineNumber: number,
        firstLineToken: LineToken,
    ): Token {
        const columnNumber = firstLineToken.positionStart.columnNumber;
        const maybeNextTokenPosition = LexerSnapshot.maybeNextTokenPositionStart(state, lineTextOffset, lineNumber, columnNumber);
        if (!maybeNextTokenPosition) {
            throw new LexerError.LexerError(LexerSnapshot.unterminatedStringError(lineNumber, firstLineToken));
        }

        else {
            const nextTokenPosition = maybeNextTokenPosition;
            const collection: LineTokenCollection = LexerSnapshot.collectWhile(
                state,
                nextTokenPosition,
                (token: LineToken) => token.kind === LineTokenKind.StringLiteralContent,
            );

            if (!collection.maybeTerminator) {
                throw new LexerError.LexerError(LexerSnapshot.unterminatedStringError(lineNumber, firstLineToken));
            }

            const terminator = collection.maybeTerminator;
            const lastLineToken: LineToken = terminator.token;
            const lastLinePositionStart = terminator.position
            if (lastLineToken.kind !== LineTokenKind.StringLiteralEnd) {
                throw LexerSnapshot.invalidMultilineEndError(lastLineToken);
            }

            return {
                kind: TokenKind.StringLiteral,
                data: [
                    firstLineToken.data,
                    ...collection.lineTokens.map((lineToken: LineToken) => lineToken.data),
                    lastLineToken.data,
                ].join(state.lineSeparator),
                positionStart: {
                    textIndex: firstLineToken.positionStart.textIndex,
                    lineNumber,
                    columnNumber: firstLineToken.positionStart.columnNumber,
                },
                positionEnd: {
                    textIndex: lastLinePositionStart.textIndex + lastLineToken.data.length,
                    lineNumber: lastLinePositionStart.lineNumber,
                    columnNumber: lastLineToken.positionEnd.columnNumber,
                },
            }
        }
    }

    private static unterminatedMultilineCommentError(
        lineNumber: number,
        token: LineToken,
    ): LexerError.UnterminatedMultilineCommentError {
        const positionStart = token.positionStart;
        throw new LexerError.UnterminatedMultilineCommentError({
            lineNumber,
            ...positionStart
        });
    }

    private static unterminatedQuotedIdentierError(
        lineNumber: number,
        token: LineToken,
    ): LexerError.UnterminatedQuotedIdentierError {
        const positionStart = token.positionStart;
        throw new LexerError.UnterminatedQuotedIdentierError({
            lineNumber,
            ...positionStart
        });
    }

    private static unterminatedStringError(
        lineNumber: number,
        token: LineToken,
    ): LexerError.UnterminatedStringError {
        const positionStart = token.positionStart;
        throw new LexerError.UnterminatedStringError({
            lineNumber,
            ...positionStart
        });
    }

    private static invalidMultilineEndError(foundLineToken: LineToken): CommonError.InvariantError {
        const details = { foundLineToken };
        const message = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message, details);
    }

    private static collectWhile(
        state: LexerState,
        start: NextTokenPosition,
        fn: (token: LineToken) => boolean,
    ): LineTokenCollection {
        const lines: ReadonlyArray<TLexerLine> = state.lines;
        const collectedLineTokens: LineToken[] = [];
        const numLines = lines.length;

        let lineTextOffset = start.lineTextOffset;
        let lineNumber = start.lineNumber;
        let columnNumber = start.columnNumber;

        while (lineNumber < numLines) {
            const line = lines[lineNumber];
            const tokens = line.tokens;
            const numTokens = tokens.length;

            while (columnNumber < numTokens) {
                const lineToken: LineToken = tokens[columnNumber];
                if (!fn(lineToken)) {
                    return {
                        lineTokens: collectedLineTokens,
                        maybeTerminator: {
                            position: {
                                textIndex: lineTextOffset + lineToken.positionStart.textIndex,
                                lineNumber,
                                columnNumber,
                            },
                            token: lineToken,
                        },
                    }
                }

                collectedLineTokens.push(lineToken);
                columnNumber += 1;
            }

            lineNumber += 1;
            lineTextOffset += (line.lineString.text.length + state.lineSeparator.length);
            columnNumber = 0;
        }

        return {
            lineTokens: collectedLineTokens,
            maybeTerminator: undefined,
        };
    }

    private static maybeNextTokenPositionStart(
        state: LexerState,
        lineTextOffset: number,
        lineNumber: number,
        columnNumber: number,
    ): Option<NextTokenPosition> {
        const lines: ReadonlyArray<TLexerLine> = state.lines;
        const line: TLexerLine = lines[lineNumber];
        const tokens: ReadonlyArray<LineToken> = line.tokens;

        const maybeNextColumnNumber = columnNumber + 1;
        if (maybeNextColumnNumber < tokens.length) {
            const nextPositionStart: LexerLinePosition = tokens[columnNumber + 1].positionStart;
            return {
                lineTextOffset,
                lineNumber: line.lineNumber,
                columnNumber: nextPositionStart.columnNumber,
            }
        }
        else {
            const maybeNewLineNumber = lineNumber + 1;
            if (maybeNewLineNumber >= lines.length) {
                return undefined;
            }
            else {
                return {
                    lineTextOffset: lineTextOffset + line.lineString.text.length + state.lineSeparator.length,
                    columnNumber: 0,
                    lineNumber: maybeNewLineNumber,
                }
            }
        }
    }
}

interface LineTokenCollection {
    readonly lineTokens: ReadonlyArray<LineToken>,
    readonly maybeTerminator: Option<LineTokenCollectionTerminator>,
}

interface LineTokenCollectionTerminator {
    readonly position: TokenPosition,
    readonly token: LineToken,
}

interface NextTokenPosition {
    readonly lineTextOffset: number,
    readonly lineNumber: number,
    readonly columnNumber: number,
}
