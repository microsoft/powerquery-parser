// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Ast, AstUtils } from "../../../powerquery-parser/language";
import { DefaultSettings, Task } from "../../../powerquery-parser";
import { AssertTestUtils } from "../../testUtils";
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

    describe("Type predicates for validator operands (Bug 15)", () => {
        it("isTAsExpression should accept AsExpression nodes", async () => {
            // Parse "1 as number as text" — the outer AsExpression's left child is itself an AsExpression.
            // The validator's type predicate for left must accept TAsExpression (which includes AsExpression).
            const parseTaskOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(
                DefaultSettings,
                `1 as number as text`,
            );

            const root: Ast.TNode = parseTaskOk.ast;
            expect(root.kind).to.equal(Ast.NodeKind.AsExpression);

            const asExpr: Ast.AsExpression = root as Ast.AsExpression;
            expect(asExpr.left.kind).to.equal(Ast.NodeKind.AsExpression);

            expect(AstUtils.isTAsExpression(asExpr.left)).to.equal(
                true,
                "isTAsExpression should accept AsExpression nodes",
            );

            // Verify the left operand is NOT one of the narrower TEqualityExpression kinds
            expect(asExpr.left.kind).to.not.be.oneOf(
                [Ast.NodeKind.EqualityExpression, Ast.NodeKind.RelationalExpression, Ast.NodeKind.ArithmeticExpression],
                "The left operand is an AsExpression, in TAsExpression but not TEqualityExpression",
            );
        });

        it("isTEqualityExpression should accept left operand of EqualityExpression", async () => {
            const parseTaskOk: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(DefaultSettings, `1 = 2`);

            const root: Ast.TNode = parseTaskOk.ast;
            expect(root.kind).to.equal(Ast.NodeKind.EqualityExpression);

            const eqExpr: Ast.EqualityExpression = root as Ast.EqualityExpression;

            expect(AstUtils.isTEqualityExpression(eqExpr.left)).to.equal(
                true,
                "isTEqualityExpression should accept left operand of EqualityExpression",
            );
        });
    });
});
