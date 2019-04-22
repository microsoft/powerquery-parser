import { TComment } from "./comment";
import { LexerState, TLexerLine } from "./lexerContracts";
import { LineTokenKind, Token, tokenKindFrom, LineToken } from "./token";

export class LexerSnapshot {
    public readonly text: string;
    public readonly tokens: ReadonlyArray<Token>;
    public readonly comments: ReadonlyArray<TComment>;

    constructor(lexerState: LexerState) {
        const tokens: Token[] = [];
        const comments: TComment[] = [];
        const lines: ReadonlyArray<TLexerLine> = lexerState.lines;
        const numLines = lines.length;

        let lineIndex = 0;
        let text = "";

        while (lineIndex < numLines) {
            const currentLine: TLexerLine = lines[lineIndex];
            const tokensOnLine: ReadonlyArray<LineToken> = currentLine.tokens;
            const numTokensOnLine: number = tokensOnLine.length;

            let tokenIndex = 0;
            while (tokenIndex < numTokensOnLine) {
                const token: LineToken = tokensOnLine[tokenIndex];

                switch (token.kind) {
                    case LineTokenKind.MultilineCommentStart:
                    case LineTokenKind.QuotedIdentifierStart:
                    case LineTokenKind.StringLiteralStart:
                        throw new Error("todo");

                    default:
                        tokens.push({
                            ...token,
                            kind: tokenKindFrom(token.kind),
                            positionStart: {
                                lineNumber: currentLine.lineNumber,
                                ...token.positionStart,
                            },
                            positionEnd: {
                                lineNumber: currentLine.lineNumber,
                                ...token.positionEnd,
                            },
                        })
                }

                tokenIndex += 1;
            }

            lineIndex += 1;
        }

        this.text = text;
        this.tokens = tokens;
        this.comments = comments;
    }
}
