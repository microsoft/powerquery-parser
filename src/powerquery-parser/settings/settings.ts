// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { Ast } from "../language";
import { LexerSnapshot } from "../lexer";
import { DefaultLocale } from "../localization";
import { CombinatorialParser, IParser, IParseState, IParseStateUtils, TCreateParseStateOverrides } from "../parser";

export interface CommonSettings {
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly locale: string;
}

export type LexSettings = CommonSettings;

export interface ParseSettings<S extends IParseState = IParseState> extends CommonSettings {
    readonly parser: IParser<S>;
    readonly createParseState: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: TCreateParseStateOverrides<S> | undefined,
    ) => S;
    readonly maybeParserEntryPointFn: ((state: S, parser: IParser<S>) => Ast.TNode) | undefined;
}

export type Settings<S extends IParseState = IParseState> = LexSettings & ParseSettings<S>;

export const DefaultSettings: Settings<IParseState> = {
    maybeCancellationToken: undefined,
    locale: DefaultLocale,
    parser: CombinatorialParser,
    createParseState: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: TCreateParseStateOverrides<IParseState> | undefined,
    ) => IParseStateUtils.createState(lexerSnapshot, maybeOverrides),
    maybeParserEntryPointFn: undefined,
};
