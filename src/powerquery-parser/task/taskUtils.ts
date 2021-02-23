// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer, Parser } from "..";
import { CommonError, ResultKind, ResultUtils } from "../common";
import { Ast } from "../language";
import { IParserUtils, IParseState } from "../parser";
import { LexSettings, ParseSettings } from "../settings/settings";
import {
    LexTaskErr,
    LexTaskOk,
    ParseTaskCommonErr,
    ParseTaskOk,
    ParseTaskParseErr,
    TaskStage,
    TriedLexParseTask,
    TriedLexTask,
    TriedParseTask,
} from "./task";

export function assertLexOk(task: TriedLexTask): asserts task is LexTaskOk {
    if (!isLexOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            expectedTaskStage: TaskStage.Lex,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertLexStage(task: LexTaskOk | TriedLexParseTask): asserts task is TriedLexTask {
    if (!isLexStage(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task stage kind`, {
            expected: TaskStage.Lex,
            actual: task.resultKind,
        });
    }
}

export function assertParseOk<S extends IParseState = IParseState>(
    task: TriedLexParseTask<S>,
): asserts task is ParseTaskOk<S> {
    if (!isParseOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expected: ResultKind.Ok,
            actual: task.resultKind,
        });
    }
}

export function assertParseStage<S extends IParseState = IParseState>(
    task: TriedLexParseTask<S>,
): asserts task is TriedParseTask<S> {
    if (!isParseStage(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task stage kind`, {
            expectedResultKind: ResultKind.Ok,
            expectedTaskStage: TaskStage.Parse,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function isLexOk<S extends IParseState = IParseState>(
    task: LexTaskOk | TriedLexParseTask<S>,
): task is LexTaskOk {
    return isLexStage(task) && task.resultKind === ResultKind.Ok;
}

export function isLexErr<S extends IParseState = IParseState>(task: TriedLexParseTask<S>): task is LexTaskErr {
    return isLexStage(task) && task.resultKind === ResultKind.Err;
}

export function isLexStage<S extends IParseState = IParseState>(
    task: LexTaskOk | TriedLexParseTask<S>,
): task is TriedLexTask {
    return task.stage === TaskStage.Lex;
}

export function isParseOk<S extends IParseState = IParseState>(task: TriedLexParseTask): task is ParseTaskOk<S> {
    return isParseStage(task) && task.resultKind === ResultKind.Ok;
}

export function isParseErr<S extends IParseState = IParseState>(
    task: TriedLexParseTask,
): task is ParseTaskCommonErr | ParseTaskParseErr<S> {
    return isParseStage(task) && task.resultKind === ResultKind.Err;
}

export function isParseStage<S extends IParseState = IParseState>(task: TriedLexParseTask): task is TriedParseTask<S> {
    return task.stage === TaskStage.Parse;
}

export function tryLex(settings: LexSettings, text: string): TriedLexTask {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    if (ResultUtils.isErr(triedLex)) {
        return createLexTaskErr(triedLex.error);
    }
    const state: Lexer.State = triedLex.value;

    const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        return createLexTaskErr(
            new Lexer.LexError.LexError(new Lexer.LexError.ErrorLineMapError(settings.locale, maybeErrorLineMap)),
        );
    }

    const triedLexerSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(state);

    if (ResultUtils.isOk(triedLexerSnapshot)) {
        return createLexTaskOk(triedLexerSnapshot.value);
    } else {
        return createLexTaskErr(triedLexerSnapshot.error);
    }
}

export function tryParse<S extends IParseState = IParseState>(
    settings: ParseSettings<S>,
    lexerSnapshot: Lexer.LexerSnapshot,
): TriedParseTask<S> {
    const triedParse: Parser.TriedParse<S> = IParserUtils.tryParse(settings, lexerSnapshot);

    if (ResultUtils.isOk(triedParse)) {
        return createParseTaskOk(lexerSnapshot, triedParse.value.root, triedParse.value.state);
    } else {
        if (CommonError.isCommonError(triedParse.error)) {
            return createParseTaskCommonErr(lexerSnapshot, triedParse.error);
        } else {
            return createParseTaskParseErr(lexerSnapshot, triedParse.error);
        }
    }
}

export function tryLexParse<S extends IParseState = IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): TriedLexParseTask<S> {
    const triedLexTask: TriedLexTask = tryLex(settings, text);
    if (triedLexTask.resultKind === ResultKind.Err) {
        return triedLexTask;
    }
    const lexerSnapshot: Lexer.LexerSnapshot = triedLexTask.lexerSnapshot;

    return tryParse(settings, lexerSnapshot);
}

function createLexTaskOk(lexerSnapshot: Lexer.LexerSnapshot): LexTaskOk {
    return {
        stage: TaskStage.Lex,
        resultKind: ResultKind.Ok,
        lexerSnapshot,
    };
}

function createLexTaskErr(error: Lexer.LexError.TLexError): LexTaskErr {
    return {
        stage: TaskStage.Lex,
        resultKind: ResultKind.Err,
        error,
    };
}

function createParseTaskOk<S extends IParseState = IParseState>(
    lexerSnapshot: Lexer.LexerSnapshot,
    ast: Ast.TNode,
    parseState: S,
): ParseTaskOk<S> {
    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Ok,
        lexerSnapshot,
        ast,
        parseState,
        nodeIdMapCollection: parseState.contextState.nodeIdMapCollection,
        leafNodeIds: parseState.contextState.leafNodeIds,
    };
}

function createParseTaskCommonErr(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: CommonError.CommonError,
): ParseTaskCommonErr {
    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Err,
        isCommonError: true,
        error,
        lexerSnapshot,
    };
}

function createParseTaskParseErr<S extends IParseState = IParseState>(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: Parser.ParseError.ParseError<S>,
): ParseTaskParseErr<S> {
    const parseState: S = error.state;
    const contextState: Parser.ParseContext.State = parseState.contextState;

    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Err,
        isCommonError: false,
        error,
        lexerSnapshot,
        parseState,
        nodeIdMapCollection: contextState.nodeIdMapCollection,
        leafNodeIds: contextState.leafNodeIds,
    };
}
