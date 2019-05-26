// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
/* tslint:disable:no-console */
import { Option, ResultKind } from "./common";
import { lexAndParse, TriedLexAndParse } from "./jobs";
import { Lexer, LexerError, LexerSnapshot, TriedLexerSnapshot } from "./lexer";

parseText(`if true then 1 else 2`);

// @ts-ignore
function parseText(text: string): void {
    const parseResult: TriedLexAndParse = lexAndParse(text);
    if (parseResult.kind === ResultKind.Ok) {
        console.log(JSON.stringify(parseResult.value, undefined, 4));
    } else {
        console.log(parseResult.error.message);
        console.log(JSON.stringify(parseResult.error, undefined, 4));
    }
}

// @ts-ignore
function lexText(text: string): void {
    // state isn't const as calling Lexer functions return a new state object.

    // the returned state will be in an error state if `text` can't be lex'd.
    // use Lexer.isErrorState to validate if needed
    let state: Lexer.State = Lexer.stateFrom(text);

    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLineMap) {
        // handle the error(s).
        //
        // note: these are errors isolated to indiviudal lines,
        //       meaning multiline errors such as an unterminated string are not
        //       considered an error at this stage.
        const errorLineMap: Lexer.ErrorLineMap = maybeErrorLineMap;

        for (const [lineNumber, errorLine] of errorLineMap.entries()) {
            console.log(`lineNumber ${lineNumber} has the following error: ${errorLine.error.message}`);
        }
    }

    // let's add one extra line.
    // note: adding new lines can introduce new errors,
    //       meaning you might want to check for them using maybeErrorLineMap again
    state = Lexer.appendLine(state, "// hello world", "\n");

    // a snapshot should be created once no more text is to be added.
    // a snapshot is an immutable copy which:
    //      * combines multiline tokens together
    //        (eg. StringLiteralStart + StringLiteralContent + StringLiteralEnd)
    //      * checks for multiline errors
    //        (eg. unterminated string error)
    const snapshotResult: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    if (snapshotResult.kind === ResultKind.Err) {
        // a multiline error was found
        const error: LexerError.LexerError = snapshotResult.error;
        console.log(error.innerError.message);
        console.log(JSON.stringify(error.innerError, undefined, 4));
    } else {
        const snapshot: LexerSnapshot = snapshotResult.value;
        console.log(`numTokens: ${snapshot.tokens}`);
        console.log(`numComments: ${snapshot.comments}`);
    }
}
