// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TokenPosition } from "../lexer";

export type TokenRangeMap<T> = Map<string, T>;

// The [start, end) range of a Ast.TNode.
export interface TokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number; // exclusive
    readonly positionStart: TokenPosition;
    readonly positionEnd: TokenPosition;
    readonly hash: string;
}

// Generates a key for TokenRangeMap.
// `tag` is needed as some TNodes can have the same range,
// eg. an IdentifierExpression without the inclusive modifier '@' has the same TokenRange as its child, Identifier.
export function tokenRangeHashFrom(tag: string, positionStart: TokenPosition, positionEnd: TokenPosition): string {
    return `${tag}:${positionStart.lineNumber},${positionStart.lineCodeUnit}:${positionEnd.lineNumber},${
        positionEnd.lineCodeUnit
    }`;
}
