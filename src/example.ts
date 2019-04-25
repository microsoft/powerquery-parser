import { ResultKind } from "./common";
import { lexAndParse } from "./jobs";
import { Lexer } from "./lexer";

parseDocument(`if true then 1 else 2`);

// @ts-ignore
function parseDocument(document: string, lineTerminator = "\n") {
    console.log(JSON.stringify(lexAndParse(document, lineTerminator), null, 4));
    const parseResult = lexAndParse(document, lineTerminator);
    if (parseResult.kind === ResultKind.Ok) {
        console.log(JSON.stringify(parseResult.value, null, 4));
    }
    else {
        console.log(parseResult.error.message);
        console.log(JSON.stringify(parseResult.error, null, 4));
    }
}

// @ts-ignore
function lexDocument(document: string, lineTerminator = "\n") {
    // state isn't const as calling Lexer functions return a new state object.

    // the returned state will be in an error state if `text` can't be lex'd.
    // use Lexer.isErrorState to validate if needed
    let state: Lexer.LexerState = Lexer.fromSplit(document, lineTerminator);

    if (Lexer.isErrorState(state)) {
        // handle the error state
    }
    else {
        // you're good to go
    }
}
