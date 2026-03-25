// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TokenPosition } from "./token";

export type TComment = LineComment | MultilineComment;
export type TDirective = TypeDirective;

export enum CommentKind {
    Line = "Line",
    Multiline = "Multiline",
}

export enum DirectiveKind {
    Type = "Type",
}

export interface IComment {
    readonly kind: CommentKind;
    readonly data: string;
    readonly containsNewline: boolean;
    readonly positionStart: TokenPosition;
    readonly positionEnd: TokenPosition;
}

export interface LineComment extends IComment {
    readonly kind: CommentKind.Line;
}

export interface MultilineComment extends IComment {
    readonly kind: CommentKind.Multiline;
}

export interface IDirective<Kind extends DirectiveKind> {
    readonly kind: Kind;
    readonly value: string;
    readonly comment: LineComment;
}

export type TypeDirective = IDirective<DirectiveKind.Type>;
