// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, Inspection, Lexer, Task } from "../..";
import { IParserState, IParserUtils, ParseError, ParseOk, TriedParse } from "../../parser";
import { LexSettings, ParseSettings } from "../../settings";

// Only works with single line expressions
export function assertGetTextWithPosition(text: string): [string, Inspection.Position] {
    const indexOfPipe: number = text.indexOf("|");

    expect(indexOfPipe).to.be.greaterThan(-1, "text must have | marker");
    expect(indexOfPipe).to.equal(text.lastIndexOf("|"), "text must have one and only one '|'");

    const position: Inspection.Position = {
        lineNumber: 0,
        lineCodeUnit: indexOfPipe,
    };

    return [text.replace("|", ""), position];
}

export function assertGetLexParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: Lexer.LexerSnapshot) => S,
): Task.LexParseOk<S> {
    const triedLexParse: Task.TriedLexParse<S> = Task.tryLexParse(settings, text, stateFactoryFn);
    Assert.isOk(triedLexParse);
    return triedLexParse.value;
}

export function assertGetParseErr<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: Lexer.LexerSnapshot) => S,
): ParseError.ParseError<S> {
    const triedParse: TriedParse<S> = assertGetTriedParse(settings, text, stateFactoryFn);
    Assert.isErr(triedParse);

    if (!ParseError.isParseError(triedParse.error)) {
        throw new Error(`expected triedParse to return a ParseError.ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function assertGetParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: Lexer.LexerSnapshot) => S,
): ParseOk<S> {
    const triedParse: TriedParse<S> = assertGetTriedParse(settings, text, stateFactoryFn);
    Assert.isOk(triedParse);
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function assertGetTriedParse<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: Lexer.LexerSnapshot) => S,
): TriedParse<S> {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    Assert.isUndefined(Lexer.maybeErrorLineMap(lexerState));

    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    Assert.isOk(triedSnapshot);
    const lexerSnapshot: Lexer.LexerSnapshot = triedSnapshot.value;

    return IParserUtils.tryRead(stateFactoryFn(settings, lexerSnapshot), settings.parser);
}
