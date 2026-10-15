// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultSettings, Task } from "../../../powerquery-parser";
import { Ast, AstUtils, Constant } from "../../../powerquery-parser/language";
import { AssertTestUtils } from "../../testUtils";
import { ParseOk } from "../../../powerquery-parser/parser";

describe(`AstUtils`, () => {
    describe("simplifyType", () => {
        async function annotationType(text: string): Promise<Ast.TType> {
            const parsed: ParseOk = await AssertTestUtils.assertGetParseOk(
                DefaultSettings,
                `type function (x as ${text}) as any`,
            );

            const typeExpression: Ast.TypePrimaryType = AstUtils.assertAsNodeKind<Ast.TypePrimaryType>(
                parsed.root,
                Ast.NodeKind.TypePrimaryType,
            );

            const functionType: Ast.FunctionType = AstUtils.assertAsNodeKind<Ast.FunctionType>(
                typeExpression.paired,
                Ast.NodeKind.FunctionType,
            );

            return Assert.asDefined(functionType.parameters.content.elements[0]).node.parameterType.paired;
        }

        for (const [text, primitiveTypeConstantKind, isNullable] of [
            ["text", Constant.PrimitiveTypeConstant.Text, false],
            ["nullable text", Constant.PrimitiveTypeConstant.Text, true],
            ["[Value = text]", Constant.PrimitiveTypeConstant.Record, false],
            ["{text}", Constant.PrimitiveTypeConstant.List, false],
            ["table [Value = text]", Constant.PrimitiveTypeConstant.Table, false],
            ["function () as text", Constant.PrimitiveTypeConstant.Function, false],
            ["(type text)", Constant.PrimitiveTypeConstant.Text, false],
            ["((type nullable text))", Constant.PrimitiveTypeConstant.Text, true],
            ["nullable (type text)", Constant.PrimitiveTypeConstant.Text, true],
        ] as const) {
            it(`simplifies ${text}`, async () => {
                expect(AstUtils.simplifyType(await annotationType(text))).to.deep.equal({
                    isNullable,
                    primitiveTypeConstantKind,
                });
            });
        }

        for (const text of ["T", "nullable T", "(T)", "nullable (T)", "(if true then T else U)", "GetType()", "42"]) {
            it(`reports unresolved syntax for ${text}`, async () => {
                expect(AstUtils.simplifyType(await annotationType(text))).to.equal(undefined);
            });
        }
    });

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

    describe("Type predicates for validator operands", () => {
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
