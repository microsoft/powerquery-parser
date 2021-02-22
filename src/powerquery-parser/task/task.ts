// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer, Parser } from "..";
import { CommonError, Result, ResultKind } from "../common";
import { Ast } from "../language";
import { IParseState, NodeIdMap, ParseError, ParseOk } from "../parser";

export type TriedLexTask = LexTaskOk | LexTaskErr;

export type TriedParseTask = ParseTaskOk | ParseTaskCommonErr | ParseTaskParseErr;

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

export interface LexTaskErr extends ILexTask {
    readonly resultKind: ResultKind.Err;
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

export interface IParseTaskErr<T> extends IParseTask {
    readonly resultKind: ResultKind.Err;
    readonly error: T;
    readonly isCommonError: boolean;
}

export interface ParseTaskCommonErr extends IParseTaskErr<CommonError.CommonError> {
    readonly resultKind: ResultKind.Err;
    readonly isCommonError: true;
}

export interface ParseTaskParseErr<S extends IParseState = IParseState>
    extends IParseTaskErr<Parser.ParseError.ParseError> {
    readonly resultKind: ResultKind.Err;
    readonly isCommonError: false;
    readonly parseState: S;
    // Indirection to parseState.contextState.nodeIdMapCollection
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    // Indirection to parseState.contextState.leafNodeIds
    readonly leafNodeIds: ReadonlyArray<number>;
}

export type TriedLexParse<S extends IParseState = IParseState> = Result<
    LexParseOk<S>,
    Lexer.LexError.TLexError | ParseError.TParseError<S>
>;

export interface LexParseOk<S extends IParseState = IParseState> extends ParseOk<S> {
    readonly lexerSnapshot: Lexer.LexerSnapshot;
}
