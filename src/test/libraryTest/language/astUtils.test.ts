// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Ast, AstUtils } from "../../../powerquery-parser/language";
import { AssertTestUtils } from "../../testUtils";
import { DefaultSettings } from "../../../powerquery-parser";
import { ParseOk } from "../../../powerquery-parser/parser";

describe(`AstUtils`, () => {
    describe(`getIdentifierLiteral`, () => {
        async function runTest(params: {
            readonly text: string;
            readonly expectedIdentifierLiteral: string;
            readonly expectedIdentifierExpressionLiteral: string;
        }): Promise<void> {
            const parseOk: ParseOk = await AssertTestUtils.assertGetParseOk(DefaultSettings, params.text);

            // First, ensure the root node is an IdentifierExpression.
            const rootAsIdentifierExpression: Ast.IdentifierExpression =
                AstUtils.assertAsNodeKind<Ast.IdentifierExpression>(parseOk.root, Ast.NodeKind.IdentifierExpression);

            // Second, grab our actual literals.
            const actualIdentifierExpressionLiteral: string = AstUtils.getIdentifierLiteral(rootAsIdentifierExpression);

            const actualIdentifierLiteral: string = AstUtils.getIdentifierLiteral(
                rootAsIdentifierExpression.identifier,
            );

            expect(
                actualIdentifierExpressionLiteral,
                `expected identifier expression literal to be ${params.expectedIdentifierExpressionLiteral}`,
            ).to.equal(params.expectedIdentifierExpressionLiteral);

            // Finally, assert that our actual literals match the expected literals.
            expect(
                actualIdentifierLiteral,
                `expected identifier literal to be ${params.expectedIdentifierLiteral}`,
            ).to.equal(params.expectedIdentifierLiteral);
        }

        it(`foo`, async () => {
            await runTest({
                text: "foo",
                expectedIdentifierLiteral: "foo",
                expectedIdentifierExpressionLiteral: "foo",
            });
        });

        it(`@foo`, async () => {
            await runTest({
                text: "@foo",
                expectedIdentifierExpressionLiteral: "@foo",
                expectedIdentifierLiteral: "foo",
            });
        });
    });
});
