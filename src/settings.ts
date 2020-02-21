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

export interface ParseSettings<S> extends CommonSettings {
    readonly parser: IParser<S & IParserState>;
    readonly newParserState: (parseSettings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S & IParserState;
}

// tslint:disable-next-line: no-empty-interface
export interface InspectionSettings extends CommonSettings {}

export type Settings<S> = LexSettings & ParseSettings<S> & InspectionSettings;

export const DefaultSettings: Settings<IParserState> = {
    parser: Parser.CombinatorialParser,
    newParserState: (parseSettings: ParseSettings<IParserState>, lexerSnapshot: LexerSnapshot) =>
        IParserStateUtils.newState(parseSettings, lexerSnapshot),
    localizationTemplates: DefaultTemplates,
};
