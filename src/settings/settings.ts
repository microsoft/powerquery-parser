// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { LexerSnapshot } from "../lexer";
import { DefaultLocale } from "../localization";
import {
    CombinatorialParser,
    IParser,
    IParserState,
    IParserStateUtils,
    ParserOptions,
    TParserStateFactoryOverrides,
} from "../parser";

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
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: TParserStateFactoryOverrides | undefined,
    ) => S;
}

export type Settings<S extends IParserState = IParserState> = LexSettings & ParseSettings<S>;

export const DefaultSettings: Settings<IParserState> = {
    maybeCancellationToken: undefined,
    locale: DefaultLocale,
    parser: CombinatorialParser,
    maybeParserOptions: undefined,
    parserStateFactory: (lexerSnapshot: LexerSnapshot, maybeOverrides: TParserStateFactoryOverrides | undefined) =>
        IParserStateUtils.stateFactory(lexerSnapshot, maybeOverrides),
};
