// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CombinatorialParser, Parser, ParseState, ParseStateUtils } from "../parser";
import { NoOpTraceManager, TraceManager } from "../common/trace";
import { Ast } from "../language";
import { DefaultLocale } from "../localization";
import { ICancellationToken } from "../common";
import { LexerSnapshot } from "../lexer";

export interface CommonSettings {
    readonly locale: string;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly maybeInitialCorrelationId: number | undefined;
    readonly traceManager: TraceManager;
}

export type LexSettings = CommonSettings;

export interface ParseSettings extends CommonSettings {
    readonly parser: Parser;
    readonly createParseState: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: Partial<ParseState> | undefined,
    ) => ParseState;
    readonly maybeParserEntryPointFn:
        | ((state: ParseState, parser: Parser, maybeCorrelationId: number | undefined) => Promise<Ast.TNode>)
        | undefined;
}

export type Settings = LexSettings & ParseSettings;

export const DefaultSettings: Settings = {
    createParseState: (lexerSnapshot: LexerSnapshot, maybeOverrides: Partial<ParseState> | undefined) =>
        ParseStateUtils.createState(lexerSnapshot, maybeOverrides),
    locale: DefaultLocale,
    maybeCancellationToken: undefined,
    maybeInitialCorrelationId: undefined,
    maybeParserEntryPointFn: undefined,
    parser: CombinatorialParser,
    traceManager: new NoOpTraceManager(),
};
