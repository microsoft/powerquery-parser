// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer, Parser } from "..";
import { CommonError, ResultKind } from "../common";
import { Ast } from "../language";
import { IParseState, NodeIdMap } from "../parser";

export type TTask<S extends IParseState = IParseState> = TriedLexTask | TriedParseTask<S>;

export type TriedLexTask = LexTaskOk | LexTaskError;

export type TriedParseTask<S extends IParseState = IParseState> =
    | ParseTaskOk
    | ParseTaskCommonError
    | ParseTaskParseError<S>;

export type TriedLexParseTask<S extends IParseState = IParseState> = LexTaskError | TriedParseTask<S>;

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

export interface ParseTaskOk<S extends IParseState = IParseState> extends IParseTask {
    readonly resultKind: ResultKind.Ok;
    readonly ast: Ast.TNode;
    readonly parseState: S;
    // Indirection to parseState.contextState.nodeIdMapCollection
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    // Indirection to parseState.contextState.leafNodeIds
    readonly leafNodeIds: ReadonlyArray<number>;
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

export interface ParseTaskParseError<S extends IParseState = IParseState>
    extends IParseTaskError<Parser.ParseError.ParseError> {
    readonly resultKind: ResultKind.Error;
    readonly isCommonError: false;
    readonly parseState: S;
    // Indirection to parseState.contextState.nodeIdMapCollection
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    // Indirection to parseState.contextState.leafNodeIds
    readonly leafNodeIds: ReadonlyArray<number>;
}
