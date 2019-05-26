// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Option, ResultKind } from "./common";
import { lexAndParse } from "./jobs";
import { Lexer, LexerError, LexerSnapshot, TriedLexerSnapshot } from "./lexer";

parseText(`if true then 1 else 2`);

// @ts-ignore
function parseText(text: string): Lexer.State {
    const parseResult = lexAndParse(text);
    if (parseResult.kind === ResultKind.Ok) {
        console.log(JSON.stringify(parseResult.value, null, 4));
    }
    else {
        console.log(parseResult.error.message);
        console.log(JSON.stringify(parseResult.error, null, 4));
    }
}

// @ts-ignore
function lexText(text: string) {
    // state isn't const as calling Lexer functions return a new state object.

    // the returned state will be in an error state if `text` can't be lex'd.
    // use Lexer.isErrorState to validate if needed
    let state: Lexer.State = Lexer.stateFrom(text);

    const maybeErrorLines: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (maybeErrorLines) {
        // handle the error(s).
        //
        // note: these are errors isolated to indiviudal lines,
        //       meaning multiline errors such as an unterminated string are not
        //       considered an error at this stage.
        const errorLines: Lexer.ErrorLineMap = maybeErrorLines;

        for (const errorLine of errorLines.values()) {
            console.log(errorLine);
        }
    }

    // let's add one extra line.
    // note: adding new lines can introduce new errors,
    //       meaning you might want to check for them using maybeErrorLines again
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
        console.log(JSON.stringify(error.innerError, null, 4));
    }
    else {
        const snapshot: LexerSnapshot = snapshotResult.value;
        console.log(`numTokens: ${snapshot.tokens}`);
        console.log(`numComments: ${snapshot.comments}`);
    }
}
