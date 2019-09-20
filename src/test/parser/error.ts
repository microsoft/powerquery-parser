// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultKind } from "../../common";
import { TriedLexAndParse, tryLexAndParse } from "../../jobs";
import { ParserError } from "../../parser";

function expectParserInnerError(text: string): ParserError.TInnerParserError {
    const triedLexAndParse: TriedLexAndParse = tryLexAndParse(text);

    if (!(triedLexAndParse.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: triedLexAndParse.kind === ResultKind.Err ${JSON.stringify(triedLexAndParse)}`);
    } else if (!(triedLexAndParse.error instanceof ParserError.ParserError)) {
        const errorMessage: string = triedLexAndParse.error.message;
        throw new Error(`AssertFailed: triedLexAndParse.error instanceof ParserError: ${errorMessage}`);
    } else {
        return triedLexAndParse.error.innerError;
    }
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", () => {
        const text: string = "(optional x, y) => x";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.RequiredParameterAfterOptionalParameterError).to.equal(
            true,
            innerError.message,
        );
    });

    it("UnterminatedBracketError: let x = [", () => {
        const text: string = "let x = [";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.UnterminatedBracketError).to.equal(true, innerError.message);
    });

    it("UnterminatedParenthesesError: let x = (", () => {
        const text: string = "let x = (";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.UnterminatedParenthesesError).to.equal(true, innerError.message);
    });

    it("UnusedTokensRemainError: 1 1", () => {
        const text: string = "1 1";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.UnusedTokensRemainError).to.equal(true, innerError.message);
    });

    it("LetExpression requires at least one parameter: let in 1", () => {
        const text: string = "let in 1";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });

    it("ListType requires at least one parameter: type list {}", () => {
        const text: string = "let in 1";
        const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
        expect(innerError instanceof ParserError.ExpectedTokenKindError).to.equal(true, innerError.message);
    });
});
