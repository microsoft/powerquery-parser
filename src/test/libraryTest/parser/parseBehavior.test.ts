// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as ParserTestUtils from "./parserTestUtils";
import { Assert, DefaultSettings, Language, Task, TaskUtils } from "../../../powerquery-parser";
import { AssertTestUtils } from "../../testUtils";
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
                throw Assert.isNever(params.expectedStatus);
        }

        return result;
    }

    it(`1 // with ParseEitherExpressionOrSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseEitherExpressionOrSection,
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

    it(`section Foo; shared Bar = 1; // with ParseEitherExpressionOrSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseEitherExpressionOrSection,
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

    it(`invalid parseBehavior throws InvariantError`, async () => {
        // Missing `throw` before Assert.isNever means TypeScript
        // doesn't guarantee the default branch is recognized as unreachable.
        // Verify the default branch actually throws for invalid enum values.
        const invalidBehavior: ParseBehavior = "InvalidBehavior" as unknown as ParseBehavior;

        let threw: boolean = false;

        try {
            await TaskUtils.tryLexParse(
                {
                    ...DefaultSettings,
                    parseBehavior: invalidBehavior,
                },
                "1",
            );
        } catch (error: unknown) {
            threw = true;
            expect((error as Error).message).to.contain("Should never be reached");
        }

        expect(threw).to.equal(true, "An invalid parseBehavior should throw an InvariantError");
    });
});

type ParseOk = Awaited<ReturnType<typeof AssertTestUtils.assertGetLexParseOk>>;

describe("Type directives - regression", () => {
    // BUG: type directive scoping — directive on x's line incorrectly attaches to y
    xit("should not attach directive from previous variable to next variable", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            `let
    x = 1, /// @type number
    y = 2
in
    y`,
        );

        const letExpression: Language.Ast.LetExpression = parseOk.ast as Language.Ast.LetExpression;
        const yVariable: Language.Ast.IdentifierPairedExpression = letExpression.variableList.elements[1]!.node;

        expect(yVariable.precedingDirectives).to.equal(undefined, "y should not have directives from x's line");
    });

    it("should handle multiple consecutive directives in correct order", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            `let
    /// @type text
    /// @type number
    value = []
in
    value`,
        );

        const letExpression: Language.Ast.LetExpression = parseOk.ast as Language.Ast.LetExpression;
        const variable: Language.Ast.IdentifierPairedExpression = letExpression.variableList.elements[0]!.node;

        expect(variable.precedingDirectives).to.not.equal(undefined);
        expect(variable.precedingDirectives?.length).to.equal(2);

        expect(
            variable.precedingDirectives?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["text", "number"]);
    });
});
