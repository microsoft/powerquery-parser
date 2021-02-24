// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* tslint:disable:no-console */

import { Assert, DefaultSettings, Lexer, ResultUtils, Task, TaskUtils } from ".";

parseText(`let x = 1 in try x otherwise 2`);

// @ts-ignore
function parseText(text: string): void {
    // Try lexing and parsing the argument which returns a Result object.
    // A Result<T, E> is the union (Ok<T> | Err<E>).
    const task: Task.TriedLexParseTask = TaskUtils.tryLexParse(DefaultSettings, text);

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
            console.log(`parsed ${task.leafNodeIds.length} leaf nodes`);
        }
    }
}

// @ts-ignore
function lexText(text: string): void {
    // Notice that the Lexer.State variable is declared using let instead of const.
    // This is because calling Lexer functions return a new state object.

    // An error state is returned if the argument can't be lexed.
    // Use either the typeguard Lexer.isErrorState to discover if it's an error state,
    // or Lexer.maybeErrorLineMap to quickly get all lines with errors.
    // Note: At this point all errors are isolated to a single line.
    //       Checks for multiline errors, such as an unterminated string, have not been processed.
    let triedLex: Lexer.TriedLex = Lexer.tryLex(DefaultSettings, text);
    if (ResultUtils.isErr(triedLex)) {
        console.log(`An error occured while lexing: ${triedLex.error.message}`);
        return;
    }
    let lexerState: Lexer.State = triedLex.value;

    // The lexer state might have an error.
    // To be sure either use the typeguard Lexer.isErrorState,
    // or Lexer.maybeErrorLineMap to get an option containing a map of all lines with errors.
    const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(lexerState);
    if (maybeErrorLineMap !== undefined) {
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;

        for (const [lineNumber, errorLine] of errorLineMap.entries()) {
            console.log(`lineNumber ${lineNumber} has the following error: ${errorLine.error.message}`);
        }
        return;
    }

    // Appending a line is easy.
    // Be aware that this is a Result due to the potential of errors such as
    // a cancellation request from the CancellationToken.
    triedLex = Lexer.tryAppendLine(lexerState, "// hello world", "\n");
    Assert.isOk(triedLex);
    lexerState = triedLex.value;

    // Updating a line number is also easy.
    // Be aware that this is a Result due the potential of errors such as
    // invalid line numbers or a cancellation request from the CancellationToken.
    // For fine-grained control there is also the method Lexer.tryUpdateRange,
    // which is how Lexer.tryUpdateLine is implemented.
    const triedUpdate: Lexer.TriedLex = Lexer.tryUpdateLine(
        lexerState,
        lexerState.lines.length - 1,
        "// goodbye world",
    );
    if (ResultUtils.isErr(triedUpdate)) {
        console.log("Failed to update line");
        return;
    }
    lexerState = triedUpdate.value;

    // Once no more changes will occur a LexerSnapshot should be created, which  is an immutable copy that:
    //  * combines multiline tokens together
    //    (eg. TextLiteralStart + TextLiteralContent + TextLiteralEnd)
    //  * checks for multiline errors
    //    (eg. unterminated string error)

    // If you intend to only lex the document once (perform no append/updates),
    // then use the `jobs.tryLex` helper function to perform both actions in one go.

    // Creating a LexerSnapshot is a Result due to potential multiline token errors.
    const triedLexerSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    if (ResultUtils.isOk(triedLexerSnapshot)) {
        const snapshot: Lexer.LexerSnapshot = triedLexerSnapshot.value;
        console.log(`numTokens: ${snapshot.tokens}`);
        console.log(`numComments: ${snapshot.comments}`);
    }
    // A multiline token validation error was thrown.
    else {
        const error: Lexer.LexError.LexError = triedLexerSnapshot.error;
        console.log(error.innerError.message);
        console.log(JSON.stringify(error.innerError, undefined, 4));
    }
}
