// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Lexer, Localization, Parser, Settings, Templates } from "../../..";
import { TestAssertUtils } from "../../testUtils";

const DefaultSettingsWithStrict: Settings = {
    ...DefaultSettings,
    createParseState: (lexerSnapshot: Lexer.LexerSnapshot, maybeOverrides: Partial<Parser.ParseState> | undefined) => {
        maybeOverrides = maybeOverrides ?? {};

        return Parser.ParseStateUtils.createState(lexerSnapshot, {
            ...maybeOverrides,
            disambiguationBehavior:
                maybeOverrides.disambiguationBehavior ?? Parser.Disambiguation.DismabiguationBehavior.Strict,
        });
    },
};

async function assertGetCsvContinuationError(text: string): Promise<Parser.ParseError.ExpectedCsvContinuationError> {
    const innerError: Parser.ParseError.TInnerParseError = (
        await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
    ).innerError;

    Assert.isTrue(
        innerError instanceof Parser.ParseError.ExpectedCsvContinuationError,
        "innerError instanceof ParseError.ExpectedCsvContinuationError",
    );

    return innerError as Parser.ParseError.ExpectedCsvContinuationError;
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", async () => {
        const text: string = "(optional x, y) => x";

        const innerError: Parser.ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof Parser.ParseError.RequiredParameterAfterOptionalParameterError).to.equal(
            true,
            innerError.message,
        );
    });

    it("UnterminatedSequence (Bracket): let x = [", async () => {
        const text: string = "let x = [";

        const innerError: Parser.ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof Parser.ParseError.UnterminatedSequence).to.equal(true, innerError.message);

        expect((innerError as Parser.ParseError.UnterminatedSequence).kind).to.equal(
            Parser.ParseError.SequenceKind.Bracket,
            innerError.message,
        );
    });

    it("UnterminatedSequence (Parenthesis): let x = (1", async () => {
        const text: string = "let x = (1";

        const innerError: Parser.ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof Parser.ParseError.UnterminatedSequence).to.equal(true, innerError.message);

        expect((innerError as Parser.ParseError.UnterminatedSequence).kind).to.equal(
            Parser.ParseError.SequenceKind.Parenthesis,
            innerError.message,
        );
    });

    describe(`UnusedTokensRemainError`, () => {
        it("default parser", async () => {
            const text: string = "1 1";

            const innerError: Parser.ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof Parser.ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });

        it("custom start", async () => {
            const customSettings: Settings = {
                ...DefaultSettings,
                parser: Parser.RecursiveDescentParser,
                maybeParserEntryPointFn: () => Parser.RecursiveDescentParser.readIdentifier,
            };

            const text: string = "a b";

            const innerError: Parser.ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(customSettings, text)
            ).innerError;

            expect(innerError instanceof Parser.ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });
    });

    it(`Dangling Comma for LetExpression`, async () => {
        const text: string = "let a = 1, in 1";

        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
            text,
        );

        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.LetExpression,
            ),
        );
    });

    it(`Dangling Comma for ListExpression`, async () => {
        const text: string = "{1, }";

        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
            text,
        );

        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for FunctionExpression`, async () => {
        const text: string = "(a, ) => a";

        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
            text,
        );

        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for FunctionType`, async () => {
        const text: string = "type function (a as number, ) as number";

        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
            text,
        );

        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for RecordExpression`, async () => {
        const text: string = "[a = 1,]";

        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
            text,
        );

        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for RecordType`, async () => {
        const text: string = "type [a = 1,]";

        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
            text,
        );

        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });

    it(`Dangling Comma for TableType`, async () => {
        const text: string = "type table [a = 1,]";

        const continuationError: Parser.ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
            text,
        );

        expect(continuationError.message).to.equal(
            Localization.error_parse_csvContinuation(
                Templates.DefaultTemplates,
                Parser.ParseError.CsvContinuationKind.DanglingComma,
            ),
        );
    });
});
