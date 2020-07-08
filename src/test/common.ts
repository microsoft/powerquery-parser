// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Task } from "..";
import { Assert } from "../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../lexer";
import { IParserState, IParserUtils, ParseError, ParseOk, TriedParse } from "../parser";
import { LexSettings, ParseSettings } from "../settings";

export function assertParseError<S extends IParserState = IParserState>(
    error: Error,
): asserts error is ParseError.ParseError<S> {
    if (!ParseError.isParseError(error)) {
        throw new Error(`expected triedParse to return a ParseError.ParseError`);
    }
}

export function expectDeepEqual<X, Y>(partial: X, expected: Y, actualFactoryFn: (partial: X) => Y): void {
    const actual: Y = actualFactoryFn(partial);
    expect(actual).deep.equal(expected);
}

// Only works with single line expressions
export function expectTextWithPosition(text: string): [string, Inspection.Position] {
    const indexOfPipe: number = text.indexOf("|");

    expect(indexOfPipe).to.be.greaterThan(-1, "text must have | marker");
    expect(indexOfPipe).to.equal(text.lastIndexOf("|"), "text must have one and only one '|'");

    const position: Inspection.Position = {
        lineNumber: 0,
        lineCodeUnit: indexOfPipe,
    };

    return [text.replace("|", ""), position];
}

export function expectLexParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): Task.LexParseOk<S> {
    const triedLexParse: Task.TriedLexParse<S> = Task.tryLexParse(settings, text);
    Assert.isOk(triedLexParse);
    return triedLexParse.value;
}

export function expectParseErr<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): ParseError.ParseError<S> {
    const triedParse: TriedParse<S> = expectTriedParse(settings, text);
    Assert.isErr(triedParse);
    assertParseError(triedParse.error);
    return triedParse.error;
}

export function expectParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): ParseOk<S> {
    const triedParse: TriedParse<S> = expectTriedParse(settings, text);
    Assert.isOk(triedParse);
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function expectTriedParse<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): TriedParse<S> {
    const lexerState: Lexer.State = Lexer.stateFrom(settings, text);
    Assert.isUndefined(Lexer.maybeErrorLineMap(lexerState));

    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(lexerState);
    Assert.isOk(triedSnapshot);
    const lexerSnapshot: LexerSnapshot = triedSnapshot.value;

    const parserState: S = settings.newParserState(settings, lexerSnapshot);
    return IParserUtils.tryRead(parserState, settings.parser);
}
