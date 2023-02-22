// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CombinatorialParser, ParseSettings, ParseState, ParseStateUtils } from "./parser";
import { LexerSnapshot, LexSettings } from "./lexer";
import { DefaultLocale } from "./localization";
import { NoOpTraceManagerInstance } from "./common/trace";

export type Settings = LexSettings & ParseSettings;

export const DefaultSettings: Settings = {
    newParseState: (lexerSnapshot: LexerSnapshot, overrides: Partial<ParseState> | undefined) =>
        ParseStateUtils.newState(lexerSnapshot, overrides),
    locale: DefaultLocale,
    cancellationToken: undefined,
    initialCorrelationId: undefined,
    parserEntryPoint: undefined,
    parser: CombinatorialParser,
    traceManager: NoOpTraceManagerInstance,
};
