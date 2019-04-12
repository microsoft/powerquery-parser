import { StringHelpers } from "../common";
import { TComment } from "./comment";
import { Token } from "./token";

export class LexerSnapshot {
    constructor(
        public readonly document: string,
        public readonly tokens: ReadonlyArray<Token>,
        public readonly comments: ReadonlyArray<TComment>,
    ) { }

    public tokenPosition(token: Token): TokenPosition {
        const graphemePosition = StringHelpers.graphemePositionAt(this.document, token.documentStartIndex);
        return {
            token,
            ...graphemePosition
        };
    }
}

export interface TokenPosition extends StringHelpers.GraphemePosition {
    readonly token: Token,
}
