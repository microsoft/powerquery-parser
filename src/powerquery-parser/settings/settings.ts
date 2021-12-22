// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ICancellationToken } from "../common";
import { NoOpTraceManager, TraceManager } from "../common/trace";
import { Ast } from "../language";
import { LexerSnapshot } from "../lexer";
import { DefaultLocale } from "../localization";
import { CombinatorialParser, Parser, ParseState, ParseStateUtils } from "../parser";

export interface CommonSettings {
    readonly locale: string;
    readonly maybeCancellationToken: ICancellationToken | undefined;
    readonly traceManager: TraceManager;
}

export type LexSettings = CommonSettings;

export interface ParseSettings extends CommonSettings {
    readonly parser: Parser;
    readonly createParseState: (
        lexerSnapshot: LexerSnapshot,
        maybeOverrides: Partial<ParseState> | undefined,
    ) => ParseState;
    readonly maybeParserEntryPointFn: ((state: ParseState, parser: Parser) => Ast.TNode) | undefined;
}

export type Settings = LexSettings & ParseSettings;

export const DefaultSettings: Settings = {
    createParseState: (lexerSnapshot: LexerSnapshot, maybeOverrides: Partial<ParseState> | undefined) =>
        ParseStateUtils.createState(lexerSnapshot, maybeOverrides),
    locale: DefaultLocale,
    maybeCancellationToken: undefined,
    maybeParserEntryPointFn: undefined,
    parser: CombinatorialParser,
    traceManager: new NoOpTraceManager(),
};
