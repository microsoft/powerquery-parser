import { Token } from "./token";

export class LexerSnapshot {
    constructor(
        public readonly document: string,
        public readonly tokens: ReadonlyArray<Token>,
    ) { }
}
