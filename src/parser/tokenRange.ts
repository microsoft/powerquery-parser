export type TokenRangeMap<T> = { [key: string]: T; }

// keep track of how many tokens and code units make up a TNode in the range of [start, end).
export interface TokenRange {
    readonly tokenStartIndex: number,
    readonly tokenEndIndex: number // exclusive
    readonly documentStartIndex: number,
    readonly documentEndIndex: number, // exclusive
    readonly hash: string,
}

// used as a key in TokenRangeMap.
// tag is needed as some TNodes can have the same range,
// eg. IdentifierExpression without the inclusive modifier '@' has the same
// TokenRange as its Identifier child.
export function tokenRangeHashFrom(
    tag: string,
    tokenStartIndex: number,
    tokenEndIndex: number,
): string {
    return `${tag}:${tokenStartIndex}:${tokenEndIndex}`;
}
