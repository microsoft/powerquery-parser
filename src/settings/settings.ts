// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../powerquery-parser/common";
import { Ast } from "../powerquery-parser/language";
import { LexerSnapshot } from "../powerquery-parser/lexer";
import { DefaultLocale } from "../powerquery-parser/localization";
import { CombinatorialParser, IParser, IParseState, IParseStateUtils, TParseStateFactoryOverrides } from "../powerquery-parser/parser";

export interface CommonSettings {
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly locale: string;
}

export type LexSettings = CommonSettings;

export interface ParseSettings<S extends IParseState = IParseState> extends CommonSettings {
    readonly parser: IParser<S>;
    readonly parseStateFactory: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: TParseStateFactoryOverrides<S> | undefined,
    ) => S;
    readonly maybeParserEntryPointFn: ((state: S, parser: IParser<S>) => Ast.TNode) | undefined;
}

export type Settings<S extends IParseState = IParseState> = LexSettings & ParseSettings<S>;

export const DefaultSettings: Settings<IParseState> = {
    maybeCancellationToken: undefined,
    locale: DefaultLocale,
    parser: CombinatorialParser,
    parseStateFactory: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: TParseStateFactoryOverrides<IParseState> | undefined,
    ) => IParseStateUtils.stateFactory(lexerSnapshot, maybeOverrides),
    maybeParserEntryPointFn: undefined,
};
