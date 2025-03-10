// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Lexer, Localization, Settings, Templates } from "../../..";
import {
    Disambiguation,
    ParseError,
    Parser,
    ParseState,
    ParseStateUtils,
    RecursiveDescentParser,
} from "../../../powerquery-parser/parser";
import { Ast } from "../../../powerquery-parser/language";
import { TestAssertUtils } from "../../testUtils";

const DefaultSettingsWithStrict: Settings = {
    ...DefaultSettings,
    newParseState: (lexerSnapshot: Lexer.LexerSnapshot, overrides: Partial<ParseState> | undefined) => {
        overrides = overrides ?? {};

        return ParseStateUtils.newState(lexerSnapshot, {
            ...overrides,
            disambiguationBehavior: overrides.disambiguationBehavior ?? Disambiguation.DismabiguationBehavior.Strict,
        });
    },
};

async function assertGetCsvContinuationError(text: string): Promise<ParseError.ExpectedCsvContinuationError> {
    const innerError: ParseError.TInnerParseError = (
        await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
    ).innerError;

    Assert.isTrue(
        innerError instanceof ParseError.ExpectedCsvContinuationError,
        "innerError instanceof ParseError.ExpectedCsvContinuationError",
    );

    return innerError as ParseError.ExpectedCsvContinuationError;
}

describe("Parser.Error", () => {
    it("RequiredParameterAfterOptionalParameterError: (optional x, y) => x", async () => {
        const text: string = "(optional x, y) => x";

        const innerError: ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof ParseError.RequiredParameterAfterOptionalParameterError).to.equal(
            true,
            innerError.message,
        );
    });

    it("UnterminatedSequence (Bracket): let x = [", async () => {
        const text: string = "let x = [";

        const innerError: ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof ParseError.UnterminatedSequence).to.equal(true, innerError.message);

        expect((innerError as ParseError.UnterminatedSequence).kind).to.equal(
            ParseError.SequenceKind.Bracket,
            innerError.message,
        );
    });

    it("UnterminatedSequence (Parenthesis): let x = (1", async () => {
        const text: string = "let x = (1";

        const innerError: ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof ParseError.UnterminatedSequence).to.equal(true, innerError.message);

        expect((innerError as ParseError.UnterminatedSequence).kind).to.equal(
            ParseError.SequenceKind.Parenthesis,
            innerError.message,
        );
    });

    describe(`UnusedTokensRemainError`, () => {
        it("default parser", async () => {
            const text: string = "1 1";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });

        it("custom start", async () => {
            const customSettings: Settings = {
                ...DefaultSettings,
                parser: RecursiveDescentParser,
                // eslint-disable-next-line require-await
                parserEntryPoint: async (state: ParseState, parser: Parser): Promise<Ast.TNode> =>
                    parser.readIdentifier(state, parser, Ast.IdentifierContextKind.Value, undefined),
            };

            const text: string = "a b";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(customSettings, text)
            ).innerError;

            expect(innerError instanceof ParseError.UnusedTokensRemainError).to.equal(true, innerError.message);
        });
    });

    describe(`Dangling comma`, () => {
        it(`LetExpression`, async () => {
            const text: string = "let a = 1, in 1";

            const continuationError: ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
                text,
            );

            expect(continuationError.message).to.equal(
                Localization.error_parse_csvContinuation(
                    Templates.DefaultTemplates,
                    ParseError.CsvContinuationKind.LetExpression,
                ),
            );
        });

        it(`ListExpression`, async () => {
            const text: string = "{1, }";

            const continuationError: ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
                text,
            );

            expect(continuationError.message).to.equal(
                Localization.error_parse_csvContinuation(
                    Templates.DefaultTemplates,
                    ParseError.CsvContinuationKind.DanglingComma,
                ),
            );
        });

        it(`FunctionExpression`, async () => {
            const text: string = "(a, ) => a";

            const continuationError: ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
                text,
            );

            expect(continuationError.message).to.equal(
                Localization.error_parse_csvContinuation(
                    Templates.DefaultTemplates,
                    ParseError.CsvContinuationKind.DanglingComma,
                ),
            );
        });

        it(`FunctionType`, async () => {
            const text: string = "type function (a as number, ) as number";

            const continuationError: ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
                text,
            );

            expect(continuationError.message).to.equal(
                Localization.error_parse_csvContinuation(
                    Templates.DefaultTemplates,
                    ParseError.CsvContinuationKind.DanglingComma,
                ),
            );
        });

        it(`RecordExpression`, async () => {
            const text: string = "[a = 1,]";

            const continuationError: ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
                text,
            );

            expect(continuationError.message).to.equal(
                Localization.error_parse_csvContinuation(
                    Templates.DefaultTemplates,
                    ParseError.CsvContinuationKind.DanglingComma,
                ),
            );
        });

        it(`RecordType`, async () => {
            const text: string = "type [a = 1,]";

            const continuationError: ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
                text,
            );

            expect(continuationError.message).to.equal(
                Localization.error_parse_csvContinuation(
                    Templates.DefaultTemplates,
                    ParseError.CsvContinuationKind.DanglingComma,
                ),
            );
        });

        it(`TableType`, async () => {
            const text: string = "type table [a = 1,]";

            const continuationError: ParseError.ExpectedCsvContinuationError = await assertGetCsvContinuationError(
                text,
            );

            expect(continuationError.message).to.equal(
                Localization.error_parse_csvContinuation(
                    Templates.DefaultTemplates,
                    ParseError.CsvContinuationKind.DanglingComma,
                ),
            );
        });
    });

    describe(`Expected comma`, () => {
        it(`LetExpression`, async () => {
            const text: string = "let foo = 1 bar = 1 in foo + bar";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof ParseError.ExpectedClosingTokenKind).to.equal(true, innerError.message);
        });

        it(`ListExpression`, async () => {
            const text: string = "{1 2}";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof ParseError.ExpectedClosingTokenKind).to.equal(true, innerError.message);
        });

        it(`RecordExpression`, async () => {
            const text: string = "[foo = 1 bar = 1]";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof ParseError.ExpectedClosingTokenKind).to.equal(true, innerError.message);
        });

        it(`RecordLiteral`, async () => {
            const text: string = "[foo = 1 bar = 2]section baz;";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof ParseError.ExpectedClosingTokenKind).to.equal(true, innerError.message);
        });

        it(`RecordType`, async () => {
            const text: string = "type [foo = number bar = number]";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof ParseError.ExpectedClosingTokenKind).to.equal(true, innerError.message);
        });

        it(`TableType`, async () => {
            const text: string = "type table [a = 1 b = 2]";

            const innerError: ParseError.TInnerParseError = (
                await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
            ).innerError;

            expect(innerError instanceof ParseError.ExpectedClosingTokenKind).to.equal(true, innerError.message);
        });
    });

    it(`catch doesn't allow parameter typing`, async () => {
        const text: string = `try 1 catch (x as number) => 0`;

        const innerError: ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof ParseError.InvalidCatchFunctionError).to.equal(true, innerError.message);
    });

    it(`catch doesn't allow return typing`, async () => {
        const text: string = `try 1 catch (x) as number => 0`;

        const innerError: ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof ParseError.InvalidCatchFunctionError).to.equal(true, innerError.message);
    });

    it(`catch doesn't allow multiple parameters`, async () => {
        const text: string = `try 1 catch (x, y) => 0`;

        const innerError: ParseError.TInnerParseError = (
            await TestAssertUtils.assertGetParseError(DefaultSettingsWithStrict, text)
        ).innerError;

        expect(innerError instanceof ParseError.InvalidCatchFunctionError).to.equal(true, innerError.message);
    });
});
