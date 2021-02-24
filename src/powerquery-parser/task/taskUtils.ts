// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer, Parser } from "..";
import { CommonError, ResultKind, ResultUtils } from "../common";
import { Ast } from "../language";
import { IParserUtils, IParseState } from "../parser";
import { LexSettings, ParseSettings } from "../settings/settings";
import {
    LexTaskError,
    LexTaskOk,
    ParseTaskCommonError,
    ParseTaskOk,
    ParseTaskParseError,
    TaskStage,
    TriedLexParseTask,
    TriedLexTask,
    TriedParseTask,
    TTask,
} from "./task";

export function assertIsError<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is LexTaskError | ParseTaskCommonError | ParseTaskParseError<S> {
    if (!isError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Err,
            actualResultKind: task.resultKind,
        });
    }
}

export function assertIsLexStage<S extends IParseState = IParseState>(task: TTask<S>): asserts task is TriedLexTask {
    if (!isLexStage(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task stage kind`, {
            expected: TaskStage.Lex,
            actual: task.resultKind,
        });
    }
}

export function assertIsLexStageOk<S extends IParseState = IParseState>(task: TTask<S>): asserts task is LexTaskOk {
    if (!isLexStageOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            expectedTaskStage: TaskStage.Lex,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsLexStageError<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is LexTaskError {
    if (!isLexStageError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            expectedTaskStage: TaskStage.Lex,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsOk<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is LexTaskOk | ParseTaskOk<S> {
    if (!isOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            actualResultKind: task.resultKind,
        });
    }
}

export function assertIsParseStage<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is TriedParseTask<S> {
    if (!isParseStage(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task stage kind`, {
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsParseStageOk<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is ParseTaskOk<S> {
    if (!isParseStageOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            expectedTaskStage: TaskStage.Parse,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsParseStageError<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is ParseTaskParseError<S> | ParseTaskCommonError {
    if (!isParseStageError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Err,
            expectedTaskStage: TaskStage.Parse,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsParseStageCommonError<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is ParseTaskCommonError {
    if (!isParseStageCommonError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Err,
            expectedTaskStage: TaskStage.Parse,
            expectedIsCommonError: true,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
            actualIsCommonError: isParseStageError(task) ? task.isCommonError : undefined,
        });
    }
}

export function assertIsParseStageParseError<S extends IParseState = IParseState>(
    task: TTask<S>,
): asserts task is ParseTaskParseError<S> {
    if (!isParseStageParseError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Err,
            expectedTaskStage: TaskStage.Parse,
            expectedIsCommonError: true,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
            actualIsCommonError: isParseStageError(task) ? task.isCommonError : undefined,
        });
    }
}

export function isError<S extends IParseState = IParseState>(
    task: TTask<S>,
): task is LexTaskError | ParseTaskCommonError | ParseTaskParseError<S> {
    return task.resultKind === ResultKind.Err;
}

export function isLexStage<S extends IParseState = IParseState>(task: TTask<S>): task is TriedLexTask {
    return task.stage === TaskStage.Lex;
}

export function isLexStageOk<S extends IParseState = IParseState>(task: TTask<S>): task is LexTaskOk {
    return isLexStage(task) && task.resultKind === ResultKind.Ok;
}

export function isLexStageError<S extends IParseState = IParseState>(task: TTask<S>): task is LexTaskError {
    return isLexStage(task) && task.resultKind === ResultKind.Err;
}

export function isOk<S extends IParseState = IParseState>(task: TTask<S>): task is LexTaskOk | ParseTaskOk<S> {
    return task.resultKind === ResultKind.Ok;
}

export function isParseStage<S extends IParseState = IParseState>(task: TTask<S>): task is TriedParseTask<S> {
    return task.stage === TaskStage.Parse;
}

export function isParseStageOk<S extends IParseState = IParseState>(task: TTask<S>): task is ParseTaskOk<S> {
    return isParseStage(task) && task.resultKind === ResultKind.Ok;
}

export function isParseStageError<S extends IParseState = IParseState>(
    task: TTask<S>,
): task is ParseTaskCommonError | ParseTaskParseError<S> {
    return isParseStage(task) && task.resultKind === ResultKind.Err;
}

export function isParseStageCommonError<S extends IParseState = IParseState>(
    task: TTask<S>,
): task is ParseTaskCommonError {
    return isParseStageError(task) && task.isCommonError;
}

export function isParseStageParseError<S extends IParseState = IParseState>(
    task: TTask<S>,
): task is ParseTaskParseError<S> {
    return isParseStageError(task) && !task.isCommonError;
}

export function tryLex(settings: LexSettings, text: string): TriedLexTask {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    if (ResultUtils.isErr(triedLex)) {
        return createLexTaskError(triedLex.error);
    }
    const state: Lexer.State = triedLex.value;

    const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        return createLexTaskError(
            new Lexer.LexError.LexError(new Lexer.LexError.ErrorLineMapError(settings.locale, maybeErrorLineMap)),
        );
    }

    const triedLexerSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(state);

    if (ResultUtils.isOk(triedLexerSnapshot)) {
        return createLexTaskOk(triedLexerSnapshot.value);
    } else {
        return createLexTaskError(triedLexerSnapshot.error);
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
            return createParseTaskCommonError(lexerSnapshot, triedParse.error);
        } else {
            return createParseTaskParseError(lexerSnapshot, triedParse.error);
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

function createLexTaskError(error: Lexer.LexError.TLexError): LexTaskError {
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

function createParseTaskCommonError(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: CommonError.CommonError,
): ParseTaskCommonError {
    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Err,
        isCommonError: true,
        error,
        lexerSnapshot,
    };
}

function createParseTaskParseError<S extends IParseState = IParseState>(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: Parser.ParseError.ParseError<S>,
): ParseTaskParseError<S> {
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
