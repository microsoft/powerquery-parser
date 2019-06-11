// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { TokenPosition } from "../lexer";

export type TokenRangeMap<T> = Map<string, T>;

// keep track of how many tokens and code units make up a TNode in the range of [start, end).
export interface TokenRange {
    readonly tokenIndexStart: number;
    readonly tokenIndexEnd: number; // exclusive
    readonly positionStart: TokenPosition;
    readonly positionEnd: TokenPosition;
    readonly hash: string;
}

// used as a key in TokenRangeMap.
// tag is needed as some TNodes can have the same range,
// eg. an IdentifierExpression without the inclusive modifier '@'
// has the same TokenRange as its child, Identifier.
export function tokenRangeHashFrom(tag: string, positionStart: TokenPosition, positionEnd: TokenPosition): string {
    return `${tag}:${positionStart.lineNumber},${positionStart.lineCodeUnit}:${positionEnd.lineNumber},${
        positionEnd.lineCodeUnit
    }`;
}
