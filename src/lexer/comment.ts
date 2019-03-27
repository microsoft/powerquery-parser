export type TComment = (
    | LineComment
    | MultilineComment
)

export const enum CommentKind {
    Line = "Line",
    Multiline = "Multiline",
}

export interface IComment {
    readonly kind: CommentKind,
    readonly literal: string,
    readonly containsNewline: boolean,
    readonly phantomTokenIndex: number,
    readonly documentStartIndex: number,
    readonly documentEndIndex: number,
}

export interface LineComment extends IComment {
    readonly kind: CommentKind.Line;
    readonly containsNewline: true,
}

export interface MultilineComment extends IComment {
    readonly kind: CommentKind.Multiline;
}
