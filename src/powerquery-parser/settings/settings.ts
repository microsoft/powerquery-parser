// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { Ast } from "../language";
import { LexerSnapshot } from "../lexer";
import { DefaultLocale } from "../localization";
import { CombinatorialParser, IParser, IParseState, IParseStateUtils } from "../parser";

export interface CommonSettings {
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly locale: string;
}

export type LexSettings = CommonSettings;

export interface ParseSettings extends CommonSettings {
    readonly parser: IParser;
    readonly createParseState: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: Partial<IParseState> | undefined,
    ) => IParseState;
    readonly maybeParserEntryPointFn: ((state: IParseState, parser: IParser) => Ast.TNode) | undefined;
}

export type Settings = LexSettings & ParseSettings;

export const DefaultSettings: Settings = {
    maybeCancellationToken: undefined,
    locale: DefaultLocale,
    parser: CombinatorialParser,
    createParseState: (lexerSnapshot: LexerSnapshot, maybeOverrides: Partial<IParseState> | undefined) =>
        IParseStateUtils.createState(lexerSnapshot, maybeOverrides),
    maybeParserEntryPointFn: undefined,
};
