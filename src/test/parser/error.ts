// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultKind } from "../../common";
import { TriedLexParse, tryLexParse } from "../../jobs";
import * as Localization from "../../localization/error";
import { ParseError, Parser } from "../../parser";

function expectParserInnerError(text: string): ParseError.TInnerParseError {
    const triedLexParse: TriedLexParse = tryLexParse(text, Parser.CombinatorialParser);

    if (!(triedLexParse.kind === ResultKind.Err)) {
        throw new Error(`AssertFailed: triedLexParse.kind === ResultKind.Err ${JSON.stringify(triedLexParse)}`);
    } else if (!(triedLexParse.error instanceof ParseError.ParseError)) {
        const errorMessage: string = triedLexParse.error.message;
        throw new Error(`AssertFailed: triedLexParse.error instanceof ParserError - ${errorMessage}`);
    } else {
        return triedLexParse.error.innerError;
    }
}

function expectCsvContinuationError(text: string): ParseError.ExpectedCsvContinuationError {
    const innerError: ParseError.TInnerParseError = expectParserInnerError(text);
    if (!(innerError instanceof ParseError.ExpectedCsvContinuationError)) {
        throw new Error(
            `AssertFailed: innerError instanceof ParserError.ExpectedCsvContinuationError - ${innerError.message}`,
        );
    }

    return innerError;
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", () => {
        const text: string = "(optional x, y) => x";
        const innerError: ParseError.TInnerParseError = expectParserInnerError(text);
        expect(innerError instanceof ParseError.RequiredParameterAfterOptionalParameterError).to.equal(
            true,
            innerError.message,
        );
    });

    it("UnterminatedBracketError: let x = [", () => {
        const text: string = "let x = [";
        const innerError: ParseError.TInnerParseError = expectParserInnerError(text);
        expect(innerError instanceof ParseError.UnterminatedBracketError).to.equal(true, innerError.message);
    });

    it("UnterminatedParenthesesError: let x = (", () => {
        const text: string = "let x = (";
        const innerError: ParseError.TInnerParseError = expectParserInnerError(text);
        expect(innerError instanceof ParseError.UnterminatedParenthesesError).to.equal(true, innerError.message);
    });

    it("UnusedTokensRemainError: 1 1", () => {
        const text: string = "1 1";
        const innerError: ParseError.TInnerParseError = expectParserInnerError(text);
        expect(innerError instanceof ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
    });

    it(`Dangling Comma for LetExpression`, () => {
        const text: string = "let a = 1, in 1";
        const continuationError: ParseError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationLetExpression());
    });

    it(`Dangling Comma for ListExpression`, () => {
        const text: string = "{1, }";
        const continuationError: ParseError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for FunctionExpression`, () => {
        const text: string = "(a, ) => a";
        const continuationError: ParseError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for FunctionType`, () => {
        const text: string = "type function (a as number, ) as number";
        const continuationError: ParseError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for RecordExpression`, () => {
        const text: string = "[a = 1,]";
        const continuationError: ParseError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for RecordType`, () => {
        const text: string = "type [a = 1,]";
        const continuationError: ParseError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });

    it(`Dangling Comma for TableType`, () => {
        const text: string = "type table [a = 1,]";
        const continuationError: ParseError.ExpectedCsvContinuationError = expectCsvContinuationError(text);
        expect(continuationError.message).to.equal(Localization.parserExpectedCsvContinuationDanglingComma());
    });
});
