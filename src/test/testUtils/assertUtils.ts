// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, Inspection, Lexer, Task } from "../..";
import { AutocompleteOption, Position, TriedAutocomplete } from "../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../inspection/activeNode";
import { Keyword } from "../../language";
import {
    IParserState,
    IParserStateUtils,
    IParserUtils,
    NodeIdMap,
    ParseContext,
    ParseError,
    ParseOk,
    TriedParse,
} from "../../parser";
import { CommonSettings, LexSettings, ParseSettings } from "../../settings";

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

    return IParserUtils.tryParse<S>(settings, lexerSnapshot, stateFactoryFn) as TriedParse<S>;
}

export function assertGetParseOkAutocompleteOk(
    settings: LexSettings & ParseSettings<IParserState>,
    text: string,
    position: Position,
): ReadonlyArray<AutocompleteOption> {
    const parseOk: ParseOk = assertGetParseOk(settings, text, IParserStateUtils.stateFactory);
    const contextState: ParseContext.State = parseOk.state.contextState;
    return assertGetAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        undefined,
    );
}

export function assertGetParseErrAutocompleteOk(
    settings: LexSettings & ParseSettings<IParserState>,
    text: string,
    position: Position,
): ReadonlyArray<AutocompleteOption> {
    const parseError: ParseError.ParseError = assertGetParseErr(settings, text, IParserStateUtils.stateFactory);
    const contextState: ParseContext.State = parseError.state.contextState;

    return assertGetAutocompleteOk(
        settings,
        contextState.nodeIdMapCollection,
        contextState.leafNodeIds,
        position,
        parseError,
    );
}

export function assertGetAutocompleteOk<S extends IParserState>(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
    maybeParseError: ParseError.ParseError<S> | undefined,
): ReadonlyArray<AutocompleteOption> {
    const maybeActiveNode: ActiveNode | undefined = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (maybeActiveNode === undefined) {
        return Keyword.StartOfDocumentKeywords;
    }

    const triedInspect: TriedAutocomplete = Inspection.tryAutocomplete(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        {
            scopeById: new Map(),
            typeById: new Map(),
        },
        maybeActiveNode,
        maybeParseError,
    );
    Assert.isOk(triedInspect);
    return triedInspect.value;
}
