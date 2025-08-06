// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { CommonError, Result, ResultUtils } from "../../powerquery-parser";
import { IdentifierKind } from "../../powerquery-parser/language/identifierUtils";
import { IdentifierUtils } from "../../powerquery-parser/language";

describe("IdentifierUtils", () => {
    function createIdentifierUtilsOptions(
        allowTrailingPeriod?: boolean,
        allowGeneralizedIdentifier?: boolean,
    ): IdentifierUtils.IdentifierUtilsOptions {
        return {
            allowTrailingPeriod: allowTrailingPeriod ?? false,
            allowGeneralizedIdentifier: allowGeneralizedIdentifier ?? false,
        };
    }

    describe(`getIdentifierKind`, () => {
        function runGetIdentifierKindTest(params: {
            readonly text: string;
            readonly expected: IdentifierKind;
            readonly allowTrailingPeriod?: boolean;
            readonly allowGeneralizedIdentifier?: boolean;
        }): void {
            const text: string = params.text;

            const identifierUtilsOptions: IdentifierUtils.IdentifierUtilsOptions = createIdentifierUtilsOptions(
                params.allowTrailingPeriod,
                params.allowGeneralizedIdentifier,
            );

            it(`${text} with ${JSON.stringify(identifierUtilsOptions)}`, () => {
                const actual: IdentifierKind = IdentifierUtils.getIdentifierKind(text, identifierUtilsOptions);
                expect(actual).to.equal(params.expected);
            });
        }

        runGetIdentifierKindTest({
            text: "foo",
            expected: IdentifierKind.Regular,
        });

        runGetIdentifierKindTest({
            text: "",
            expected: IdentifierKind.Invalid,
        });

        runGetIdentifierKindTest({
            text: "foo.",
            expected: IdentifierKind.Regular,
            allowTrailingPeriod: true,
        });

        runGetIdentifierKindTest({
            text: "foo.",
            expected: IdentifierKind.Invalid,
            allowTrailingPeriod: false,
        });

        runGetIdentifierKindTest({
            text: "foo.bar",
            expected: IdentifierKind.Regular,
        });

        runGetIdentifierKindTest({
            text: "foo.1",
            expected: IdentifierKind.Regular,
        });

        runGetIdentifierKindTest({
            text: "with space",
            expected: IdentifierKind.Invalid,
        });

        runGetIdentifierKindTest({
            text: "with space",
            expected: IdentifierKind.Generalized,
            allowGeneralizedIdentifier: true,
        });

        runGetIdentifierKindTest({
            text: '#"quoteNotNeeded"',
            expected: IdentifierKind.RegularWithQuotes,
        });

        runGetIdentifierKindTest({
            text: '#"quote needed"',
            expected: IdentifierKind.RegularWithRequiredQuotes,
        });

        runGetIdentifierKindTest({
            text: '#"quoted generalized identifier"',
            expected: IdentifierKind.GeneralizedWithQuotes,
            allowGeneralizedIdentifier: true,
        });
    });

    describe(`getNormalizedIdentifier`, () => {
        function runGetNormalizedIdentifierTest(params: {
            readonly text: string;
            readonly expectedSuccess: string | undefined;
            readonly allowGeneralizedIdentifier?: boolean;
            readonly allowTrailingPeriod?: boolean;
        }): void {
            const text: string = params.text;

            const identifierUtilsOptions: IdentifierUtils.IdentifierUtilsOptions = createIdentifierUtilsOptions(
                params.allowTrailingPeriod,
                params.allowGeneralizedIdentifier,
            );

            const actual: Result<string, CommonError.InvariantError> = IdentifierUtils.getNormalizedIdentifier(
                text,
                identifierUtilsOptions,
            );

            if (params.expectedSuccess !== undefined) {
                ResultUtils.assertIsOk(actual);
                expect(actual.value).to.equal(params.expectedSuccess);
            } else {
                ResultUtils.assertIsError(actual);
            }
        }

        it("foo", () => {
            runGetNormalizedIdentifierTest({
                text: "foo",
                expectedSuccess: "foo",
            });
        });

        it("[empty string]", () => {
            runGetNormalizedIdentifierTest({
                text: "",
                expectedSuccess: undefined,
            });
        });

        it("foo. // allowTrailingPeriod - true", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.",
                expectedSuccess: "foo.",
                allowTrailingPeriod: true,
            });
        });

        it("foo. // allowTrailingPeriod - false", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.",
                expectedSuccess: undefined,
                allowTrailingPeriod: false,
            });
        });

        it("foo.bar", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.bar",
                expectedSuccess: "foo.bar",
            });
        });

        it("foo.1", () => {
            runGetNormalizedIdentifierTest({
                text: "foo.1",
                expectedSuccess: "foo.1",
            });
        });

        it("with space // allowGeneralizedIdentifier - false", () => {
            runGetNormalizedIdentifierTest({
                text: "with space",
                allowGeneralizedIdentifier: false,
                expectedSuccess: undefined,
            });
        });

        it("with space // allowGeneralizedIdentifier - true", () => {
            runGetNormalizedIdentifierTest({
                text: "with space",
                expectedSuccess: "with space",
                allowGeneralizedIdentifier: true,
            });
        });

        it(`#"regularIdentifierWithUnneededQuotes" // allowGeneralizedIdentifier - false`, () => {
            runGetNormalizedIdentifierTest({
                text: '#"regularIdentifierWithUnneededQuotes"',
                expectedSuccess: "regularIdentifierWithUnneededQuotes",
                allowGeneralizedIdentifier: false,
            });
        });

        it(`#"quoted regular identifier" // allowGeneralizedIdentifier - false`, () => {
            runGetNormalizedIdentifierTest({
                text: '#"quoted regular identifier"',
                expectedSuccess: `#"quoted regular identifier"`,
                allowGeneralizedIdentifier: false,
            });
        });

        it(`#"quoted generalized identifier" // allowGeneralizedIdentifier - true`, () => {
            runGetNormalizedIdentifierTest({
                text: '#"quoted generalized identifier"',
                expectedSuccess: "quoted generalized identifier",
                allowGeneralizedIdentifier: true,
            });
        });
    });
});
