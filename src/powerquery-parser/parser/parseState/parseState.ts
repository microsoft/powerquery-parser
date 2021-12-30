// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Disambiguation } from "../disambiguation";
import { ICancellationToken } from "../../common";
import { LexerSnapshot } from "../../lexer";
import { ParseContext } from "..";
import { Token } from "../../language";
import { TraceManager } from "../../common/trace";

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
