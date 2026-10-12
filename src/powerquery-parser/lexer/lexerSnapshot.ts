// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Comment, Token } from "../language";
import { StringUtils } from "../common";

export class LexerSnapshot {
    public readonly text: string;
    public readonly tokens: ReadonlyArray<Token.Token>;
    public readonly comments: ReadonlyArray<Comment.TComment>;
    public readonly lineTerminators: ReadonlyArray<LineTerminator>;
    private readonly precedingDirectivesByLineNumber: ReadonlyMap<number, ReadonlyArray<Comment.TDirective>>;
    // Cache the starting line's graphemes for repeated parser position queries.
    private readonly lineGraphemeCache: Map<number, CachedLineGraphemes> = new Map();

    constructor(
        text: string,
        tokens: ReadonlyArray<Token.Token>,
        comments: ReadonlyArray<Comment.TComment>,
        lineTerminators: ReadonlyArray<LineTerminator>,
        precedingDirectivesByLineNumber: ReadonlyMap<
            number,
            ReadonlyArray<Comment.TDirective>
        > = createPrecedingDirectivesByLineNumber(comments),
    ) {
        this.text = text;
        this.tokens = tokens;
        this.comments = comments;
        this.lineTerminators = lineTerminators;
        this.precedingDirectivesByLineNumber = precedingDirectivesByLineNumber;
    }

    public static graphemePositionStartFrom(
        text: string,
        lineTerminators: ReadonlyArray<LineTerminator>,
        token: Token.Token,
    ): StringUtils.GraphemePosition {
        const lineBounds: LineBounds = findLineBounds(text, lineTerminators, token);

        return StringUtils.graphemePositionFrom(
            text.substring(lineBounds.substringPositionStart, lineBounds.substringPositionEnd),
            token.positionStart.lineCodeUnit,
            token.positionStart.lineNumber,
            token.positionStart.codeUnit,
        );
    }

    public graphemePositionStartFrom(token: Token.Token): StringUtils.GraphemePosition {
        const lineBounds: LineBounds = findLineBounds(this.text, this.lineTerminators, token);
        let cached: CachedLineGraphemes | undefined = this.lineGraphemeCache.get(lineBounds.substringPositionStart);

        if (cached === undefined) {
            const lineText: string = this.text.substring(
                lineBounds.substringPositionStart,
                lineBounds.substringPositionEnd,
            );

            const graphemes: ReadonlyArray<string> = StringUtils.graphemeSplitter.splitGraphemes(lineText);
            cached = { lineText, graphemes };
            this.lineGraphemeCache.set(lineBounds.substringPositionStart, cached);
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

interface CachedLineGraphemes {
    readonly lineText: string;
    readonly graphemes: ReadonlyArray<string>;
}

interface LineBounds {
    readonly substringPositionStart: number;
    readonly substringPositionEnd: number;
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

// Includes the line terminator at or after the token's end, matching parser position queries.
function findLineBounds(text: string, lineTerminators: ReadonlyArray<LineTerminator>, token: Token.Token): LineBounds {
    const positionStart: Token.TokenPosition = token.positionStart;
    const positionEnd: Token.TokenPosition = token.positionEnd;

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

    return { substringPositionStart, substringPositionEnd };
}
