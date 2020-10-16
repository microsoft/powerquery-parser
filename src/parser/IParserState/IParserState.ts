// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ICancellationToken } from "../../common";
import { Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { Templates } from "../../localization";

export interface IParserState {
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly lexerSnapshot: LexerSnapshot;
    readonly localizationTemplates: Templates.ILocalizationTemplates;
    tokenIndex: number;
    maybeCurrentToken: Token.Token | undefined;
    maybeCurrentTokenKind: Token.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.Node | undefined;
}
