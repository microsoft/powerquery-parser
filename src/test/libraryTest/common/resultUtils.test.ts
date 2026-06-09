// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { CommonError, ResultUtils } from "../../..";
import { Result, ResultKind } from "../../../powerquery-parser/common/result/result";

describe("ResultUtils", () => {
    describe(`ensureResult`, () => {
        it(`should return an Ok result when callback succeeds`, () => {
            const result: Result<number, CommonError.CommonError> = ResultUtils.ensureResult(() => 42, "en-US");
            expect(result.kind).to.equal(ResultKind.Ok);
        });

        it(`should return an Error result when callback throws an Error`, () => {
            const result: Result<never, CommonError.CommonError> = ResultUtils.ensureResult(() => {
                throw new Error("test error");
            }, "en-US");

            expect(result.kind).to.equal(ResultKind.Error);
        });

        it(`should return an Error result when callback throws a string`, () => {
            const result: Result<never, CommonError.CommonError> = ResultUtils.ensureResult(() => {
                throw "a string throwable";
            }, "en-US");

            expect(result.kind).to.equal(ResultKind.Error);
        });

        it(`should return an Error result when callback throws a number`, () => {
            const result: Result<never, CommonError.CommonError> = ResultUtils.ensureResult(() => {
                throw 42;
            }, "en-US");

            expect(result.kind).to.equal(ResultKind.Error);
        });
    });

    describe(`ensureResultAsync`, () => {
        it(`should return an Ok result when async callback succeeds`, async () => {
            const result: Result<number, CommonError.CommonError> = await ResultUtils.ensureResultAsync(
                async () => 42,
                "en-US",
            );

            expect(result.kind).to.equal(ResultKind.Ok);
        });

        it(`should return an Error result when async callback throws a string`, async () => {
            const result: Result<never, CommonError.CommonError> = await ResultUtils.ensureResultAsync(async () => {
                throw "async string throwable";
            }, "en-US");

            expect(result.kind).to.equal(ResultKind.Error);
        });
    });
});
