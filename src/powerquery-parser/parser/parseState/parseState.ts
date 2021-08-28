// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ICancellationToken } from "../../common";
import { Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { Disambiguation } from "../disambiguation";

export interface ParseState {
    readonly lexerSnapshot: LexerSnapshot;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly locale: string;
    readonly disambiguationBehavior: Disambiguation.DismabiguationBehavior;
    tokenIndex: number;
    maybeCurrentToken: Token.Token | undefined;
    maybeCurrentTokenKind: Token.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.TNode | undefined;
}
