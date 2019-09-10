// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultKind } from "../../common";
import { Lexer, LexerSnapshot, TriedLexerSnapshot } from "../../lexer";
import { IParserState, IParserStateUtils, ParserError, TriedParse } from "../../parser";
import { TokenWithColumnNumber } from "../../parser/error";
import { CombinatorialParser } from "../../parser/parsers";

function expectExpectedTokenKindError(text: string): ParserError.ExpectedTokenKindError {
    const lexerState: Lexer.State = Lexer.stateFrom(text);
    const triedSnapshot: TriedLexerSnapshot = LexerSnapshot.tryFrom(lexerState);

    if (!(triedSnapshot.kind === ResultKind.Ok)) {
        throw new Error(`AssertFailed: triedSnapshot.kind === ResultKind.Ok`);
    }
    const lexerSnapshot: LexerSnapshot = triedSnapshot.value;

    const parserState: IParserState = IParserStateUtils.newState(lexerSnapshot);
    const triedParse: TriedParse = CombinatorialParser.readDocument(parserState, CombinatorialParser);

    if (!(triedParse.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: triedParse.kind === ResultKind.Err`);
    }
    const error: ParserError.TParserError = triedParse.error;

    if (!(error instanceof ParserError.ParserError)) {
        const details: {} = {
            error2json: JSON.stringify(error, undefined, 4),
            message: error.message,
        };
        throw new Error(`AssertFailed: error instanceof ParserError.ParserError - ${details}`);
    }
    const innerError: ParserError.TInnerParserError = error.innerError;

    if (!(innerError instanceof ParserError.ExpectedTokenKindError)) {
        const details: {} = {
            innerError2json: JSON.stringify(innerError, undefined, 4),
            message: innerError.message,
        };
        throw new Error(`AssertFailed: innerError instanceof ParserError.ExpectedTokenKindError - ${details}`);
    }

    return innerError;
}

function expectErrorAt(text: string, lineNumber: number, columnNumber: number, codeUnit: number): void {
    const error: ParserError.ExpectedTokenKindError = expectExpectedTokenKindError(text);

    if (!(error.maybeFoundToken !== undefined)) {
        throw new Error(`AssertFailed: error.maybeFoundToken !== undefined`);
    }
    const foundToken: TokenWithColumnNumber = error.maybeFoundToken;

    expect(foundToken.token.positionStart.codeUnit).to.equal(codeUnit, "codeUnit");
    expect(foundToken.token.positionStart.lineNumber).to.equal(lineNumber, "lineNumber");
    expect(foundToken.columnNumber).to.equal(columnNumber, "columnNumber");
}

describe(`Parser.ColumnNumber`, () => {
    it(`if x foo`, () => {
        expectErrorAt(`if x foo`, 0, 5, 5);
    });

    it(`if x \\nfoo`, () => {
        expectErrorAt(`if x \nfoo`, 1, 0, 6);
    });

    it(`if x \\n foo`, () => {
        expectErrorAt(`if x \n foo`, 1, 1, 7);
    });

    it(`if \u006E\u0303 foo`, () => {
        expectErrorAt(`if \u006E\u0303 foo`, 0, 5, 6);
    });

    it(`if \u006E\u0303 \\nfoo`, () => {
        expectErrorAt(`if \u006E\u0303 \nfoo`, 1, 0, 7);
    });

    it(`if \u006E\u0303 \\n foo`, () => {
        expectErrorAt(`if \u006E\u0303 \n foo`, 1, 1, 8);
    });
});
