// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { LexerSnapshot } from "../lexer";
import { Locale } from "../localization";
import { DefaultLocale } from "../localization/templates";
import { CombinatorialParser, IParser, IParserState, IParserStateUtils, ParserOptions } from "../parser";

export interface CommonSettings {
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly locale: string;
}

// tslint:disable-next-line: no-empty-interface
export interface LexSettings extends CommonSettings {}

export interface ParseSettings<S extends IParserState = IParserState> extends CommonSettings {
    readonly parser: IParser<S>;
    readonly maybeParserOptions: ParserOptions<S> | undefined;
    readonly parserStateFactory: (
        maybeCancellationToken: ICancellationToken | undefined,
        lexerSnapshot: LexerSnapshot,
        locale?: string,
    ) => S;
}

export type Settings<S extends IParserState = IParserState> = LexSettings & ParseSettings<S>;

export const DefaultSettings: Settings = {
    maybeCancellationToken: undefined,
    locale: DefaultLocale,
    parser: CombinatorialParser,
    maybeParserOptions: undefined,
    parserStateFactory: (
        maybeCancellationToken: ICancellationToken | undefined,
        lexerSnapshot: LexerSnapshot,
        locale?: string,
    ) => IParserStateUtils.stateFactory(maybeCancellationToken, lexerSnapshot, locale ?? Locale.en_US),
};
