import { isNever, ResultKind } from "./common";
import { lexAndParse } from "./jobs";
import { Lexer } from "./lexer";

// parse document
// @ts-ignore
function parseDocument(document: string) {
    const parseResult = lexAndParse(document);
    if (parseResult.kind === ResultKind.Ok) {
        console.log(JSON.stringify(parseResult.value, null, 4));
    }
    else {
        console.log(parseResult.error.message);
        console.log(JSON.stringify(parseResult.error, null, 4));
    }
}

// lex document
// @ts-ignore
function lexDocument(document: string) {
    // lexer isn't const as calling Lexer functions return a new state object
    let state: Lexer.TLexer = Lexer.from(document);
    state = Lexer.remaining(state);

    switch (state.kind) {
        // nothing was read, and an error was encountered such as an unterminated string.
        case Lexer.LexerKind.Error:
            // handle error located on state.error
            break;

        // reached EOF without any errors.
        // it's possible that no tokens or comments were read, such as only whitespace remained.
        case Lexer.LexerKind.Touched:
            // tokens are comments are on state.tokens and state.comments respectively
            break;

        // some comments were read and an error was encountered such as an unterminated string.
        case Lexer.LexerKind.TouchedWithError:
            // handle error located on state.error
            // tokens are comments are on state.tokens and state.comments respectively
            break;

        default:
            throw isNever(state);
    }
}

// lex document, one chunk at a time
// @ts-ignore
function iterativeLexer(document: string) {
    // production could should perform better error checking for initial state
    const documentChunks = document.split(" ");
    if (documentChunks.length === 1) {
        throw new Error("expecting at least 2 chunks")
    }

    // lexer isn't const as calling Lexer functions return a new state object
    let state: Lexer.TLexer = Lexer.from(documentChunks[0]);
    state = Lexer.next(state);

    // production could should perform better error checking for initial state
    if (Lexer.hasError(state)) {
        throw new Error("initial state shouldn't have a problem");
    }

    for (let index = 1; index < documentChunks.length; index++) {
        const chunk = documentChunks[index];
        state = Lexer.appendToDocument(state, chunk);
        state = Lexer.next(state);

        switch (state.kind) {
            case Lexer.LexerKind.Error:
                // handle error located on state.error
                break;

            case Lexer.LexerKind.Touched:
                // all comments and the possibly read token are on state.state.lastRead
                break;

            case Lexer.LexerKind.TouchedWithError:
                // handle error located on state.error
                // all comments and the possibly read token are on state.state.lastRead
                break;

            default:
                throw isNever(state);
        }
    }
}

parseDocument("if true then x else y");
