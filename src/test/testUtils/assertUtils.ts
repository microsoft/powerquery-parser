// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Assert, Lexer, LexSettings, Parser, ParseSettings, Task } from "../..";
import { TaskUtils } from "../../powerquery-parser";

export function assertGetLexParseOk<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): Task.ParseTaskOk<S> {
    const triedLexParseTask: Task.TriedLexParseTask<S> = TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageOk(triedLexParseTask);

    return triedLexParseTask;
}

export function assertGetParseError<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): Parser.ParseError.ParseError<S> {
    const triedParse: Parser.TriedParse<S> = assertGetTriedParse(settings, text);
    Assert.isError(triedParse);

    if (!Parser.ParseError.isParseError(triedParse.error)) {
        throw new Error(`expected triedParse to return a ParseError.ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function assertGetParseOk<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): Parser.ParseOk<S> {
    const triedParse: Parser.TriedParse<S> = assertGetTriedParse(settings, text);
    Assert.isOk(triedParse);
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function assertGetTriedParse<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): Parser.TriedParse<S> {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    Assert.isUndefined(Lexer.maybeErrorLineMap(lexerState));

    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    Assert.isOk(triedSnapshot);
    const lexerSnapshot: Lexer.LexerSnapshot = triedSnapshot.value;

    return Parser.IParserUtils.tryParse<S>(settings, lexerSnapshot);
}
