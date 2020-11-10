// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ICancellationToken } from "../../common";
import { Token } from "../../language";
import { LexerSnapshot } from "../../lexer";

export type TParseStateFactoryOverrides = Partial<
    Omit<IParseState, "lexerSnapshot" | "maybeCurrentToken" | "maybeCurrentTokenKind" | "maybeCurrentContextNode">
>;

export interface IParseState {
    readonly lexerSnapshot: LexerSnapshot;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly locale: string;
    tokenIndex: number;
    maybeCurrentToken: Token.Token | undefined;
    maybeCurrentTokenKind: Token.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.Node | undefined;
}