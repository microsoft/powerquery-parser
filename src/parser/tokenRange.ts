// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { StringHelpers } from "../common";

export type TokenRangeMap<T> = { [key: string]: T; }

// keep track of how many tokens and code units make up a TNode in the range of [start, end).
export interface TokenRange {
    readonly startTokenIndex: number,
    readonly endTokenIndex: number // exclusive
    readonly positionStart: StringHelpers.GraphemePosition,
    readonly positionEnd: StringHelpers.GraphemePosition,
    readonly hash: string,
}

// used as a key in TokenRangeMap.
// tag is needed as some TNodes can have the same range,
// eg. an IdentifierExpression without the inclusive modifier '@'
// has the same TokenRange as its child, Identifier.
export function tokenRangeHashFrom(
    tag: string,
    positionStart: StringHelpers.GraphemePosition,
    positionEnd: StringHelpers.GraphemePosition,
): string {
    return `${tag}:${positionStart.lineNumber},${positionStart.columnNumber}:${positionEnd.lineNumber},${positionEnd.columnNumber}`;
}
