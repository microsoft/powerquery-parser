// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseContext } from "..";
import { Language } from "../..";
import { ICancellationToken } from "../../common";
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
    maybeCurrentToken: Language.Token | undefined;
    maybeCurrentTokenKind: Language.TokenKind | undefined;
    contextState: ParseContext.State;
    maybeCurrentContextNode: ParseContext.Node | undefined;
}
