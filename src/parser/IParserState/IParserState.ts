// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParserContext } from "..";
import { Option } from "../../common";
import { LexerSnapshot, Token, TokenKind } from "../../lexer";
import { ILocalizationTemplates } from "../../localization";

export interface IParserState {
    readonly lexerSnapshot: LexerSnapshot;
    readonly localizationTemplates: ILocalizationTemplates;
    tokenIndex: number;
    maybeCurrentToken: Option<Token>;
    maybeCurrentTokenKind: Option<TokenKind>;
    contextState: ParserContext.State;
    maybeCurrentContextNode: Option<ParserContext.Node>;
}
