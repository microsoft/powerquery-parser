// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultTemplates, ILocalizationTemplates } from "./localization";
import { IParser, IParserState, Parser } from "./parser";

export interface CommonSettings {
    readonly localizationTemplates: ILocalizationTemplates;
}

// tslint:disable-next-line: no-empty-interface
export interface LexSettings extends CommonSettings {}

export interface ParseSettings extends CommonSettings {
    readonly parser: IParser<IParserState>;
}

// tslint:disable-next-line: no-empty-interface
export interface InspectionSettings extends CommonSettings {}

export type Settings = LexSettings & ParseSettings & InspectionSettings;

export const DefaultSettings: Settings = {
    parser: Parser.CombinatorialParser,
    localizationTemplates: DefaultTemplates,
};
