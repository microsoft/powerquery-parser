// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Option, ResultKind } from "../../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../lexer";
import { Parser, ParserError } from "../../parser";

export function expectParseErr(text: string): ParserError.ParserError {
    const triedParse: Parser.TriedParse = expectTriedParse(text);
    if (!(triedParse.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Err`);
    }

    if (!(triedParse.error instanceof ParserError.ParserError)) {
        throw new Error(`AssertFailed: triedParse.error instanceof ParserError: ${triedParse.error.message}`);
    }

    return triedParse.error;
}

export function expectParseOk(text: string): Parser.ParseOk {
    const triedParse: Parser.TriedParse = expectTriedParse(text);
    if (!(triedParse.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Ok: ${triedParse.error.message}`);
    }
    return triedParse.value;
}

function expectTriedParse(text: string): Parser.TriedParse {
    const state: Lexer.State = Lexer.stateFrom(text);
    const maybeErrorLineMap: Option<Lexer.ErrorLineMap> = Lexer.maybeErrorLineMap(state);
    if (!(maybeErrorLineMap === undefined)) {
        throw new Error(`AssertFailed: maybeErrorLineMap === undefined`);
    }

    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(state);
    if (!(triedSnapshot.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedSnapshot.kind === ResultKind.Ok: ${triedSnapshot.error.message}`);
    }
    const snapshot: LexerSnapshot = triedSnapshot.value;

    return Parser.tryParse(snapshot);
}
