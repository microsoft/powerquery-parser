// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, Inspection, Task } from "../..";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../lexer";
import { IParserState, IParserUtils, ParseError, ParseOk, TriedParse } from "../../parser";
import { LexSettings, ParseSettings } from "../../settings";

// Only works with single line expressions
export function assertTextWithPosition(text: string): [string, Inspection.Position] {
    const indexOfPipe: number = text.indexOf("|");

    expect(indexOfPipe).to.be.greaterThan(-1, "text must have | marker");
    expect(indexOfPipe).to.equal(text.lastIndexOf("|"), "text must have one and only one '|'");

    const position: Inspection.Position = {
        lineNumber: 0,
        lineCodeUnit: indexOfPipe,
    };

    return [text.replace("|", ""), position];
}

export function assertLexParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S,
): Task.LexParseOk<S> {
    const triedLexParse: Task.TriedLexParse<S> = Task.tryLexParse(settings, text, stateFactoryFn);
    Assert.isOk(triedLexParse);
    return triedLexParse.value;
}

export function assertParseErr<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S,
): ParseError.ParseError<S> {
    const triedParse: TriedParse<S> = assertTriedParse(settings, text, stateFactoryFn);
    Assert.isErr(triedParse);

    if (!ParseError.isParseError(triedParse.error)) {
        throw new Error(`expected triedParse to return a ParseError.ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function assertParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S,
): ParseOk<S> {
    const triedParse: TriedParse<S> = assertTriedParse(settings, text, stateFactoryFn);
    Assert.isOk(triedParse);
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function assertTriedParse<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    stateFactoryFn: (settings: ParseSettings<S>, lexerSnapshot: LexerSnapshot) => S,
): TriedParse<S> {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    Assert.isUndefined(Lexer.maybeErrorLineMap(lexerState));

    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(lexerState);
    Assert.isOk(triedSnapshot);
    const lexerSnapshot: LexerSnapshot = triedSnapshot.value;

    return IParserUtils.tryRead(stateFactoryFn(settings, lexerSnapshot), settings.parser);
}
