// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ResultKind } from "../common";
import { Lexer, Parser } from "..";
import { NodeIdMap, ParseState } from "../parser";
import { Ast } from "../language";

export type TTask = TriedLexTask | TriedParseTask;

export type TriedLexTask = LexTaskOk | LexTaskError;

export type TriedParseTask = ParseTaskOk | ParseTaskCommonError | ParseTaskParseError;

export type TriedLexParseTask = LexTaskError | TriedParseTask;

export const enum TaskStage {
    Lex = "Lex",
    Parse = "Parse",
}

export interface ITask {
    readonly stage: TaskStage;
    readonly resultKind: ResultKind;
}

export interface ILexTask extends ITask {
    readonly stage: TaskStage.Lex;
}

export interface LexTaskOk extends ILexTask {
    readonly resultKind: ResultKind.Ok;
    readonly lexerSnapshot: Lexer.LexerSnapshot;
}

export interface LexTaskError extends ILexTask {
    readonly resultKind: ResultKind.Error;
    readonly error: Lexer.LexError.TLexError;
}

export interface IParseTask extends ITask {
    readonly stage: TaskStage.Parse;
    readonly lexerSnapshot: Lexer.LexerSnapshot;
}

export interface ParseTaskOk extends IParseTask {
    readonly resultKind: ResultKind.Ok;
    readonly ast: Ast.TNode;
    readonly parseState: ParseState;
    // Indirection to parseState.contextState.nodeIdMapCollection
    readonly nodeIdMapCollection: NodeIdMap.Collection;
}

export interface IParseTaskError<T> extends IParseTask {
    readonly resultKind: ResultKind.Error;
    readonly error: T;
    readonly isCommonError: boolean;
}

export interface ParseTaskCommonError extends IParseTaskError<CommonError.CommonError> {
    readonly resultKind: ResultKind.Error;
    readonly isCommonError: true;
}

export interface ParseTaskParseError extends IParseTaskError<Parser.ParseError.ParseError> {
    readonly resultKind: ResultKind.Error;
    readonly isCommonError: false;
    readonly parseState: ParseState;
    // Indirection to parseState.contextState.nodeIdMapCollection
    readonly nodeIdMapCollection: NodeIdMap.Collection;
}
