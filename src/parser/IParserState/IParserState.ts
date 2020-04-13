// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { Language } from "../..";
import { LexerSnapshot } from "../../lexer";
import { ILocalizationTemplates } from "../../localization";

export interface IParserState {
    readonly lexerSnapshot: LexerSnapshot;
    readonly localizationTemplates: ILocalizationTemplates;
    tokenIndex: number;
    maybeCurrentToken: Language.Token | undefined;
    maybeCurrentTokenKind: Language.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.Node | undefined;
}
