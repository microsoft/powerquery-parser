// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { CommonError, ResultKind } from "../../../powerquery-parser/common";
import { TaskStage, TTask } from "../../../powerquery-parser/task/task";
import { TaskUtils } from "../../../powerquery-parser/task";

describe(`TaskUtils`, () => {
    describe(`assertIsLexStage`, () => {
        it(`error details report stage (not resultKind) when assertion fails`, () => {
            // Create a Parse-stage task to trigger the assertion failure
            const fakeParseTask: TTask = {
                stage: TaskStage.Parse,
                resultKind: ResultKind.Ok,
            } as TTask;

            try {
                TaskUtils.assertIsLexStage(fakeParseTask);
                expect.fail("should have thrown");
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(CommonError.InvariantError);

                const invariantError: CommonError.InvariantError = error as CommonError.InvariantError;

                const details: { expected: TaskStage; actual: TaskStage } = invariantError.details as {
                    expected: TaskStage;
                    actual: TaskStage;
                };

                expect(details.expected).to.equal(TaskStage.Lex);
                // Bug: reports task.resultKind ("Ok") instead of task.stage ("Parse")
                expect(details.actual).to.equal(TaskStage.Parse);
            }
        });
    });
});
