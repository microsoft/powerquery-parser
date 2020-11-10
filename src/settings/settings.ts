// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { LexerSnapshot } from "../lexer";
import { DefaultLocale } from "../localization";
import {
    CombinatorialParser,
    IParser,
    IParseState,
    IParseStateUtils,
    ParserOptions,
    TParseStateFactoryOverrides,
} from "../parser";

export interface CommonSettings {
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly locale: string;
}

// tslint:disable-next-line: no-empty-interface
export interface LexSettings extends CommonSettings {}

export interface ParseSettings<S extends IParseState = IParseState> extends CommonSettings {
    readonly parser: IParser<S>;
    readonly maybeParserOptions: ParserOptions<S> | undefined;
    readonly parseStateFactory: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: TParseStateFactoryOverrides | undefined,
    ) => S;
}

export type Settings<S extends IParseState = IParseState> = LexSettings & ParseSettings<S>;

export const DefaultSettings: Settings<IParseState> = {
    maybeCancellationToken: undefined,
    locale: DefaultLocale,
    parser: CombinatorialParser,
    maybeParserOptions: undefined,
    parseStateFactory: (lexerSnapshot: LexerSnapshot, maybeOverrides: TParseStateFactoryOverrides | undefined) =>
        IParseStateUtils.stateFactory(lexerSnapshot, maybeOverrides),
};
