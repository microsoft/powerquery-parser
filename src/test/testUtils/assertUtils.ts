// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, Lexer, LexSettings, Parser, ParseSettings, Task } from "../..";
import { TaskUtils } from "../../powerquery-parser";

export function assertGetLexParseOk(settings: LexSettings & ParseSettings, text: string): Task.ParseTaskOk {
    const triedLexParseTask: Task.TriedLexParseTask = TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageOk(triedLexParseTask);

    return triedLexParseTask;
}

export function assertGetParseError(settings: LexSettings & ParseSettings, text: string): Parser.ParseError.ParseError {
    const triedParse: Parser.TriedParse = assertGetTriedParse(settings, text);
    Assert.isError(triedParse);

    if (!Parser.ParseError.isParseError(triedParse.error)) {
        throw new Error(`expected triedParse to return a ParseError.ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function assertGetParseOk(settings: LexSettings & ParseSettings, text: string): Parser.ParseOk {
    const triedParse: Parser.TriedParse = assertGetTriedParse(settings, text);
    Assert.isOk(triedParse);
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function assertGetTriedParse(settings: LexSettings & ParseSettings, text: string): Parser.TriedParse {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    Assert.isUndefined(Lexer.maybeErrorLineMap(lexerState));

    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    Assert.isOk(triedSnapshot);
    const lexerSnapshot: Lexer.LexerSnapshot = triedSnapshot.value;

    return Parser.ParserUtils.tryParse(settings, lexerSnapshot);
}
