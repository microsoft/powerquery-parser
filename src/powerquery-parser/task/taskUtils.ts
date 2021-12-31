// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, ResultKind, ResultUtils } from "../common";
import { Lexer, Parser } from "..";
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
import { ParserUtils, ParseState } from "../parser";
import { Ast } from "../language";

export function assertIsError(task: TTask): asserts task is LexTaskError | ParseTaskCommonError | ParseTaskParseError {
    if (!isError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Error,
            actualResultKind: task.resultKind,
        });
    }
}

export function assertIsLexStage(task: TTask): asserts task is TriedLexTask {
    if (!isLexStage(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task stage kind`, {
            expected: TaskStage.Lex,
            actual: task.resultKind,
        });
    }
}

export function assertIsLexStageOk(task: TTask): asserts task is LexTaskOk {
    if (!isLexStageOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            expectedTaskStage: TaskStage.Lex,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsLexStageError(task: TTask): asserts task is LexTaskError {
    if (!isLexStageError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Error,
            expectedTaskStage: TaskStage.Lex,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsOk(task: TTask): asserts task is LexTaskOk | ParseTaskOk {
    if (!isOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            actualResultKind: task.resultKind,
        });
    }
}

export function assertIsParseStage(task: TTask): asserts task is TriedParseTask {
    if (!isParseStage(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task stage kind`, {
            expectedTaskStage: TaskStage.Parse,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsParseStageOk(task: TTask): asserts task is ParseTaskOk {
    if (!isParseStageOk(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Ok,
            expectedTaskStage: TaskStage.Parse,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsParseStageError(task: TTask): asserts task is ParseTaskParseError | ParseTaskCommonError {
    if (!isParseStageError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Error,
            expectedTaskStage: TaskStage.Parse,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
        });
    }
}

export function assertIsParseStageCommonError(task: TTask): asserts task is ParseTaskCommonError {
    if (!isParseStageCommonError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Error,
            expectedTaskStage: TaskStage.Parse,
            expectedIsCommonError: true,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
            actualIsCommonError: isParseStageError(task) ? task.isCommonError : undefined,
        });
    }
}

export function assertIsParseStageParseError(task: TTask): asserts task is ParseTaskParseError {
    if (!isParseStageParseError(task)) {
        throw new CommonError.InvariantError(`assert failed, expected a different task result kind`, {
            expectedResultKind: ResultKind.Error,
            expectedTaskStage: TaskStage.Parse,
            expectedIsCommonError: true,
            actualResultKind: task.resultKind,
            acutalTaskStage: task.stage,
            actualIsCommonError: isParseStageError(task) ? task.isCommonError : undefined,
        });
    }
}

export function isError(task: TTask): task is LexTaskError | ParseTaskCommonError | ParseTaskParseError {
    return task.resultKind === ResultKind.Error;
}

export function isLexStage(task: TTask): task is TriedLexTask {
    return task.stage === TaskStage.Lex;
}

export function isLexStageOk(task: TTask): task is LexTaskOk {
    return isLexStage(task) && task.resultKind === ResultKind.Ok;
}

export function isLexStageError(task: TTask): task is LexTaskError {
    return isLexStage(task) && task.resultKind === ResultKind.Error;
}

export function isOk(task: TTask): task is LexTaskOk | ParseTaskOk {
    return task.resultKind === ResultKind.Ok;
}

export function isParseStage(task: TTask): task is TriedParseTask {
    return task.stage === TaskStage.Parse;
}

export function isParseStageOk(task: TTask): task is ParseTaskOk {
    return isParseStage(task) && task.resultKind === ResultKind.Ok;
}

export function isParseStageError(task: TTask): task is ParseTaskCommonError | ParseTaskParseError {
    return isParseStage(task) && task.resultKind === ResultKind.Error;
}

export function isParseStageCommonError(task: TTask): task is ParseTaskCommonError {
    return isParseStageError(task) && task.isCommonError;
}

export function isParseStageParseError(task: TTask): task is ParseTaskParseError {
    return isParseStageError(task) && !task.isCommonError;
}

export function tryLex(settings: LexSettings, text: string): TriedLexTask {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    if (ResultUtils.isError(triedLex)) {
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

export function tryParse(settings: ParseSettings, lexerSnapshot: Lexer.LexerSnapshot): TriedParseTask {
    const triedParse: Parser.TriedParse = ParserUtils.tryParse(settings, lexerSnapshot);

    if (ResultUtils.isOk(triedParse)) {
        return createParseTaskOk(lexerSnapshot, triedParse.value.root, triedParse.value.state);
    } else if (CommonError.isCommonError(triedParse.error)) {
        return createParseTaskCommonError(lexerSnapshot, triedParse.error);
    } else {
        return createParseTaskParseError(lexerSnapshot, triedParse.error);
    }
}

export function tryLexParse(settings: LexSettings & ParseSettings, text: string): TriedLexParseTask {
    const triedLexTask: TriedLexTask = tryLex(settings, text);
    if (triedLexTask.resultKind === ResultKind.Error) {
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
        resultKind: ResultKind.Error,
        error,
    };
}

function createParseTaskOk(lexerSnapshot: Lexer.LexerSnapshot, ast: Ast.TNode, parseState: ParseState): ParseTaskOk {
    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Ok,
        lexerSnapshot,
        ast,
        parseState,
        nodeIdMapCollection: parseState.contextState.nodeIdMapCollection,
    };
}

function createParseTaskCommonError(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: CommonError.CommonError,
): ParseTaskCommonError {
    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Error,
        isCommonError: true,
        error,
        lexerSnapshot,
    };
}

function createParseTaskParseError(
    lexerSnapshot: Lexer.LexerSnapshot,
    error: Parser.ParseError.ParseError,
): ParseTaskParseError {
    const parseState: ParseState = error.state;
    const contextState: Parser.ParseContext.State = parseState.contextState;

    return {
        stage: TaskStage.Parse,
        resultKind: ResultKind.Error,
        isCommonError: false,
        error,
        lexerSnapshot,
        parseState,
        nodeIdMapCollection: contextState.nodeIdMapCollection,
    };
}
