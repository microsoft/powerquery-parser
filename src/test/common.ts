// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection, Task } from "..";
import { ResultUtils } from "../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../lexer";
import { IParserState, ParseError, ParseOk, TriedParse } from "../parser";
import { LexSettings, ParseSettings } from "../settings";

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
): Task.LexParseOk<S & IParserState> {
    const triedLexParse: Task.TriedLexParse<S & IParserState> = Task.tryLexParse(settings, text);
    if (!ResultUtils.isOk(triedLexParse)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedLexParse): ${triedLexParse.error.message}`);
    }
    return triedLexParse.value;
}

export function expectParseErr<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): ParseError.ParseError<S & IParserState> {
    const triedParse: TriedParse<S & IParserState> = expectTriedParse(settings, text);
    if (!ResultUtils.isErr(triedParse)) {
        throw new Error(`AssertFailed: ResultUtils.Err(triedParse)`);
    }

    if (!(triedParse.error instanceof ParseError.ParseError)) {
        throw new Error(`AssertFailed: triedParse.error instanceof ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function expectParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): ParseOk<S & IParserState> {
    const triedParse: TriedParse<S & IParserState> = expectTriedParse(settings, text);
    if (!ResultUtils.isOk(triedParse)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedParse): ${triedParse.error.message}`);
    }
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function expectTriedParse<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): TriedParse<S & IParserState> {
    const lexerState: Lexer.State = Lexer.stateFrom(settings, text);
    const maybeErrorLineMap: Lexer.ErrorLineMap | undefined = Lexer.maybeErrorLineMap(lexerState);
    if (!(maybeErrorLineMap === undefined)) {
        throw new Error(`AssertFailed: maybeErrorLineMap === undefined`);
    }

    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(lexerState);
    if (!ResultUtils.isOk(triedSnapshot)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedSnapshot): ${triedSnapshot.error.message}`);
    }
    const lexerSnapshot: LexerSnapshot = triedSnapshot.value;

    const parserState: S = settings.newParserState(settings, lexerSnapshot);
    return settings.parser.readDocument(parserState, settings.parser);
}
