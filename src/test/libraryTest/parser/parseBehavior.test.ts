// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as ParserTestUtils from "./parserTestUtils";
import { Assert, DefaultSettings, Task, TaskUtils } from "../../../powerquery-parser";
import { NodeKind } from "../../../powerquery-parser/language/ast/ast";
import { ParseBehavior } from "../../../powerquery-parser/parser/parseBehavior";
import { ParseError } from "../../../powerquery-parser/parser";

describe("ParseBehavior", () => {
    async function runParseBehaviorTest(params: {
        readonly parseBehavior: ParseBehavior;
        readonly text: string;
        readonly expectedAbridgedNodes: ReadonlyArray<ParserTestUtils.AbridgedNode>;
        readonly expectedStatus: "ExpectedAnyTokenKindError" | "ExpectedTokenKindError" | "ParseStageOk";
    }): Promise<Task.ParseTaskOk | Task.ParseTaskParseError> {
        const result: Task.ParseTaskOk | Task.ParseTaskParseError = await ParserTestUtils.runAbridgedNodeTest(
            params.text,
            params.expectedAbridgedNodes,
            {
                astOnly: true,
                settings: {
                    ...DefaultSettings,
                    parseBehavior: params.parseBehavior,
                },
            },
        );

        switch (params.expectedStatus) {
            case "ExpectedAnyTokenKindError":
                TaskUtils.assertIsParseStageError(result);
                expect(result.error.innerError).to.be.instanceOf(ParseError.ExpectedAnyTokenKindError);
                break;

            case "ExpectedTokenKindError":
                TaskUtils.assertIsParseStageError(result);
                expect(result.error.innerError).to.be.instanceOf(ParseError.ExpectedTokenKindError);
                break;

            case "ParseStageOk":
                TaskUtils.assertIsParseStageOk(result);
                break;

            default:
                Assert.isNever(params.expectedStatus);
        }

        return result;
    }

    it(`1 // with ParseAll`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseAll,
            text: `1`,
            expectedAbridgedNodes: [[NodeKind.LiteralExpression, undefined]],
            expectedStatus: "ParseStageOk",
        });
    });

    it(`1 // with ParseExpression`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseExpression,
            text: `1`,
            expectedAbridgedNodes: [[NodeKind.LiteralExpression, undefined]],
            expectedStatus: "ParseStageOk",
        });
    });

    it(`1 // with ParseSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseSection,
            text: `1`,
            expectedAbridgedNodes: [],
            expectedStatus: "ExpectedTokenKindError",
        });
    });

    it(`section Foo; shared Bar = 1; // with ParseAll`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseAll,
            text: `section Foo; shared Bar = 1;`,
            expectedAbridgedNodes: [
                [NodeKind.Section, undefined],
                [NodeKind.Constant, 1],
                [NodeKind.Identifier, 2],
                [NodeKind.Constant, 3],
                [NodeKind.ArrayWrapper, 4],
                [NodeKind.SectionMember, 0],
                [NodeKind.Constant, 1],
                [NodeKind.IdentifierPairedExpression, 2],
                [NodeKind.Identifier, 0],
                [NodeKind.Constant, 1],
                [NodeKind.LiteralExpression, 2],
                [NodeKind.Constant, 3],
            ],
            expectedStatus: "ParseStageOk",
        });
    });

    it(`section Foo; shared Bar = 1; // with ParseExpression`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseExpression,
            text: `section Foo; shared Bar = 1;`,
            expectedAbridgedNodes: [],
            expectedStatus: "ExpectedAnyTokenKindError",
        });
    });

    it(`section Foo; shared Bar = 1; // with ParseSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseSection,
            text: `section Foo; shared Bar = 1;`,
            expectedAbridgedNodes: [
                [NodeKind.Section, undefined],
                [NodeKind.Constant, 1],
                [NodeKind.Identifier, 2],
                [NodeKind.Constant, 3],
                [NodeKind.ArrayWrapper, 4],
                [NodeKind.SectionMember, 0],
                [NodeKind.Constant, 1],
                [NodeKind.IdentifierPairedExpression, 2],
                [NodeKind.Identifier, 0],
                [NodeKind.Constant, 1],
                [NodeKind.LiteralExpression, 2],
                [NodeKind.Constant, 3],
            ],
            expectedStatus: "ParseStageOk",
        });
    });
});
