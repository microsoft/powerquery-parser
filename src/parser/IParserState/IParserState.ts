// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { ICancellationToken } from "../../common";
import { Token } from "../../language";
import { LexerSnapshot } from "../../lexer";
import { ILocalizationTemplates } from "../../localization";
import { CommonSettings, ParseSettings } from "../../settings";

export type TCreateParseStateFn<S extends IParserState = IParserState> = (
    settings: ParseSettings<S>,
    lexerSnapshot: LexerSnapshot,
) => S;

export interface IParserState extends CommonSettings {
    readonly lexerSnapshot: LexerSnapshot;
    readonly localizationTemplates: ILocalizationTemplates;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    tokenIndex: number;
    maybeCurrentToken: Token.Token | undefined;
    maybeCurrentTokenKind: Token.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.Node | undefined;
}
