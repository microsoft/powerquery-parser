// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { IdentifierExpressionUtils, IdentifierUtils } from "../../powerquery-parser/language";

describe("IdentifierUtils", () => {
    function createCommonIdentifierUtilsOptions(
        overrides?: Partial<IdentifierUtils.CommonIdentifierUtilsOptions>,
    ): IdentifierUtils.CommonIdentifierUtilsOptions {
        return {
            allowTrailingPeriod: false,
            allowGeneralizedIdentifier: false,
            ...overrides,
        };
    }

    describe(`getNormalizedIdentifierExpression`, () => {
        function runGetNormalizedIdentifierExpressionTest(params: {
            readonly text: string;
            readonly expectedSuccess: string | undefined;
            readonly options?: Partial<IdentifierUtils.CommonIdentifierUtilsOptions>;
        }): void {
            const text: string = params.text;

            const identifierUtilsOptions: IdentifierUtils.CommonIdentifierUtilsOptions =
                createCommonIdentifierUtilsOptions(params.options);

            const actual: string | undefined = IdentifierExpressionUtils.getNormalizedIdentifierExpression(
                text,
                identifierUtilsOptions,
            );

            if (params.expectedSuccess !== undefined) {
                expect(actual).to.equal(params.expectedSuccess);
            } else {
                expect(actual).to.be.undefined;
            }
        }

        it("foo", () => {
            runGetNormalizedIdentifierExpressionTest({
                text: "foo",
                expectedSuccess: "foo",
            });
        });

        it("@foo", () => {
            runGetNormalizedIdentifierExpressionTest({
                text: "@foo",
                expectedSuccess: "foo",
            });
        });
    });
});
