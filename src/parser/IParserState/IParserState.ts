// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ICancellationToken } from "../../common";
import { Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { Templates } from "../../localization";
import { CommonSettings } from "../../settings";

export interface IParserState extends CommonSettings {
    readonly lexerSnapshot: LexerSnapshot;
    readonly localizationTemplates: Templates.ILocalizationTemplates;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    tokenIndex: number;
    maybeCurrentToken: Token.Token | undefined;
    maybeCurrentTokenKind: Token.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.Node | undefined;
}
