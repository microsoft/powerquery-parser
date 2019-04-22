import { CommonError, Option } from "../common";
import { TComment } from "./comment";
import { LexerError } from "./error";
import { LexerState } from "./lexerContracts";
import { LexerLinePosition, LineToken, LineTokenKind, Token, tokenKindFrom, TokenKind } from "./token";

export class LexerSnapshot {
    public readonly text: string;
    public readonly tokens: ReadonlyArray<Token>;
    public readonly comments: ReadonlyArray<TComment>;

    constructor(lexerState: LexerState) {
        // class properties
        const tokens: Token[] = [];
        const comments: TComment[] = [];
        let text = "";

        let flatLineTokens: FlatLineToken[] = [];
        let flatIndex = 0;
        for (let line of lexerState.lines) {
            const tokensOnLine: ReadonlyArray<LineToken> = line.tokens;
            const numTokensOnLine: number = tokensOnLine.length;

            for (let tokenIndex = 0; tokenIndex < numTokensOnLine; tokenIndex += 1) {
                flatLineTokens.push({
                    lineNumber: line.lineNumber,
                    flatIndex,
                    token: tokensOnLine[tokenIndex],
                })
                flatIndex += 1;
            }
        }

        let flatLineTokenIndex = 0;
        const numTokens = flatLineTokens.length;
        while (flatLineTokenIndex < numTokens) {
            const flatLineToken: FlatLineToken = flatLineTokens[flatLineTokenIndex];
            const lineTokenKind: LineTokenKind = flatLineToken.token.kind;

            switch (lineTokenKind) {

                case LineTokenKind.MultilineCommentStart: {
                    const concatenation = LexerSnapshot.readMultilineComment(flatLineTokens, flatLineToken);
                    tokens.push(concatenation.token);
                    flatLineTokenIndex = concatenation.flatLineTokenIndexEnd + 1;
                    break;
                }

                case LineTokenKind.QuotedIdentifierStart: {
                    const concatenation = LexerSnapshot.readQuotedIdentifier(flatLineTokens, flatLineToken);
                    tokens.push(concatenation.token);
                    flatLineTokenIndex = concatenation.flatLineTokenIndexEnd + 1;
                    break;
                }

                case LineTokenKind.StringLiteralStart: {
                    const concatenation = LexerSnapshot.readStringLiteral(flatLineTokens, flatLineToken);
                    tokens.push(concatenation.token);
                    flatLineTokenIndex = concatenation.flatLineTokenIndexEnd + 1;
                    break;
                }

                default:
                    const lineToken = flatLineToken.token;
                    tokens.push({
                        kind: tokenKindFrom(flatLineToken.token.kind),
                        data: flatLineToken.token.data,
                        positionStart: {
                            lineNumber: flatLineToken.lineNumber,
                            ...lineToken.positionStart
                        },
                        positionEnd: {
                            lineNumber: flatLineToken.lineNumber,
                            ...lineToken.positionEnd
                        },
                    });
                    flatLineTokenIndex += 1;
            }
        }

        this.text = text;
        this.tokens = tokens;
        this.comments = comments;
    }

    private static readMultilineComment(
        flatLineTokens: ReadonlyArray<FlatLineToken>,
        flatLineTokenStart: FlatLineToken,
    ): TokenConcatenation {
        const maybeTokenConcatenation: Option<TokenConcatenation> = LexerSnapshot.maybeReadConcatenatedToken(
            flatLineTokens,
            flatLineTokenStart,
            TokenKind.MultilineComment,
            LineTokenKind.MultilineCommentContent,
            LineTokenKind.MultilineCommentEnd,
        )
        if (maybeTokenConcatenation) {
            return maybeTokenConcatenation;
        }
        else {
            const positionStart = flatLineTokenStart.token.positionStart;
            throw new LexerError.UnterminatedMultilineCommentError({
                lineNumber: flatLineTokenStart.lineNumber,
                ...positionStart
            });
        }
    }

    private static readQuotedIdentifier(
        flatLineTokens: ReadonlyArray<FlatLineToken>,
        flatLineTokenStart: FlatLineToken,
    ): TokenConcatenation {
        const maybeTokenConcatenation: Option<TokenConcatenation> = LexerSnapshot.maybeReadConcatenatedToken(
            flatLineTokens,
            flatLineTokenStart,
            TokenKind.Identifier,
            LineTokenKind.QuotedIdentifierContent,
            LineTokenKind.QuotedIdentifierEnd,
        )
        if (maybeTokenConcatenation) {
            return maybeTokenConcatenation;
        }
        else {
            const positionStart = flatLineTokenStart.token.positionStart;
            throw new LexerError.UnterminatedStringError({
                lineNumber: flatLineTokenStart.lineNumber,
                ...positionStart
            });
        }
    }

    private static readStringLiteral(
        flatLineTokens: ReadonlyArray<FlatLineToken>,
        flatLineTokenStart: FlatLineToken,
    ): TokenConcatenation {
        const maybeTokenConcatenation: Option<TokenConcatenation> = LexerSnapshot.maybeReadConcatenatedToken(
            flatLineTokens,
            flatLineTokenStart,
            TokenKind.StringLiteral,
            LineTokenKind.StringLiteralContent,
            LineTokenKind.StringLiteralEnd,
        )
        if (maybeTokenConcatenation) {
            return maybeTokenConcatenation;
        }
        else {
            const positionStart = flatLineTokenStart.token.positionStart;
            throw new LexerError.UnterminatedStringError({
                lineNumber: flatLineTokenStart.lineNumber,
                ...positionStart
            });
        }
    }

    private static maybeReadConcatenatedToken(
        flatLineTokens: ReadonlyArray<FlatLineToken>,
        flatLineTokenStart: FlatLineToken,
        newTokenKind: TokenKind,
        contentLineTokenKind: LineTokenKind,
        endLineTokenKind: LineTokenKind,
    ): Option<TokenConcatenation> {
        const lineTokenStart = flatLineTokenStart.token;
        const numTokens = flatLineTokens.length;

        let concatenatedData = lineTokenStart.data;
        let flatLineTokenIndex = flatLineTokenStart.flatIndex + 1;
        while (flatLineTokenIndex < numTokens) {
            const flatLineToken = flatLineTokens[flatLineTokenIndex];
            const lineToken = flatLineToken.token;

            if (lineToken.kind === contentLineTokenKind) {
                concatenatedData += lineToken.data;
            }
            else if (lineToken.kind === endLineTokenKind) {
                const linePositionEnd: LexerLinePosition = lineToken.positionEnd;
                concatenatedData += lineToken.data;

                return {
                    token: {
                        kind: newTokenKind,
                        data: concatenatedData,
                        positionStart: {
                            lineNumber: flatLineTokenStart.lineNumber,
                            ...lineTokenStart.positionStart
                        },
                        positionEnd: {
                            lineNumber: flatLineToken.lineNumber,
                            ...linePositionEnd
                        },
                    },
                    flatLineTokenIndexEnd: flatLineTokenIndex,
                }
            }
            else {
                const message = "once a multiline token starts it should either reach a paired end token, or eof";
                const details = {
                    flatLineTokenStart,
                    flatLineToken: flatLineToken,
                    concatenatedData,
                };
                throw new CommonError.InvariantError(message, details);
            }

            flatLineTokenIndex += 1;
        }

        return undefined;
    }
}

interface FlatLineToken {
    readonly lineNumber: number,
    readonly flatIndex: number,
    readonly token: LineToken,
}

interface TokenConcatenation {
    readonly flatLineTokenIndexEnd: number,
    readonly token: Token,
}
