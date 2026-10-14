// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, StringUtils } from "../common";
import { Comment, Token } from "../language";

export class LexerSnapshot {
    public readonly text: string;
    public readonly tokens: ReadonlyArray<Token.Token>;
    public readonly comments: ReadonlyArray<Comment.TComment>;
    public readonly lineTerminators: ReadonlyArray<LineTerminator>;
    private readonly precedingDirectivesByLineNumber: ReadonlyMap<number, ReadonlyArray<Comment.TDirective>>;
    // Only the starting line's graphemes are needed, even for multiline tokens.
    private readonly lineGraphemeCache: Map<number, CachedLineGraphemes> = new Map();

    constructor(
        text: string,
        tokens: ReadonlyArray<Token.Token>,
        comments: ReadonlyArray<Comment.TComment>,
        lineTerminators: ReadonlyArray<LineTerminator>,
    ) {
        this.text = text;
        this.tokens = tokens;
        this.comments = comments;
        this.lineTerminators = lineTerminators;
        this.precedingDirectivesByLineNumber = createPrecedingDirectivesByLineNumber(comments);
    }

    public static graphemePositionStartFrom(
        text: string,
        lineTerminators: ReadonlyArray<LineTerminator>,
        token: Token.Token,
    ): StringUtils.GraphemePosition {
        return StringUtils.graphemePositionFrom(
            lineTextFrom(text, lineTerminators, token.positionStart),
            token.positionStart.lineCodeUnit,
            token.positionStart.lineNumber,
            token.positionStart.codeUnit,
        );
    }

    public graphemePositionStartFrom(token: Token.Token): StringUtils.GraphemePosition {
        const lineNumber: number = token.positionStart.lineNumber;
        let cached: CachedLineGraphemes | undefined = this.lineGraphemeCache.get(lineNumber);

        if (cached === undefined) {
            const lineText: string = lineTextFrom(this.text, this.lineTerminators, token.positionStart);

            const graphemes: ReadonlyArray<string> = StringUtils.graphemeSplitter.splitGraphemes(lineText);
            cached = { lineText, graphemes };
            this.lineGraphemeCache.set(lineNumber, cached);
        }

        return {
            lineCodeUnit: token.positionStart.lineCodeUnit,
            lineNumber: token.positionStart.lineNumber,
            columnNumber: StringUtils.columnNumberFromGraphemes(
                cached.graphemes,
                cached.lineText,
                token.positionStart.lineCodeUnit,
            ),
            codeUnit: token.positionStart.codeUnit,
        };
    }

    public columnNumberStartFrom(token: Token.Token): number {
        return this.graphemePositionStartFrom(token).columnNumber;
    }

    public getPrecedingDirectives(lineNumber: number): ReadonlyArray<Comment.TDirective> | undefined {
        return this.precedingDirectivesByLineNumber.get(lineNumber);
    }
}

export interface LineTerminator {
    readonly codeUnit: number;
    readonly text: string;
}

function createPrecedingDirectivesByLineNumber(
    comments: ReadonlyArray<Comment.TComment>,
): ReadonlyMap<number, ReadonlyArray<Comment.TDirective>> {
    const precedingDirectivesByLineNumber: Map<number, ReadonlyArray<Comment.TDirective>> = new Map();

    for (const comment of comments) {
        if (comment.kind !== Comment.CommentKind.Line || comment.directive === undefined) {
            continue;
        }

        const lineNumber: number = comment.positionStart.lineNumber;

        const previousDirectives: ReadonlyArray<Comment.TDirective> | undefined =
            precedingDirectivesByLineNumber.get(lineNumber);

        precedingDirectivesByLineNumber.set(
            lineNumber + 1,
            previousDirectives ? [...previousDirectives, comment.directive] : [comment.directive],
        );
    }

    return precedingDirectivesByLineNumber;
}

interface CachedLineGraphemes {
    readonly lineText: string;
    readonly graphemes: ReadonlyArray<string>;
}

function lineTextFrom(
    text: string,
    lineTerminators: ReadonlyArray<LineTerminator>,
    position: Token.TokenPosition,
): string {
    const lineTerminator: LineTerminator = ArrayUtils.assertGet(lineTerminators, position.lineNumber);

    return text.substring(
        position.codeUnit - position.lineCodeUnit,
        lineTerminator.codeUnit + lineTerminator.text.length,
    );
}
