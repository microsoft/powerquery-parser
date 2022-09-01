// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Disambiguation } from "../disambiguation";
import { ICancellationToken } from "../../common";
import { LexerSnapshot } from "../../lexer";
import { ParseContext } from "..";
import { Token } from "../../language";
import { TraceManager } from "../../common/trace";

export interface ParseState {
    readonly cancellationToken: ICancellationToken | undefined;
    readonly disambiguationBehavior: Disambiguation.DismabiguationBehavior;
    readonly lexerSnapshot: LexerSnapshot;
    readonly locale: string;
    readonly traceManager: TraceManager;
    contextState: ParseContext.State;
    currentContextNode: ParseContext.TNode | undefined;
    currentToken: Token.Token | undefined;
    currentTokenKind: Token.TokenKind | undefined;
    tokenIndex: number;
}
