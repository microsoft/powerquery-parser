// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, Inspection, Lexer, Task } from "../..";
import { Autocomplete, Position } from "../../inspection";
import { ActiveNode, ActiveNodeKind, ActiveNodeUtils, TMaybeActiveNode } from "../../inspection/activeNode";
import { IParserState, IParserUtils, ParseError, ParseOk, TriedParse } from "../../parser";
import { LexSettings, ParseSettings } from "../../settings";

export function assertIsActiveNode(maybeActiveNode: TMaybeActiveNode): asserts maybeActiveNode is ActiveNode {
    expect(maybeActiveNode.kind).to.equal(ActiveNodeKind.ActiveNode);
}

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
): Task.LexParseOk<S> {
    const triedLexParse: Task.TriedLexParse<S> = Task.tryLexParse(settings, text);
    Assert.isOk(triedLexParse);
    return triedLexParse.value;
}

export function assertGetParseErr<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): ParseError.ParseError<S> {
    const triedParse: TriedParse<S> = assertGetTriedParse(settings, text);
    Assert.isErr(triedParse);

    if (!ParseError.isParseError(triedParse.error)) {
        throw new Error(`expected triedParse to return a ParseError.ParseError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function assertGetParseOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): ParseOk<S> {
    const triedParse: TriedParse<S> = assertGetTriedParse(settings, text);
    Assert.isOk(triedParse);
    return triedParse.value;
}

// I only care about errors coming from the parse stage.
// If I use tryLexParse I might get a CommonError which could have come either from lexing or parsing.
function assertGetTriedParse<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
): TriedParse<S> {
    const triedLex: Lexer.TriedLex = Lexer.tryLex(settings, text);
    Assert.isOk(triedLex);
    const lexerState: Lexer.State = triedLex.value;
    Assert.isUndefined(Lexer.maybeErrorLineMap(lexerState));

    const triedSnapshot: Lexer.TriedLexerSnapshot = Lexer.trySnapshot(lexerState);
    Assert.isOk(triedSnapshot);
    const lexerSnapshot: Lexer.LexerSnapshot = triedSnapshot.value;

    return IParserUtils.tryParse<S>(settings, lexerSnapshot);
}

export function assertGetParseOkAutocompleteOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): Autocomplete {
    const parseOk: ParseOk<S> = assertGetParseOk(settings, text);
    return assertGetAutocompleteOk(settings, parseOk.state, position, undefined);
}

export function assertGetParseErrAutocompleteOk<S extends IParserState = IParserState>(
    settings: LexSettings & ParseSettings<S>,
    text: string,
    position: Position,
): Autocomplete {
    const parseError: ParseError.ParseError<S> = assertGetParseErr(settings, text);
    return assertGetAutocompleteOk(settings, parseError.state, position, parseError);
}

export function assertGetAutocompleteOk<S extends IParserState = IParserState>(
    parseSettings: ParseSettings<S>,
    parserState: S,
    position: Position,
    maybeParseError: ParseError.ParseError<S> | undefined,
): Autocomplete {
    const maybeActiveNode: TMaybeActiveNode = ActiveNodeUtils.maybeActiveNode(
        parserState.contextState.nodeIdMapCollection,
        parserState.contextState.leafNodeIds,
        position,
    );
    return Inspection.autocomplete(
        parseSettings,
        parserState,
        {
            scopeById: new Map(),
            typeById: new Map(),
        },
        maybeActiveNode,
        maybeParseError,
    );
}
