import { isNever, ResultKind } from "./common";
import { lexAndParse } from "./jobs";
import { Lexer } from "./lexer";

parseDocument("if true then x else y");

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

// @ts-ignore
function lexDocument(document: string) {
    // state isn't const as calling Lexer functions return a new state object.
    let state: Lexer.TLexer = Lexer.from(document);
    state = Lexer.remaining(state);

    switch (state.kind) {
        // nothing was read and an error was encountered, such as an unterminated string.
        case Lexer.LexerKind.Error:
            // handle the error, find it on state.error.
            break;

        // reached EOF without any errors.
        // it's possible that no tokens or comments were read,
        // eg. only whitespace being consumed.
        case Lexer.LexerKind.Touched:
            // state.tokens and state.comments hold all tokens and comments ever read,
            // where state.lastRead holds what was read in the last call.
            break;

        // some tokens or comments were read,
        // but then an error was encountered such as an unterminated string.
        case Lexer.LexerKind.TouchedWithError:
            // state.tokens and state.comments hold all tokens and comments ever read,
            // where state.lastRead holds what was read in the last call.
            break;

        default:
            throw isNever(state);
    }
}

// @ts-ignore
function iterativeLexDocument(document: string) {
    // for brevity's sake I'll be asserting:
    //  * document.split(" ").length > 1
    //  * the first chunk from the split won't result in a lexer error

    const documentChunks = document.split(" ");
    if (documentChunks.length === 1) {
        throw new Error(`AssertFailed: document.split(" ").length > 1`)
    }

    // state isn't const as calling Lexer functions return a new state object.
    let state: Lexer.TLexer = Lexer.from(documentChunks[0]);
    state = Lexer.next(state);

    if (Lexer.hasError(state)) {
        throw new Error(`AssertFailed: the first chunk from the split won't result in a lexer error`);
    }

    for (let index = 1; index < documentChunks.length; index++) {
        const chunk = documentChunks[index];
        state = Lexer.appendToDocument(state, chunk);
        state = Lexer.next(state);

        switch (state.kind) {
            // nothing was read and an error was encountered, such as an unterminated string.
            case Lexer.LexerKind.Error:
                // handle the error, find it on state.error.
                break;

            // reached EOF without any errors.
            // it's possible that no tokens or comments were read,
            // eg. only whitespace being consumed.
            case Lexer.LexerKind.Touched:
                // state.tokens and state.comments hold all tokens and comments ever read,
                // where state.lastRead holds what was read in the last call.
                break;

            // some tokens or comments were read,
            // but then an error was encountered such as an unterminated string.
            case Lexer.LexerKind.TouchedWithError:
                // state.tokens and state.comments hold all tokens and comments ever read,
                // where state.lastRead holds what was read in the last call.
                break;

            default:
                throw isNever(state);
        }
    }
}
