// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Option, ResultKind } from "../../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../lexer";
import { IParserState, IParserStateUtils, ParseOk, Parser, ParserError, TriedParse } from "../../parser";

export function expectParseErr(text: string): ParserError.ParserError {
    const triedParse: TriedParse = expectTriedParse(text);
    if (!(triedParse.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Err`);
    }

    if (!(triedParse.error instanceof ParserError.ParserError)) {
        throw new Error(`AssertFailed: triedParse.error instanceof ParserError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function expectParseOk(text: string): ParseOk {
    const triedParse: TriedParse = expectTriedParse(text);
    if (!(triedParse.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Ok: ${triedParse.error.message}`);
    }
    return triedParse.value;
}

function expectTriedParse(text: string): TriedParse {
    const lexerState: Lexer.State = Lexer.stateFrom(text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(lexerState);
    if (!(maybeErrorLineMap === undefined)) {
        throw new Error(`AssertFailed: maybeErrorLineMap === undefined`);
    }

    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(lexerState);
    if (!(triedSnapshot.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedSnapshot.kind === ResultKind.Ok: ${triedSnapshot.error.message}`);
    }
    const lexerSnapshot: LexerSnapshot = triedSnapshot.value;

    const parserState: IParserState = IParserStateUtils.newState(lexerSnapshot);
    return Parser.CombinatorialParser.readDocument(parserState, Parser.CombinatorialParser);
}
