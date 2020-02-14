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

export interface ParseSettings<T> extends CommonSettings {
    readonly parser: IParser<T & IParserState>;
    readonly newParserState: (parseSettings: ParseSettings<T>, lexerSnapshot: LexerSnapshot) => T & IParserState;
}

// tslint:disable-next-line: no-empty-interface
export interface InspectionSettings extends CommonSettings {}

export type Settings<T> = LexSettings & ParseSettings<T> & InspectionSettings;

export const DefaultSettings: Settings<IParserState> = {
    parser: Parser.CombinatorialParser,
    newParserState: (parseSettings: ParseSettings<IParserState>, lexerSnapshot: LexerSnapshot) =>
        IParserStateUtils.newState(parseSettings, lexerSnapshot),
    localizationTemplates: DefaultTemplates,
};
