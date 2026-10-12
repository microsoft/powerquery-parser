// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-floating-promises */

import { DefaultSettings, Lexer, ResultUtils, Task, TaskUtils } from ".";

parseText(`let x = 1 in try x otherwise 2`);
lexText(`let x = 1 in try x otherwise 2`);

async function parseText(text: string): Promise<void> {
    const task: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, text);

    if (TaskUtils.isParseStageOk(task)) {
        console.log(JSON.stringify(task.ast, undefined, 4));
    } else if (TaskUtils.isLexStageError(task)) {
        console.log(task.error.message);
    } else if (TaskUtils.isParseStageError(task)) {
        console.log(
            `a ${task.isCommonError ? "CommonError" : "ParseError"} was thrown during parsing: ${task.error.message}`,
        );

        if (!task.isCommonError) {
            console.log(`parsed ${task.nodeIdMapCollection.leafIds.size} leaf nodes`);
        }
    }
}

function lexText(text: string): void {
    // Supply the complete current document, including after edits.
    const triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);

    if (ResultUtils.isError(triedLex)) {
        console.log(`An error occurred while lexing: ${triedLex.error.message}`);

        return;
    }

    const snapshot: Lexer.LexerSnapshot = triedLex.value;
    console.log(`numTokens: ${snapshot.tokens.length}`);
    console.log(`numComments: ${snapshot.comments.length}`);
}
