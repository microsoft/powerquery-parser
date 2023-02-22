// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CombinatorialParser, Parser, ParseState, ParseStateUtils } from "../parser";
import { NoOpTraceManagerInstance, TraceManager } from "../common/trace";
import { Ast } from ".";
import { DefaultLocale } from "../localization";
import { ICancellationToken } from "../common";
import { LexerSnapshot } from "../lexer";

export interface CommonSettings {
    readonly cancellationToken: ICancellationToken | undefined;
    readonly initialCorrelationId: number | undefined;
    readonly locale: string;
    readonly traceManager: TraceManager;
}

export type LexSettings = CommonSettings;

export interface ParseSettings extends CommonSettings {
    readonly parser: Parser;
    readonly newParseState: (lexerSnapshot: LexerSnapshot, overrides: Partial<ParseState> | undefined) => ParseState;
    readonly parserEntryPoint:
        | ((state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<Ast.TNode>)
        | undefined;
}

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
