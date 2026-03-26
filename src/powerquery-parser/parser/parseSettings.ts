// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../language";
import { CommonSettings } from "../common";
import { LexerSnapshot } from "../lexer";
import { ParseBehavior } from "./parseBehavior";
import { Parser } from "./parser";
import { ParseState } from "./parseState";

export interface ParseSettings extends CommonSettings {
    readonly parseBehavior: ParseBehavior;
    readonly parser: Parser;
    readonly newParseState: (lexerSnapshot: LexerSnapshot, overrides?: Partial<ParseState>) => ParseState;
    readonly parserEntryPoint:
        | ((state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<Ast.TNode>)
        | undefined;
}
