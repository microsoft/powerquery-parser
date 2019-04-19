import { StringHelpers } from "../common";
import { Token } from "./token";

export class LexerSnapshot {
    constructor(
        public readonly document: string,
        public readonly tokens: ReadonlyArray<Token>,
    ) { }

    public tokenPosition(token: Token): TokenPosition {
        const graphemePosition = StringHelpers.graphemePositionAt(this.document, token.positionStart.documentIndex);
        return {
            token,
            ...graphemePosition
        };
    }
}

export interface TokenPosition extends StringHelpers.GraphemePosition {
    readonly token: Token,
}
