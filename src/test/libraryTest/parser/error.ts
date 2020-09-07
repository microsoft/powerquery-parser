// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert } from "../../../common";
import { DefaultTemplates, Localization } from "../../../localization";
import { IParser, IParserState, IParserStateUtils, ParseError } from "../../../parser";
import { RecursiveDescentParser } from "../../../parser/parsers";
import { DefaultSettings, Settings } from "../../../settings";
import { TestAssertUtils } from "../../testUtils";

function assertGetCsvContinuationError(text: string): ParseError.ExpectedCsvContinuationError {
    const innerError: ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
        DefaultSettings,
        text,
        IParserStateUtils.stateFactory,
    ).innerError;
    Assert.isTrue(
        innerError instanceof ParseError.ExpectedCsvContinuationError,
        "innerError instanceof ParseError.ExpectedCsvContinuationError",
    );

    return innerError as ParseError.ExpectedCsvContinuationError;
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", () => {
        const text: string = "(optional x, y) => x";
        const innerError: ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
            DefaultSettings,
            text,
            IParserStateUtils.stateFactory,
        ).innerError;
        expect(innerError instanceof ParseError.RequiredParameterAfterOptionalParameterError).to.equal(
            true,
            innerError.message,
        );
    });

    it("UnterminatedBracketError: let x = [", () => {
        const text: string = "let x = [";
        const innerError: ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
            DefaultSettings,
            text,
            IParserStateUtils.stateFactory,
        ).innerError;
        expect(innerError instanceof ParseError.UnterminatedBracketError).to.equal(true, innerError.message);
    });

    it("UnterminatedParenthesesError: let x = (", () => {
        const text: string = "let x = (";
        const innerError: ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
            DefaultSettings,
            text,
            IParserStateUtils.stateFactory,
        ).innerError;
        expect(innerError instanceof ParseError.UnterminatedParenthesesError).to.equal(true, innerError.message);
    });

    describe(`UnusedTokensRemainError`, () => {
        it("default parser", () => {
            const text: string = "1 1";
            const innerError: ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
                DefaultSettings,
                text,
                IParserStateUtils.stateFactory,
            ).innerError;
            expect(innerError instanceof ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });

        it("custom start", () => {
            const customParser: IParser<IParserState> = {
                ...RecursiveDescentParser,
                read: RecursiveDescentParser.readIdentifier,
            };
            const customSettings: Settings = {
                ...DefaultSettings,
                parser: customParser,
            };
            const text: string = "a b";
            const innerError: ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
                customSettings,
                text,
                IParserStateUtils.stateFactory,
            ).innerError;
            expect(innerError instanceof ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });
    });

    it(`Dangling Comma for LetExpression`, () => {
        const text: string = "let a = 1, in 1";
        const continuationError: ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(DefaultTemplates, ParseError.CsvContinuationKind.LetExpression),
        );
    });

    it(`Dangling Comma for ListExpression`, () => {
        const text: string = "{1, }";
        const continuationError: ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(DefaultTemplates, ParseError.CsvContinuationKind.DanglingComma),
        );
    });

    it(`Dangling Comma for FunctionExpression`, () => {
        const text: string = "(a, ) => a";
        const continuationError: ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(DefaultTemplates, ParseError.CsvContinuationKind.DanglingComma),
        );
    });

    it(`Dangling Comma for FunctionType`, () => {
        const text: string = "type function (a as number, ) as number";
        const continuationError: ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(DefaultTemplates, ParseError.CsvContinuationKind.DanglingComma),
        );
    });

    it(`Dangling Comma for RecordExpression`, () => {
        const text: string = "[a = 1,]";
        const continuationError: ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(DefaultTemplates, ParseError.CsvContinuationKind.DanglingComma),
        );
    });

    it(`Dangling Comma for RecordType`, () => {
        const text: string = "type [a = 1,]";
        const continuationError: ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(DefaultTemplates, ParseError.CsvContinuationKind.DanglingComma),
        );
    });

    it(`Dangling Comma for TableType`, () => {
        const text: string = "type table [a = 1,]";
        const continuationError: ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(DefaultTemplates, ParseError.CsvContinuationKind.DanglingComma),
        );
    });
});
