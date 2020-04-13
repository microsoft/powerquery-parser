// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { LexerSnapshot } from "../../lexer";
import { ILocalizationTemplates } from "../../localization";
import { Language } from "../..";

export interface IParserState {
    readonly lexerSnapshot: LexerSnapshot;
    readonly localizationTemplates: ILocalizationTemplates;
    tokenIndex: number;
    maybeCurrentToken: Language.Token | undefined;
    maybeCurrentTokenKind: Language.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.Node | undefined;
}
