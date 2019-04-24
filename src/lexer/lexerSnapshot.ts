import { TComment, MultilineComment, CommentKind } from "./comment";
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

        let textIndex = 0;
        for (let line of state.lines) {
            const lineTokens: ReadonlyArray<LineToken> = line.tokens;

            for (let lineToken of lineTokens) {
                switch (lineToken.kind) {
                    case LineTokenKind.LineComment:
                        const lineNumber = line.lineNumber;
                        comments.push({
                            kind: CommentKind.Line,
                            containsNewline: true,
                            data: lineToken.data,
                            positionStart: {
                                lineNumber: lineNumber,
                                columnNumber: lineToken.positionStart.columnNumber,
                            },
                            positionEnd: {
                                lineNumber,
                                columnNumber: lineToken.positionEnd.columnNumber,
                            }
                        })
                        break;

                    case LineTokenKind.MultilineCommentStart:
                        comments.push(LexerSnapshot.readMultilineComment(state, line.lineNumber, lineToken));
                        break;

                    case LineTokenKind.QuotedIdentifierStart:
                        throw new Error("not supported");

                    case LineTokenKind.StringLiteralStart:
                        tokens.push(LexerSnapshot.readString(state, line.lineNumber, lineToken));
                        break;

                    default:
                        break;
                }
            }
        }

        this.text = text;
        this.tokens = tokens;
        this.comments = comments;
    }

    private static maybeNextTokenPositionStart(
        lines: ReadonlyArray<TLexerLine>,
        lineNumber: number,
        columnNumber: number,
    ): Option<TokenPosition> {
        const line: TLexerLine = lines[lineNumber];
        const tokens: ReadonlyArray<LineToken> = line.tokens;

        const maybeNextColumnNumber = columnNumber + 1;
        if (maybeNextColumnNumber < tokens.length) {
            const nextPositionStart: LexerLinePosition = tokens[columnNumber + 1].positionStart;
            return {
                lineNumber: line.lineNumber,
                ...nextPositionStart,
            }
        }
        else {
            const maybeNewLineNumber = lineNumber + 1;
            if (maybeNewLineNumber >= lines.length) {
                return undefined;
            }
            else {
                return {
                    columnNumber: 0,
                    lineNumber: maybeNewLineNumber,
                }
            }
        }
    }

    private static readMultilineComment(
        state: LexerState,
        lineNumber: number,
        firstLineToken: LineToken,
    ): MultilineComment {
        const lines = state.lines;
        const columnNumber = firstLineToken.positionStart.columnNumber;
        const maybeNextPosition = LexerSnapshot.maybeNextTokenPositionStart(lines, lineNumber, columnNumber);
        if (!maybeNextPosition) {
            throw new LexerError.LexerError(LexerSnapshot.unterminatedMultilineCommentError(lineNumber, firstLineToken));
        }

        else {
            const collection: LineTokenCollection = LexerSnapshot.collectWhile(
                lines,
                maybeNextPosition,
                (token: LineToken) => token.kind === LineTokenKind.MultilineCommentContent,
            );

            if (!collection.maybeLastLineToken) {
                throw new LexerError.LexerError(LexerSnapshot.unterminatedMultilineCommentError(lineNumber, firstLineToken));
            }

            const lastLineToken: LineToken = collection.maybeLastLineToken;
            if (lastLineToken.kind !== LineTokenKind.MultilineCommentEnd) {
                throw LexerSnapshot.invalidMultilineEndError();
            }

            return {
                kind: CommentKind.Multiline,
                data: [
                    firstLineToken.data,
                    ...collection.lineTokens
                        .map((lineToken: LineToken) => lineToken.data),
                    lastLineToken.data,
                ].join(state.lineSeparator),
                containsNewline: lineNumber !== collection.positionEnd.lineNumber,
                positionStart: {
                    lineNumber,
                    columnNumber: firstLineToken.positionStart.columnNumber,
                },
                positionEnd: {
                    lineNumber: collection.positionEnd.lineNumber,
                    columnNumber: lastLineToken.positionEnd.columnNumber,
                },
            }
        }
    }

    private static readString(
        state: LexerState,
        lineNumber: number,
        firstLineToken: LineToken,
    ): Token {
        const lines = state.lines;
        const columnNumber = firstLineToken.positionStart.columnNumber;
        const maybeNextPosition = LexerSnapshot.maybeNextTokenPositionStart(lines, lineNumber, columnNumber);
        if (!maybeNextPosition) {
            throw new LexerError.LexerError(LexerSnapshot.unterminatedStringError(lineNumber, firstLineToken));
        }

        else {
            const collection: LineTokenCollection = LexerSnapshot.collectWhile(
                lines,
                maybeNextPosition,
                (token: LineToken) => token.kind === LineTokenKind.StringLiteralContent,
            );

            if (!collection.maybeLastLineToken) {
                throw new LexerError.LexerError(LexerSnapshot.unterminatedStringError(lineNumber, firstLineToken));
            }

            const lastLineToken: LineToken = collection.maybeLastLineToken;
            if (lastLineToken.kind !== LineTokenKind.StringLiteralEnd) {
                throw LexerSnapshot.invalidMultilineEndError();
            }

            return {
                kind: TokenKind.StringLiteral,
                data: [
                    firstLineToken.data,
                    ...collection.lineTokens
                        .map((lineToken: LineToken) => lineToken.data),
                    lastLineToken.data,
                ].join(state.lineSeparator),
                positionStart: {
                    lineNumber,
                    columnNumber: firstLineToken.positionStart.columnNumber,
                },
                positionEnd: {
                    lineNumber: collection.positionEnd.lineNumber,
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

    // private static unterminatedQuotedIdentierError(
    //     lineNumber: number,
    //     token: LineToken,
    // ): LexerError.UnterminatedQuotedIdentierError {
    //     const positionStart = token.positionStart;
    //     throw new LexerError.UnterminatedQuotedIdentierError({
    //         lineNumber,
    //         ...positionStart
    //     });
    // }

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

    private static invalidMultilineEndError(): CommonError.InvariantError {
        const message = "once a multiline token starts it should either reach a paired end token, or eof";
        throw new CommonError.InvariantError(message);
    }

    private static collectWhile(
        lines: ReadonlyArray<TLexerLine>,
        position: TokenPosition,
        fn: (token: LineToken) => boolean,
    ): LineTokenCollection {
        let lineNumber = position.lineNumber;
        let columnNumber = position.columnNumber;
        const collectedLineTokens: LineToken[] = [];
        const numLines = lines.length;

        while (lineNumber < numLines) {
            const line = lines[lineNumber];
            const tokens = line.tokens;
            const numTokens = tokens.length;

            while (columnNumber < numTokens) {
                const lineToken: LineToken = tokens[columnNumber];
                if (!fn(lineToken)) {
                    return {
                        lineTokens: collectedLineTokens,
                        maybeLastLineToken: lineToken,
                        positionEnd: {
                            lineNumber,
                            columnNumber,
                        },
                    }
                }

                collectedLineTokens.push(lineToken);
                columnNumber += 1;
            }

            lineNumber += 1;
        }

        return {
            lineTokens: collectedLineTokens,
            maybeLastLineToken: undefined,
            positionEnd: {
                lineNumber,
                columnNumber,
            },
        };
    }
}

interface LineTokenCollection {
    readonly lineTokens: ReadonlyArray<LineToken>,
    readonly maybeLastLineToken: Option<LineToken>,
    readonly positionEnd: TokenPosition,
}
