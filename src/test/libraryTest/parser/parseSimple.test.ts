// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import * as ParserTestUtils from "./parserTestUtils";
import { Assert, DefaultSettings, Settings, Task } from "../../..";
import { Ast, AstUtils, Constant, Token } from "../../../powerquery-parser/language";
import {
    CombinatorialParserV2,
    NodeIdMap,
    NodeIdMapUtils,
    ParseError,
    Parser,
    ParseState,
    RecursiveDescentParser,
    XorNode,
    XorNodeUtils,
} from "../../../powerquery-parser/parser";
import { AssertTestUtils } from "../../testUtils";

describe("Parser.AbridgedNode", () => {
    describe(`${Ast.NodeKind.ArithmeticExpression}`, () => {
        it(`1 &`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 &`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.ArithmeticExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 *`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 *`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.ArithmeticExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 /`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 /`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.ArithmeticExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 +`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 +`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.ArithmeticExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 -`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 -`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.ArithmeticExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 & 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 & 2`, Constant.ArithmeticOperator.And, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 * 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 * 2`, Constant.ArithmeticOperator.Multiplication, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 / 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 / 2`, Constant.ArithmeticOperator.Division, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 + 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 + 2`, Constant.ArithmeticOperator.Addition, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 - 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 - 2`, Constant.ArithmeticOperator.Subtraction, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 + 2 + 3 + 4`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 + 2 + 3 + 4`, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.ArithmeticExpression, 0],
                [Ast.NodeKind.ArithmeticExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.AsExpression}`, () => {
        it(`1 as`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 as`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.AsExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 as number`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 as number`, [
                [Ast.NodeKind.AsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 as number as logical`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 as number as logical`, [
                [Ast.NodeKind.AsExpression, undefined],
                [Ast.NodeKind.AsExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`type function (x as number) as number`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type function (x as number) as number`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.FunctionType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ParameterList, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.AsType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
            ]);
        });
    });

    // Ast.Ast.NodeKind.Constant covered by many

    // Ast.Ast.NodeKind.Csv covered by many

    it(`${Ast.NodeKind.EachExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`each 1`, [
            [Ast.NodeKind.EachExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
        ]);
    });

    describe(`${Ast.NodeKind.EqualityExpression}`, () => {
        it(`1 = 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 = 2`, Constant.EqualityOperator.EqualTo, [
                [Ast.NodeKind.EqualityExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 <> 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 <> 2`, Constant.EqualityOperator.NotEqualTo, [
                [Ast.NodeKind.EqualityExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`try 1`, [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`try 1 otherwise 2`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`try 1 otherwise 2`, [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.OtherwiseExpression, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`try 1 catch () => 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`try 1 catch () => 1`, [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.CatchExpression, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.FunctionExpression, 1],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`try 1 catch (x) => 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`try 1 catch (x) => 1`, [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.CatchExpression, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.FunctionExpression, 1],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });
    });

    it(`${Ast.NodeKind.ErrorRaisingExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`error 1`, [
            [Ast.NodeKind.ErrorRaisingExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
        ]);
    });

    describe(`${Ast.NodeKind.FieldProjection}`, () => {
        it(`x[[y]]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`x[[y]]`, [
                [Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Ast.NodeKind.IdentifierExpression, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.FieldProjection, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSelector, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`x[[y], [z]]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`x[[y], [z]]`, [
                [Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Ast.NodeKind.IdentifierExpression, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.FieldProjection, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSelector, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.FieldSelector, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`x[[y]]?`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`x[[y]]?`, [
                [Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Ast.NodeKind.IdentifierExpression, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.FieldProjection, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSelector, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });
    });

    describe(`${Ast.NodeKind.FieldSelector}`, () => {
        it(`[x]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[x]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[x]?`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[x]?`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });
    });

    describe(`${Ast.NodeKind.FieldSpecification}`, () => {
        it(`type [x]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type [x]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`type [optional x]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type [optional x]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`type [x = number]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type [x = number]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.FieldTypeSpecification, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.FieldSpecificationList}`, () => {
        it(`type []`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type []`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`type table []`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type table []`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.TableType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.FieldSpecificationList, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`${Ast.NodeKind.FieldSpecificationList}`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type [x]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`type [x, ...]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type [x, ...]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });
    });

    // Ast.Ast.NodeKind.FieldTypeSpecification covered by FieldSpecification

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`() => 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`() => 1`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`(x) => 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(x) => 1`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`(x, y, z) => 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(x, y, z) => 1`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 2],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`(optional x) => 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(optional x) => 1`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`(x as nullable text) => 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(x as nullable text) => 1`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.AsNullablePrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.NullablePrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`(x) as number => x`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(x) as number => x`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.IdentifierExpression, 3],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`(x as number) as number => x`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(x as number) as number => x`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.AsNullablePrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.IdentifierExpression, 3],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`(x as number) as nullable number => x`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(x as number) as nullable number => x`, [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.AsNullablePrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.NullablePrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.IdentifierExpression, 3],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`let Fn = () as nullable text => "asd" in Fn`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`let Fn = () as nullable text => "asd" in Fn`, [
                [Ast.NodeKind.LetExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 0],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.FunctionExpression, 2],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.NullablePrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.IdentifierExpression, 3],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    describe(`${Ast.NodeKind.FunctionType}`, () => {
        it(`type function () as number`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type function () as number`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.FunctionType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ParameterList, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
            ]);
        });

        it(`type function (x as number) as number`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type function (x as number) as number`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.FunctionType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ParameterList, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.Parameter, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.AsType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
            ]);
        });
    });

    // Ast.Ast.NodeKind.FieldTypeSpecification covered by AsType

    describe(`${Ast.NodeKind.GeneralizedIdentifier}`, () => {
        it(`[foo bar]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[foo bar]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[1]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[1]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[a.1]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[a.1]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[#"a""" = 1]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[#"a""" = 1]`, [
                [Ast.NodeKind.RecordExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
            ]);
        });
    });

    it(`Ast.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`[x=1] section;`, [
            [Ast.NodeKind.Section, undefined],
            [Ast.NodeKind.RecordLiteral, 0],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.Csv, 0],
            [Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, 0],
            [Ast.NodeKind.GeneralizedIdentifier, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.LiteralExpression, 2],
            [Ast.NodeKind.Constant, 2],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.Constant, 3],
            [Ast.NodeKind.ArrayWrapper, 4],
        ]);
    });

    it(`${Ast.NodeKind.GeneralizedIdentifierPairedExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`[x=1]`, [
            [Ast.NodeKind.RecordExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.Csv, 0],
            [Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
            [Ast.NodeKind.GeneralizedIdentifier, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.LiteralExpression, 2],
            [Ast.NodeKind.Constant, 2],
        ]);
    });

    // Ast.Ast.NodeKind.Identifier covered by many

    describe(`${Ast.NodeKind.IdentifierExpression}`, () => {
        it(`@foo`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`@foo`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`零`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`零`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    it(`${Ast.NodeKind.IdentifierPairedExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`section; x = 1;`, [
            [Ast.NodeKind.Section, undefined],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.Constant, 3],
            [Ast.NodeKind.ArrayWrapper, 4],
            [Ast.NodeKind.SectionMember, 0],
            [Ast.NodeKind.IdentifierPairedExpression, 2],
            [Ast.NodeKind.Identifier, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.LiteralExpression, 2],
            [Ast.NodeKind.Constant, 3],
        ]);
    });

    it(`${Ast.NodeKind.IfExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`if x then x else x`, [
            [Ast.NodeKind.IfExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.IdentifierExpression, 1],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.Constant, 2],
            [Ast.NodeKind.IdentifierExpression, 3],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.Constant, 4],
            [Ast.NodeKind.IdentifierExpression, 5],
            [Ast.NodeKind.Identifier, 1],
        ]);
    });

    it(`${Ast.NodeKind.InvokeExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`foo()`, [
            [Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Ast.NodeKind.IdentifierExpression, 0],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.InvokeExpression, 0],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.Constant, 2],
        ]);
    });

    describe(`${Ast.NodeKind.IsExpression}`, () => {
        it(`1 is`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 is`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.IsExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 is number`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 is number`, [
                [Ast.NodeKind.IsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 is number is number`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 is number is number`, [
                [Ast.NodeKind.IsExpression, undefined],
                [Ast.NodeKind.IsExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });
    });

    it(`${Ast.NodeKind.ItemAccessExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`x{1}`, [
            [Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Ast.NodeKind.IdentifierExpression, 0],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.ItemAccessExpression, 0],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
            [Ast.NodeKind.Constant, 2],
        ]);
    });

    it(`${Ast.NodeKind.ItemAccessExpression} optional`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`x{1}?`, [
            [Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Ast.NodeKind.IdentifierExpression, 0],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.ItemAccessExpression, 0],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
            [Ast.NodeKind.Constant, 2],
            [Ast.NodeKind.Constant, 3],
        ]);
    });

    describe(`keywords`, () => {
        it(`#sections`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`#sections`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`#shared`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`#shared`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let in 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`let in 1`, [
                [Ast.NodeKind.LetExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`let x = 1 in x`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`let x = 1 in x`, [
                [Ast.NodeKind.LetExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 0],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.IdentifierExpression, 3],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`let x = 1 in try x`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`let x = 1 in try x`, [
                [Ast.NodeKind.LetExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 0],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.ErrorHandlingExpression, 3],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.IdentifierExpression, 1],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`let a = let argh`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`let a = let argh`, [
                [Ast.NodeKind.LetExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 0],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LetExpression, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 0],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
            ]);
        });
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{}`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`{}`, [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1, 2}`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`{1, 2}`, [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1..2}`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`{1..2}`, [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.RangeExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1..2, 3..4}`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`{1..2, 3..4}`, [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.RangeExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.RangeExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1, 2..3}`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`{1, 2..3}`, [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.RangeExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1..2, 3}`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`{1..2, 3}`, [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.RangeExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`let x = 1, y = {x..2} in y`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`let x = 1, y = {x..2} in y`, [
                [Ast.NodeKind.LetExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 0],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.IdentifierPairedExpression, 0],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.ListExpression, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.RangeExpression, 0],
                [Ast.NodeKind.IdentifierExpression, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.IdentifierExpression, 3],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    describe(`${Ast.NodeKind.ListLiteral}`, () => {
        it(`[foo = {1}] section;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[foo = {1}] section;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.RecordLiteral, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.ListLiteral, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`[foo = {}] section;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[foo = {}] section;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.RecordLiteral, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.ListLiteral, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });
    });

    it(`${Ast.NodeKind.ListType}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`type {number}`, [
            [Ast.NodeKind.TypePrimaryType, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.ListType, 1],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
            [Ast.NodeKind.Constant, 2],
        ]);
    });

    describe(`${Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`true`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`false`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`false`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`#!"a"`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`#!"a"`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`0x1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`0x1`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`0X1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`0X1`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1.2`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1.2`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`.1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(".1", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e2`, async () => {
            await ParserTestUtils.runAbridgedNodeTest("1e2", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e+2`, async () => {
            await ParserTestUtils.runAbridgedNodeTest("1e+2", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e-2`, async () => {
            await ParserTestUtils.runAbridgedNodeTest("1e-2", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`#nan`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`#nan`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`#infinity`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`#infinity`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`""`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`""`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`""""`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`""""`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`null`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`null`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });
    });

    describe(`${Ast.NodeKind.LogicalExpression}`, () => {
        it(`true and true`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`true and true`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`true or true`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`true or true`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    it(`${Ast.NodeKind.MetadataExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`1 meta 1`, [
            [Ast.NodeKind.MetadataExpression, undefined],
            [Ast.NodeKind.LiteralExpression, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.LiteralExpression, 2],
        ]);
    });

    it(`${Ast.NodeKind.NotImplementedExpression}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`...`, [
            [Ast.NodeKind.NotImplementedExpression, undefined],
            [Ast.NodeKind.Constant, 0],
        ]);
    });

    it(`${Ast.NodeKind.NullablePrimitiveType}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`1 is nullable number`, [
            [Ast.NodeKind.IsExpression, undefined],
            [Ast.NodeKind.LiteralExpression, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.NullablePrimitiveType, 2],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
        ]);
    });

    it(`${Ast.NodeKind.NullableType}`, async () => {
        await ParserTestUtils.runAbridgedNodeTest(`type nullable number`, [
            [Ast.NodeKind.TypePrimaryType, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.NullableType, 1],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
        ]);
    });

    describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
        it(`1 ?? a`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 ?? a`, [
                [Ast.NodeKind.NullCoalescingExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.IdentifierExpression, 2],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`1 ?? 2 ?? 3`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 ?? 2 ?? 3`, [
                [Ast.NodeKind.NullCoalescingExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.NullCoalescingExpression, 2],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    // Ast.Ast.NodeKind.OtherwiseExpression covered by `${Ast.NodeKind.ErrorHandlingExpression} otherwise`

    // Ast.Ast.NodeKind.Parameter covered by many

    // Ast.Ast.NodeKind.ParameterList covered by many

    describe(`${Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`(1)`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(1)`, [
                [Ast.NodeKind.ParenthesizedExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`(1) + 1`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(1) + 1`, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.ParenthesizedExpression, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`(if true then true else false) and true`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`(if true then true else false) and true`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.ParenthesizedExpression, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.IfExpression, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
                [Ast.NodeKind.Constant, 4],
                [Ast.NodeKind.LiteralExpression, 5],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`((1)) and true`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`((1)) and true`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.ParenthesizedExpression, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ParenthesizedExpression, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.PrimitiveType}`, () => {
        it(`1 as time`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`1 as time`, [
                [Ast.NodeKind.AsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`[x=1]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[x=1]`, [
                [Ast.NodeKind.RecordExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[]`, [
                [Ast.NodeKind.RecordExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });
    });

    // Ast.Ast.NodeKind.RecordLiteral covered by many

    describe(`${Ast.NodeKind.RecordType}`, () => {
        it(`type [x]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type [x]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`type [x, ...]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type [x, ...]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.RecordType, 1],
                [Ast.NodeKind.FieldSpecificationList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });
    });

    // Ast.Ast.NodeKind.RecursivePrimaryExpression covered by many

    describe(`${Ast.NodeKind.RelationalExpression}`, () => {
        it(`1 > 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 > 2`, Constant.RelationalOperator.GreaterThan, [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 >= 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(
                `1 >= 2`,
                Constant.RelationalOperator.GreaterThanEqualTo,
                [
                    [Ast.NodeKind.RelationalExpression, undefined],
                    [Ast.NodeKind.LiteralExpression, 0],
                    [Ast.NodeKind.Constant, 1],
                    [Ast.NodeKind.LiteralExpression, 2],
                ],
            );
        });

        it(`1 < 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`1 < 2`, Constant.RelationalOperator.LessThan, [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 <= 2`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(
                `1 <= 2`,
                Constant.RelationalOperator.LessThanEqualTo,
                [
                    [Ast.NodeKind.RelationalExpression, undefined],
                    [Ast.NodeKind.LiteralExpression, 0],
                    [Ast.NodeKind.Constant, 1],
                    [Ast.NodeKind.LiteralExpression, 2],
                ],
            );
        });
    });

    describe(`${Ast.NodeKind.SectionAccessExpression}`, () => {
        for (const [name, parser] of [
            ["combinatorial", CombinatorialParserV2],
            ["recursive descent", RecursiveDescentParser],
        ] as const) {
            describe(name, () => {
                const settings: Settings = { ...DefaultSettings, parser };

                for (const [text, sectionName, memberName] of [
                    ["Section1!abc", "Section1", "abc"],
                    ['#"Section one"!#"Member name"', '#"Section one"', '#"Member name"'],
                    ['#"section"!#"let"', '#"section"', '#"let"'],
                    ["Section.One!Member.Name", "Section.One", "Member.Name"],
                    ["Section1 /* section */ ! // member\n abc", "Section1", "abc"],
                ] as const) {
                    it(`parses ${text}`, async () => {
                        const parsed: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(settings, text);

                        const node: Ast.SectionAccessExpression =
                            AstUtils.assertAsNodeKind<Ast.SectionAccessExpression>(
                                parsed.ast,
                                Ast.NodeKind.SectionAccessExpression,
                            );

                        expect(node.sectionName.literal).to.equal(sectionName);
                        expect(node.memberName.literal).to.equal(memberName);
                        expect(node.sectionName.identifierContextKind).to.equal(Ast.IdentifierContextKind.Value);
                        expect(node.memberName.identifierContextKind).to.equal(Ast.IdentifierContextKind.Value);
                        expect(node.bangConstant.constantKind).to.equal(Constant.MiscConstant.Bang);
                        expect(node.isLeaf).to.equal(false);
                        expect(node.tokenRange.positionStart).to.deep.equal(node.sectionName.tokenRange.positionStart);
                        expect(node.tokenRange.positionEnd).to.deep.equal(node.memberName.tokenRange.positionEnd);

                        const children: ReadonlyArray<Ast.TNode> = [
                            node.sectionName,
                            node.bangConstant,
                            node.memberName,
                        ];

                        const collection: NodeIdMap.Collection = parsed.nodeIdMapCollection;

                        expect(collection.childIdsById.get(node.id)).to.deep.equal(
                            children.map((child: Ast.TNode) => child.id),
                        );

                        children.forEach((child: Ast.TNode, index: number) => {
                            expect(child.attributeIndex).to.equal(index);
                            expect(collection.parentIdById.get(child.id)).to.equal(node.id);
                            expect(collection.astNodeById.get(child.id)).to.equal(child);
                        });
                    });
                }

                it("supports traversal and classifies section access as a primary expression", async () => {
                    const parsed: Task.ParseTaskOk | Task.ParseTaskParseError =
                        await ParserTestUtils.runAbridgedNodeTest(
                            "Section1!abc",
                            [
                                [Ast.NodeKind.SectionAccessExpression, undefined],
                                [Ast.NodeKind.Identifier, 0],
                                [Ast.NodeKind.Constant, 1],
                                [Ast.NodeKind.Identifier, 2],
                            ],
                            { settings },
                        );

                    const node: Ast.SectionAccessExpression =
                        NodeIdMapUtils.assertAstChecked<Ast.SectionAccessExpression>(
                            parsed.nodeIdMapCollection,
                            Assert.asDefined(
                                parsed.nodeIdMapCollection.idsByNodeKind
                                    .get(Ast.NodeKind.SectionAccessExpression)
                                    ?.values()
                                    .next().value,
                            ),
                            Ast.NodeKind.SectionAccessExpression,
                        );

                    expect(AstUtils.isTPrimaryExpression(node)).to.equal(true);
                    expect(AstUtils.isTExpression(node)).to.equal(true);
                    expect(AstUtils.isTType(node)).to.equal(true);
                    expect(AstUtils.isTBinOpExpressionKind(node.kind)).to.equal(false);
                    expect(AstUtils.isTKeyValuePair(node)).to.equal(false);
                    expect(AstUtils.isTPairedConstant(node)).to.equal(false);
                    expect(XorNodeUtils.isTExpression(XorNodeUtils.boxAst(node))).to.equal(true);
                });

                for (const suffix of ["()", "(1)", "[Field]", "[[Field]]", "{0}", "()[Field]{0}"]) {
                    it(`supports recursive primary suffix ${suffix}`, async () => {
                        const parsed: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(
                            settings,
                            `Section1!abc${suffix}`,
                        );

                        const node: Ast.RecursivePrimaryExpression =
                            AstUtils.assertAsNodeKind<Ast.RecursivePrimaryExpression>(
                                parsed.ast,
                                Ast.NodeKind.RecursivePrimaryExpression,
                            );

                        expect(node.head.kind).to.equal(Ast.NodeKind.SectionAccessExpression);
                    });
                }

                for (const text of [
                    "1 + Section1!abc * 2",
                    "-Section1!abc",
                    "(Section1!abc)",
                    "let value = Section1!abc in value",
                    "[Value = Section1!abc]",
                    "{Section1!abc, Section2!def}",
                    "section Section1; shared Value = Section2!abc;",
                    "type table Section1!Schema",
                    "type function (value as Section1!Schema) as any",
                    "Section1!abc ?? Section2!def",
                    "if Section1!abc then Section2!def else Section3!ghi",
                ]) {
                    it(`parses section access within ${text}`, async () => {
                        const parsed: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(settings, text);

                        expect(
                            parsed.nodeIdMapCollection.idsByNodeKind.get(Ast.NodeKind.SectionAccessExpression)?.size,
                        ).to.be.greaterThan(0);
                    });
                }

                for (const text of ["Section1!", "Section1!123", "Section1!let", "Section1!@abc"]) {
                    it(`reports an expected identifier for ${text}`, async () => {
                        const parsed: Task.ParseTaskParseError = await AssertTestUtils.assertGetLexParseError(
                            settings,
                            text,
                        );

                        const error: ParseError.TInnerParseError = parsed.error.innerError;

                        if (!(error instanceof ParseError.ExpectedTokenKindError)) {
                            throw new Error(`Expected an identifier error, got ${error.message}`);
                        }

                        expect(error.expectedTokenKind).to.equal(Token.TokenKind.Identifier);
                        const collection: NodeIdMap.Collection = parsed.nodeIdMapCollection;

                        const nodeId: number = Assert.asDefined(
                            collection.idsByNodeKind.get(Ast.NodeKind.SectionAccessExpression)?.values().next().value,
                        );

                        const node: XorNode<Ast.SectionAccessExpression> =
                            NodeIdMapUtils.assertXorChecked<Ast.SectionAccessExpression>(
                                collection,
                                nodeId,
                                Ast.NodeKind.SectionAccessExpression,
                            );

                        expect(XorNodeUtils.isContext(node)).to.equal(true);

                        expect(
                            NodeIdMapUtils.assertNthChildAstChecked<Ast.Identifier>(
                                collection,
                                nodeId,
                                0,
                                Ast.NodeKind.Identifier,
                            ).literal,
                        ).to.equal("Section1");

                        expect(
                            NodeIdMapUtils.assertNthChildAstChecked<Ast.TConstant>(
                                collection,
                                nodeId,
                                1,
                                Ast.NodeKind.Constant,
                            ).constantKind,
                        ).to.equal(Constant.MiscConstant.Bang);

                        expect(
                            XorNodeUtils.isContext(NodeIdMapUtils.assertNthChildXor(collection, nodeId, 2)),
                        ).to.equal(true);
                    });
                }

                for (const text of ["!abc", "Section1!abc!def", "@Section1!abc", "(Section1)!abc", "1!abc"]) {
                    it(`rejects invalid section access ${text}`, async () => {
                        await AssertTestUtils.assertGetLexParseError(settings, text);
                    });
                }

                it("preserves ordinary and inclusive identifier expressions", async () => {
                    for (const text of ["Section1", "@Section1"]) {
                        // eslint-disable-next-line no-await-in-loop
                        const parsed: Task.ParseTaskOk = await AssertTestUtils.assertGetLexParseOk(settings, text);
                        expect(parsed.ast.kind).to.equal(Ast.NodeKind.IdentifierExpression);
                    }
                });

                it("honors a custom section-access parser step", async () => {
                    let callCount: number = 0;

                    const customParser: Parser = {
                        ...parser,
                        readSectionAccessExpression: (
                            state: ParseState,
                            currentParser: Parser,
                            correlationId: number | undefined,
                        ): Ast.SectionAccessExpression => {
                            callCount += 1;

                            return parser.readSectionAccessExpression(state, currentParser, correlationId);
                        },
                    };

                    await AssertTestUtils.assertGetLexParseOk({ ...settings, parser: customParser }, "Section1!abc");
                    expect(callCount).to.equal(1);
                });

                it("reports the missing bang when invoked as a parser entry point", async () => {
                    const error: ParseError.ParseError = await AssertTestUtils.assertGetParseError(
                        {
                            ...settings,
                            // eslint-disable-next-line require-await
                            parserEntryPoint: async (
                                state: ParseState,
                                currentParser: Parser,
                                correlationId: number | undefined,
                            ): Promise<Ast.SectionAccessExpression> =>
                                currentParser.readSectionAccessExpression(state, currentParser, correlationId),
                        },
                        "Section1 abc",
                    );

                    if (!(error.innerError instanceof ParseError.ExpectedTokenKindError)) {
                        throw new Error(`Expected a bang error, got ${error.innerError.message}`);
                    }

                    expect(error.innerError.expectedTokenKind).to.equal(Token.TokenKind.Bang);
                });
            });
        }
    });

    describe(`${Ast.NodeKind.Section}`, () => {
        it(`section;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`section;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`[] section;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`[] section;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.RecordLiteral, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`section foo;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`section foo;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Identifier, 2],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`section; x = 1;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`section; x = 1;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
                [Ast.NodeKind.SectionMember, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 2],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });

        it(`section; x = 1; y = 2;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`section; x = 1; y = 2;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
                [Ast.NodeKind.SectionMember, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 2],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.SectionMember, 1],
                [Ast.NodeKind.IdentifierPairedExpression, 2],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; x = 1;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`section; x = 1;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
                [Ast.NodeKind.SectionMember, 0],
                [Ast.NodeKind.IdentifierPairedExpression, 2],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });

        it(`section; [] x = 1;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`section; [] x = 1;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
                [Ast.NodeKind.SectionMember, 0],
                [Ast.NodeKind.RecordLiteral, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.IdentifierPairedExpression, 2],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });

        it(`section; shared x = 1;`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`section; shared x = 1;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
                [Ast.NodeKind.SectionMember, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.IdentifierPairedExpression, 2],
                [Ast.NodeKind.Identifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 3],
            ]);
        });
    });

    describe(`${Ast.NodeKind.TableType}`, () => {
        it(`type table [x]`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type table [x]`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.TableType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.FieldSpecificationList, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSpecification, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`type table (x)`, async () => {
            await ParserTestUtils.runAbridgedNodeTest(`type table (x)`, [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.TableType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ParenthesizedExpression, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.IdentifierExpression, 1],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });
    });

    // Ast.Ast.NodeKind.TypePrimaryType covered by many

    describe(`${Ast.NodeKind.UnaryExpression}`, () => {
        it(`-1`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`-1`, Constant.UnaryOperator.Negative, [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`not 1`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`not 1`, Constant.UnaryOperator.Not, [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`+1`, async () => {
            await ParserTestUtils.runAbridgedNodeAndOperatorTest(`+1`, Constant.UnaryOperator.Positive, [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });
    });
});
