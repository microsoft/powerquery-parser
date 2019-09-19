// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultKind } from "../../common";
import { TriedLexAndParse, tryLexAndParse } from "../../jobs";
import * as Localization from "../../localization/error";
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

function expectCsvContinuationError(text: string): ParserError.ExpectedCsvContinuationError {
    const innerError: ParserError.TInnerParserError = expectParserInnerError(text);
    if (!(innerError instanceof ParserError.ExpectedCsvContinuationError)) {
        throw new Error(`AssertFailed: innerError instanceof ParserError.ExpectedCsvContinuationError`);
    }

    return innerError;
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

    it(`Dangling Comma for Let`, () => {
        const text: string = "let in 1, in 1";
        const continuationError: ParserError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationLetExpression());
    });

    it(`Dangling Comma for ListExpression`, () => {
        const text: string = "{1, }";
        const continuationError: ParserError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for RecordExpression`, () => {
        const text: string = "[a = 1,]";
        const continuationError: ParserError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for RecordType`, () => {
        const text: string = "type [a = 1,]";
        const continuationError: ParserError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for TableType`, () => {
        const text: string = "type table [a = 1,]";
        const continuationError: ParserError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });
});
