// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { StringHelpers } from "../common";

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
    readonly data: string,
    readonly containsNewline: boolean,
    readonly positionStart: StringHelpers.GraphemePosition,
    readonly positionEnd: StringHelpers.GraphemePosition,
}

export interface LineComment extends IComment {
    readonly kind: CommentKind.Line,
}

export interface MultilineComment extends IComment {
    readonly kind: CommentKind.Multiline,
}
