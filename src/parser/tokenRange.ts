import { GraphemeDocumentPosition } from "../lexer";

export type TokenRangeMap<T> = { [key: string]: T; }

// keep track of how many tokens and code units make up a TNode in the range of [start, end).
export interface TokenRange {
    readonly startTokenIndex: number,
    readonly endTokenIndex: number // exclusive
    readonly startPosition: GraphemeDocumentPosition,
    readonly endPosition: GraphemeDocumentPosition,
    readonly hash: string,
}

// used as a key in TokenRangeMap.
// tag is needed as some TNodes can have the same range,
// eg. an IdentifierExpression without the inclusive modifier '@'
// has the same TokenRange as its child, Identifier.
export function tokenRangeHashFrom(
    tag: string,
    startPosition: GraphemeDocumentPosition,
    endPosition: GraphemeDocumentPosition,
): string {
    return `${tag}:${startPosition.lineNumber},${startPosition.columnNumber}:${endPosition.lineNumber},${endPosition.columnNumber}`;
}
