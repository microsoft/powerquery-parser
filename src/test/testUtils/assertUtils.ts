// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { Assert, Lexer, LexSettings, Parser, ParseSettings, Task } from "../..";
import { ResultUtils, TaskUtils } from "../../powerquery-parser";

export async function assertGetLexParseOk(
    settings: LexSettings & ParseSettings,
    text: string,
): Promise<Task.ParseTaskOk> {
    const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageOk(triedLexParseTask);

    return triedLexParseTask;
}

export async function assertGetLexParseError(
    settings: LexSettings & ParseSettings,
    text: string,
): Promise<Task.ParseTaskParseError> {
    const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, text);
    TaskUtils.assertIsParseStageParseError(triedLexParseTask);

    return triedLexParseTask;
}

export async function assertGetParseError(
    settings: LexSettings & ParseSettings,
    text: string,
): Promise<Parser.ParseError.ParseError> {
    const triedParse: Parser.TriedParse = await assertGetTriedParse(settings, text);
    ResultUtils.assertIsError(triedParse);

    if (!Parser.ParseError.isParseError(triedParse.error)) {
        throw new Error(`expected triedParse to return a ParseError.ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export async function assertGetParseOk(settings: LexSettings & ParseSettings, text: string): Promise<Parser.ParseOk> {
    const triedParse: Parser.TriedParse = await assertGetTriedParse(settings, text);
    ResultUtils.assertIsOk(triedParse);

    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
async function assertGetTriedParse(settings: LexSettings & ParseSettings, text: string): Promise<Parser.TriedParse> {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    ResultUtils.assertIsOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    Assert.isUndefined(Lexer.errorLineMap(lexerState));

    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    ResultUtils.assertIsOk(triedSnapshot);
    const lexerSnapshot: Lexer.LexerSnapshot = triedSnapshot.value;

    return await Parser.ParserUtils.tryParse(settings, lexerSnapshot);
}
