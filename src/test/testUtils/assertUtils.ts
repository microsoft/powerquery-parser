// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, Inspection, Lexer, LexSettings, Parser, ParseSettings, Task } from "../..";
import { InspectionSettings } from "../../powerquery-parser";

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

export function assertGetLexParseOk<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): Task.LexParseOk<S> {
    const triedLexParse: Task.TriedLexParse<S> = Task.tryLexParse(settings, text);
    Assert.isOk(triedLexParse);
    return triedLexParse.value;
}

export function assertGetParseErr<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): Parser.ParseError.ParseError<S> {
    const triedParse: Parser.TriedParse<S> = assertGetTriedParse(settings, text);
    Assert.isErr(triedParse);

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

export function assertGetParseOkAutocompleteOk<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.Autocomplete {
    const parseOk: Parser.ParseOk<S> = assertGetParseOk(settings, text);
    return assertGetAutocompleteOk(settings, parseOk.state, position, undefined);
}

export function assertGetParseErrAutocompleteOk<S extends Parser.IParseState = Parser.IParseState>(
    settings: LexSettings & ParseSettings<S> & InspectionSettings,
    text: string,
    position: Inspection.Position,
): Inspection.Autocomplete {
    const parseError: Parser.ParseError.ParseError<S> = assertGetParseErr(settings, text);
    return assertGetAutocompleteOk(settings, parseError.state, position, parseError);
}

export function assertGetAutocompleteOk<S extends Parser.IParseState = Parser.IParseState>(
    settings: InspectionSettings,
    parseState: S,
    position: Inspection.Position,
    maybeParseError: Parser.ParseError.ParseError<S> | undefined,
): Inspection.Autocomplete {
    const maybeActiveNode: Inspection.TMaybeActiveNode = Inspection.ActiveNodeUtils.maybeActiveNode(
        parseState.contextState.nodeIdMapCollection,
        parseState.contextState.leafNodeIds,
        position,
    );
    return Inspection.autocomplete(
        settings,
        parseState,
        {
            scopeById: new Map(),
            typeById: new Map(),
        },
        maybeActiveNode,
        maybeParseError,
    );
}
