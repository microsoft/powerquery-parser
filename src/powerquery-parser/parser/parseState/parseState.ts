// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ICancellationToken } from "../../common";
import { TraceManager } from "../../common/trace";
import { Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { Disambiguation } from "../disambiguation";

export interface ParseState {
    readonly disambiguationBehavior: Disambiguation.DismabiguationBehavior;
    readonly lexerSnapshot: LexerSnapshot;
    readonly locale: string;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly traceManager: TraceManager;
    contextState: ParseContext.State;
    maybeCurrentToken: Token.Token | undefined;
    maybeCurrentContextNode: ParseContext.TNode | undefined;
    maybeCurrentTokenKind: Token.TokenKind | undefined;
    tokenIndex: number;
}
