// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CombinatorialParserV2, ParseSettings, ParseState, ParseStateUtils } from "./parser";
import { LexerSnapshot, LexSettings } from "./lexer";
import { DefaultLocale } from "./localization";
import { NoOpTraceManagerInstance } from "./common/trace";
import { ParseBehavior } from "./parser/parseBehavior";

export type Settings = LexSettings & ParseSettings;

export const DefaultSettings: Settings = {
    newParseState: (lexerSnapshot: LexerSnapshot, overrides?: Partial<ParseState>) =>
        ParseStateUtils.newState(lexerSnapshot, overrides),
    locale: DefaultLocale,
    cancellationToken: undefined,
    initialCorrelationId: undefined,
    parserEntryPoint: undefined,
    parseBehavior: ParseBehavior.ParseAll,
    parser: CombinatorialParserV2,
    traceManager: NoOpTraceManagerInstance,
};
