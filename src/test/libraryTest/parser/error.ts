// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Assert, DefaultSettings, Lexer, Localization, Parser, Settings, Templates } from "../../..";
import { TestAssertUtils } from "../../testUtils";

const DefaultSettingsWithStrict: Settings = {
    ...DefaultSettings,
    createParseState: (
        lexerSnapshot: Lexer.LexerSnapshot,
        maybeOverrides: Parser.TCreateParseStateOverrides<Parser.IParseState> | undefined,
    ) => {
        maybeOverrides = maybeOverrides ?? {};
        return Parser.IParseStateUtils.createState(lexerSnapshot, {
            ...maybeOverrides,
            disambiguationBehavior:
                maybeOverrides.disambiguationBehavior ?? Parser.Disambiguation.DismabiguationBehavior.Strict,
        });
    },
};

function assertGetCsvContinuationError(text: string): Parser.ParseError.ExpectedCsvContinuationError {
    const innerError: Parser.ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
        DefaultSettingsWithStrict,
        text,
    ).innerError;
    Assert.isTrue(
        innerError instanceof Parser.ParseError.ExpectedCsvContinuationError,
        "innerError instanceof ParseError.ExpectedCsvContinuationError",
    );

    return innerError as Parser.ParseError.ExpectedCsvContinuationError;
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", () => {
        const text: string = "(optional x, y) => x";
        const innerError: Parser.ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
            DefaultSettingsWithStrict,
            text,
        ).innerError;
        expect(innerError instanceof Parser.ParseError.RequiredParameterAfterOptionalParameterError).to.equal(
            true,
            innerError.message,
        );
    });

    it("UnterminatedSequence (Bracket): let x = [", () => {
        const text: string = "let x = [";
        const innerError: Parser.ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
            DefaultSettingsWithStrict,
            text,
        ).innerError;
        expect(innerError instanceof Parser.ParseError.UnterminatedSequence).to.equal(true, innerError.message);
        expect((innerError as Parser.ParseError.UnterminatedSequence).kind).to.equal(
            Parser.ParseError.SequenceKind.Bracket,
            innerError.message,
        );
    });

    it("UnterminatedSequence (Parenthesis): let x = (1", () => {
        const text: string = "let x = (1";
        const innerError: Parser.ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
            DefaultSettingsWithStrict,
            text,
        ).innerError;
        expect(innerError instanceof Parser.ParseError.UnterminatedSequence).to.equal(true, innerError.message);
        expect((innerError as Parser.ParseError.UnterminatedSequence).kind).to.equal(
            Parser.ParseError.SequenceKind.Parenthesis,
            innerError.message,
        );
    });

    describe(`UnusedTokensRemainError`, () => {
        it("default parser", () => {
            const text: string = "1 1";
            const innerError: Parser.ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
                DefaultSettingsWithStrict,
                text,
            ).innerError;
            expect(innerError instanceof Parser.ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });

        it("custom start", () => {
            const customSettings: Settings = {
                ...DefaultSettings,
                parser: Parser.RecursiveDescentParser,
                maybeParserEntryPointFn: Parser.RecursiveDescentParser.readIdentifier,
            };
            const text: string = "a b";
            const innerError: Parser.ParseError.TInnerParseError = TestAssertUtils.assertGetParseErr(
                customSettings,
                text,
            ).innerError;
            expect(innerError instanceof Parser.ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });
    });

    it(`Dangling Comma for LetExpression`, () => {
        const text: string = "let a = 1, in 1";
        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.LetExpression,
            ),
        );
    });

    it(`Dangling Comma for ListExpression`, () => {
        const text: string = "{1, }";
        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for FunctionExpression`, () => {
        const text: string = "(a, ) => a";
        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for FunctionType`, () => {
        const text: string = "type function (a as number, ) as number";
        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for RecordExpression`, () => {
        const text: string = "[a = 1,]";
        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for RecordType`, () => {
        const text: string = "type [a = 1,]";
        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for TableType`, () => {
        const text: string = "type table [a = 1,]";
        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = assertGetCsvContinuationError(text);
        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });
});
