// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "..";
import { ResultUtils } from "../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../lexer";
import { IParserState, ParseError, ParseOk, TriedParse } from "../parser";
import { DefaultSettings, LexSettings, ParseSettings } from "../settings";
import { LexParseOk, TriedLexParse, tryLexParse } from "../tasks";

export function expectDeepEqual<X, Y>(partial: X, expected: Y, actualFactoryFn: (partial: X) => Y): void {
    const actual: Y = actualFactoryFn(partial);
    expect(actual).deep.equal(expected);
}

// Only works with single line expressions
export function expectTextWithPosition(text: string): [string, Inspection.Position] {
    const indexOfBar: number = text.indexOf("|");

    expect(indexOfBar).to.be.greaterThan(-1, "text must have | marker");
    expect(indexOfBar).to.equal(text.lastIndexOf("|"), "text must have one and only one '|'");

    const position: Inspection.Position = {
        lineNumber: 0,
        lineCodeUnit: indexOfBar,
    };

    return [text.replace("|", ""), position];
}

export function expectParseOkInspection<T>(
    settings: LexSettings & ParseSettings<T & IParserState>,
    text: string,
    position: Inspection.Position,
): Inspection.TriedInspection {
    const parseOk: ParseOk = expectParseOk(settings, text);
    return Inspection.tryFrom(DefaultSettings, position, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, undefined);
}

export function expectParseErrInspection<T>(
    settings: LexSettings & ParseSettings<T & IParserState>,
    text: string,
    position: Inspection.Position,
): Inspection.TriedInspection {
    const parseError: ParseError.ParseError = expectParseErr(settings, text);
    return Inspection.tryFrom(
        DefaultSettings,
        position,
        parseError.context.nodeIdMapCollection,
        parseError.context.leafNodeIds,
        parseError,
    );
}

export function expectLexParseOk(text: string): LexParseOk {
    const triedLexParse: TriedLexParse = tryLexParse(DefaultSettings, text);
    if (!ResultUtils.isOk(triedLexParse)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedLexParse): ${triedLexParse.error.message}`);
    }
    return triedLexParse.value;
}

export function expectParseErr<T>(
    settings: LexSettings & ParseSettings<T & IParserState>,
    text: string,
): ParseError.ParseError {
    const triedParse: TriedParse = expectTriedParse(settings, text);
    if (!ResultUtils.isErr(triedParse)) {
        throw new Error(`AssertFailed: ResultUtils.Err(triedParse)`);
    }

    if (!(triedParse.error instanceof ParseError.ParseError)) {
        throw new Error(`AssertFailed: triedParse.error instanceof ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function expectParseOk<T>(settings: LexSettings & ParseSettings<T & IParserState>, text: string): ParseOk {
    const triedParse: TriedParse = expectTriedParse(settings, text);
    if (!ResultUtils.isOk(triedParse)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedParse): ${triedParse.error.message}`);
    }
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function expectTriedParse<T>(settings: LexSettings & ParseSettings<T & IParserState>, text: string): TriedParse {
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

    const parserState: T & IParserState = settings.newParserState(settings, lexerSnapshot);
    return settings.parser.readDocument(parserState, settings.parser);
}
