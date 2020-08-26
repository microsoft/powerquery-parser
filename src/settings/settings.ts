// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { LexerSnapshot } from "../lexer";
import { DefaultLocale } from "../localization/templates";
import { IParser, IParserState, IParserStateUtils, Parser } from "../parser";

export interface CommonSettings {
    readonly locale: string;
    readonly maybeCancellationToken: ICancellationToken | undefined;
}

// tslint:disable-next-line: no-empty-interface
export interface LexSettings extends CommonSettings {}

export interface ParseSettings<S extends IParserState = IParserState> extends CommonSettings {
    readonly parser: IParser<S>;
    readonly newParserState: (parseSettings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S;
}

export type Settings<S extends IParserState = IParserState> = LexSettings & ParseSettings<S>;

export const DefaultSettings: Settings = {
    parser: Parser.CombinatorialParser,
    newParserState: (parseSettings: ParseSettings, lexerSnapshot: LexerSnapshot) =>
        IParserStateUtils.newState(parseSettings, lexerSnapshot),
    locale: DefaultLocale,
    maybeCancellationToken: undefined,
};
