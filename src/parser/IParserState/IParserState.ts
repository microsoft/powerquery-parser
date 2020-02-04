// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParserContext } from "..";
import { LexerSnapshot, Token, TokenKind } from "../../lexer";
import { ILocalizationTemplates } from "../../localization";

export interface IParserState {
    readonly lexerSnapshot: LexerSnapshot;
    readonly localizationTemplates: ILocalizationTemplates;
    tokenIndex: number;
    maybeCurrentToken: Token | undefined;
    maybeCurrentTokenKind: TokenKind | undefined;
    contextState: ParserContext.State;
    maybeCurrentContextNode: ParserContext.Node | undefined;
}
