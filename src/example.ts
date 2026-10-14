// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { DefaultSettings, Lexer, ResultUtils, Task, TaskUtils } from ".";

parseText(`let x = 1 in try x otherwise 2`);

async function parseText(text: string): Promise<void> {
    // Try lexing and parsing the argument which returns a Result object.
    // A Result<T, E> is the union (Ok<T> | Error<E>).
    const task: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, text);

    // If it was a success then dump the abstract syntax tree (AST) as verbose JSON to console.
    if (TaskUtils.isParseStageOk(task)) {
        console.log(JSON.stringify(task.ast, undefined, 4));
    }
    // Else if the error was during lexing then dump the error to console.
    else if (TaskUtils.isLexStageError(task)) {
        console.log(task.error.message);
    }
    // Else if the error was during parsing then dump the error to the console.
    else if (TaskUtils.isParseStageError(task)) {
        // If we branch on isCommonError we can know if a CommonError or ParseError was thrown.
        console.log(
            `a ${task.isCommonError ? "CommonError" : "ParseError"} was thrown during parsing: ${task.error.message}`,
        );

        if (!task.isCommonError) {
            console.log(`parsed ${task.nodeIdMapCollection.leafIds.size} leaf nodes`);
        }
    }
}

// @ts-ignore
function lexText(text: string): void {
    // Apply edits to the text before calling the lexer; every call scans the complete document.
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);

    if (ResultUtils.isError(triedLex)) {
        console.log(`An error occurred while lexing: ${triedLex.error.message}`);

        return;
    }

    const snapshot: Lexer.LexerSnapshot = triedLex.value;
    console.log(`numTokens: ${snapshot.tokens.length}`);
    console.log(`numComments: ${snapshot.comments.length}`);
}
