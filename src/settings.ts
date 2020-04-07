// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LexerSnapshot } from "./lexer";
import { DefaultTemplates, ILocalizationTemplates } from "./localization";
import { IParser, IParserState, IParserStateUtils, Parser } from "./parser";

export interface CommonSettings {
    readonly localizationTemplates: ILocalizationTemplates;
}

// tslint:disable-next-line: no-empty-interface
export interface LexSettings extends CommonSettings {}

export interface ParseSettings<S = IParserState> extends CommonSettings {
    readonly parser: IParser<S & IParserState>;
    readonly newParserState: (parseSettings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S & IParserState;
}

export type Settings<S = IParserState> = LexSettings & ParseSettings<S>;

export const DefaultSettings: Settings = {
    parser: Parser.CombinatorialParser,
    newParserState: (parseSettings: ParseSettings, lexerSnapshot: LexerSnapshot) =>
        IParserStateUtils.newState(parseSettings, lexerSnapshot),
    localizationTemplates: DefaultTemplates,
};
