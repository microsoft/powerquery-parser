// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Inspection } from "../..";
import { Option, ResultKind } from "../../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../lexer";
import { IParserState, IParserStateUtils, ParseError, ParseOk, Parser, TriedParse } from "../../parser";

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

export function expectParseOkInspection(text: string, position: Inspection.Position): Inspection.TriedInspection {
    const parseOk: ParseOk = expectParseOk(text);
    return Inspection.tryFrom(position, parseOk.nodeIdMapCollection, parseOk.leafNodeIds);
}

export function expectParseErrInspection(text: string, position: Inspection.Position): Inspection.TriedInspection {
    const parseError: ParseError.ParseError = expectParseErr(text);
    return Inspection.tryFrom(position, parseError.context.nodeIdMapCollection, parseError.context.leafNodeIds);
}

export function expectParseErr(text: string): ParseError.ParseError {
    const triedParse: TriedParse = expectTriedParse(text);
    if (!(triedParse.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Err`);
    }

    if (!(triedParse.error instanceof ParseError.ParseError)) {
        throw new Error(`AssertFailed: triedParse.error instanceof ParseError: ${triedParse.error.message}`);
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
