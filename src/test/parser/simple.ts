// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { ResultUtils, Traverse } from "../../common";
import { DefaultTemplates } from "../../localization";
import { Ast, IParserState } from "../../parser";
import { DefaultSettings } from "../../settings";
import { LexParseOk } from "../../tasks";
import { expectLexParseOk } from "../common";

type AbridgedNode = [Ast.NodeKind, number | undefined];

interface CollectAbridgeNodeState extends Traverse.IState<AbridgedNode[]> {}

interface NthNodeOfKindState extends Traverse.IState<Ast.TNode | undefined> {
    readonly nodeKind: Ast.NodeKind;
    readonly nthRequired: number;
    nthCounter: number;
}

function collectAbridgeNodeFromAst(text: string): ReadonlyArray<AbridgedNode> {
    const lexParseOk: LexParseOk<IParserState> = expectLexParseOk(DefaultSettings, text);
    const state: CollectAbridgeNodeState = {
        localizationTemplates: DefaultTemplates,
        result: [],
    };

    const triedTraverse: Traverse.TriedTraverse<AbridgedNode[]> = Traverse.tryTraverseAst<
        CollectAbridgeNodeState,
        AbridgedNode[]
    >(
        state,
        lexParseOk.nodeIdMapCollection,
        lexParseOk.ast,
        Traverse.VisitNodeStrategy.BreadthFirst,
        collectAbridgeNodeVisit,
        Traverse.expectExpandAllAstChildren,
        undefined,
    );

    if (!ResultUtils.isOk(triedTraverse)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedTraverse): ${triedTraverse.error.message}`);
    }

    return triedTraverse.value;
}

function expectNthNodeOfKind<T>(text: string, nodeKind: Ast.NodeKind, nthRequired: number): T & Ast.TNode {
    const lexParseOk: LexParseOk<IParserState> = expectLexParseOk(DefaultSettings, text);
    const state: NthNodeOfKindState = {
        localizationTemplates: DefaultTemplates,
        result: undefined,
        nodeKind,
        nthCounter: 0,
        nthRequired,
    };

    const triedTraverse: Traverse.TriedTraverse<Ast.TNode | undefined> = Traverse.tryTraverseAst<
        NthNodeOfKindState,
        Ast.TNode | undefined
    >(
        state,
        lexParseOk.nodeIdMapCollection,
        lexParseOk.ast,
        Traverse.VisitNodeStrategy.BreadthFirst,
        nthNodeVisit,
        Traverse.expectExpandAllAstChildren,
        nthNodeEarlyExit,
    );

    if (!ResultUtils.isOk(triedTraverse)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedTraverse): ${triedTraverse.error.message}`);
    }
    const maybeAstNode: Ast.TNode | undefined = triedTraverse.value;
    if (!(maybeAstNode !== undefined)) {
        throw new Error(`AssertFailed: maybeAstNode !== undefined`);
    }
    const astNode: Ast.TNode = maybeAstNode;

    return astNode as T & Ast.TNode;
}

function collectAbridgeNodeVisit(state: CollectAbridgeNodeState, node: Ast.TNode): void {
    state.result.push([node.kind, node.maybeAttributeIndex]);
}

function nthNodeVisit(state: NthNodeOfKindState, node: Ast.TNode): void {
    if (node.kind === state.nodeKind) {
        state.nthCounter += 1;
        if (state.nthCounter === state.nthRequired) {
            state.result = node;
        }
    }
}

function nthNodeEarlyExit(state: NthNodeOfKindState, _: Ast.TNode): boolean {
    return state.nthCounter === state.nthRequired;
}

function expectAbridgeNodes(text: string, expected: ReadonlyArray<AbridgedNode>): void {
    const actual: ReadonlyArray<AbridgedNode> = collectAbridgeNodeFromAst(text);
    expect(actual).deep.equal(expected, JSON.stringify(actual));
}

describe("Parser.AbridgedNode", () => {
    describe(`${Ast.NodeKind.ArithmeticExpression}`, () => {
        it(`1 & 2`, () => {
            const text: string = `1 & 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.ArithmeticOperatorKind.And);
        });

        it(`1 * 2`, () => {
            const text: string = `1 * 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.ArithmeticOperatorKind.Multiplication);
        });

        it(`1 / 2`, () => {
            const text: string = `1 / 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.ArithmeticOperatorKind.Division);
        });

        it(`1 + 2`, () => {
            const text: string = `1 + 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.ArithmeticOperatorKind.Addition);
        });

        it(`1 - 2`, () => {
            const text: string = `1 - 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.ArithmeticOperatorKind.Subtraction);
        });

        it(`1 + 2 + 3 + 4`, () => {
            const text: string = `1 + 2 + 3 + 4`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.AsExpression}`, () => {
        it(`1 as number`, () => {
            const text: string = `1 as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.AsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`type function (x as number) as number`, () => {
            const text: string = `type function (x as number) as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.Constant covered by many

    // Ast.NodeKind.Csv covered by many

    it(Ast.NodeKind.EachExpression, () => {
        const text: string = `each 1`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.EachExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
        ];
        expectAbridgeNodes(text, expected);
    });

    describe(`${Ast.NodeKind.EqualityExpression}`, () => {
        it(`1 = 2`, () => {
            const text: string = `1 = 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.EqualityExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.EqualityOperatorKind.EqualTo);
        });

        it(`1 <> 2`, () => {
            const text: string = `1 <> 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.EqualityExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.EqualityOperatorKind.NotEqualTo);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try 1`, () => {
            const text: string = `try 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`try 1 otherwise 2`, () => {
            const text: string = `try 1 otherwise 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.OtherwiseExpression, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    it(Ast.NodeKind.ErrorRaisingExpression, () => {
        const text: string = `error 1`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.ErrorRaisingExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
        ];
        expectAbridgeNodes(text, expected);
    });

    describe(`${Ast.NodeKind.FieldProjection}`, () => {
        it(`x[[y]]`, () => {
            const text: string = `x[[y]]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Ast.NodeKind.IdentifierExpression, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.FieldProjection, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.FieldSelector, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`x[[y], [z]]`, () => {
            const text: string = `x[[y], [z]]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Ast.NodeKind.IdentifierExpression, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.ArrayWrapper, 0],
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`x[[y]]?`, () => {
            const text: string = `x[[y]]?`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Ast.NodeKind.IdentifierExpression, 0],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.ArrayWrapper, 0],
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
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.FieldSelector}`, () => {
        it(`[x]`, () => {
            const text: string = `[x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`[x]?`, () => {
            const text: string = `[x]?`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 3],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.FieldSpecification}`, () => {
        it(`type [x]`, () => {
            const text: string = `type [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`type [optional x]`, () => {
            const text: string = `type [optional x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`type [x = number]`, () => {
            const text: string = `type [x = number]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.FieldSpecificationList}`, () => {
        it(Ast.NodeKind.FieldSpecificationList, () => {
            const text: string = `type [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`type [x, ...]`, () => {
            const text: string = `type [x, ...]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by FieldSpecification

    describe(`${Ast.NodeKind.FunctionExpression}`, () => {
        it(`() => 1`, () => {
            const text: string = `() => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.FunctionExpression, undefined],
                [Ast.NodeKind.ParameterList, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`(x) => 1`, () => {
            const text: string = `(x) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`(x, y, z) => 1`, () => {
            const text: string = `(x, y, z) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`(optional x) => 1`, () => {
            const text: string = `(optional x) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`(x as nullable text) => 1`, () => {
            const text: string = `(x as nullable text) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.LiteralExpression, 3],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.FunctionType}`, () => {
        it(`type function () as number`, () => {
            const text: string = `type function () as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
                [Ast.NodeKind.Constant, 0],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`type function (x as number) as number`, () => {
            const text: string = `type function (x as number) as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.AsType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.PrimitiveType, 1],
                [Ast.NodeKind.Constant, 0],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by AsType

    describe(`${Ast.NodeKind.GeneralizedIdentifier}`, () => {
        it(`[foo bar]`, () => {
            const text: string = `[foo bar]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`[1]`, () => {
            const text: string = `[1]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`[a.1]`, () => {
            const text: string = `[a.1]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    it(Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, () => {
        const text: string = `[x=1] section;`;
        const expected: ReadonlyArray<AbridgedNode> = [
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
        ];
        expectAbridgeNodes(text, expected);
    });

    it(Ast.NodeKind.GeneralizedIdentifierPairedExpression, () => {
        const text: string = `[x=1]`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.RecordExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.Csv, 0],
            [Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
            [Ast.NodeKind.GeneralizedIdentifier, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.LiteralExpression, 2],
            [Ast.NodeKind.Constant, 2],
        ];
        expectAbridgeNodes(text, expected);
    });

    // Ast.NodeKind.Identifier covered by many

    it(Ast.NodeKind.IdentifierExpression, () => {
        const text: string = `@foo`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.IdentifierExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.Identifier, 1],
        ];
        expectAbridgeNodes(text, expected);
    });

    // Ast.NodeKind.IdentifierExpressionPairedExpression covered by LetExpression

    it(Ast.NodeKind.IdentifierPairedExpression, () => {
        const text: string = `section; x = 1;`;
        const expected: ReadonlyArray<AbridgedNode> = [
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
        ];
        expectAbridgeNodes(text, expected);
    });

    it(Ast.NodeKind.IfExpression, () => {
        const text: string = `if x then x else x`;
        const expected: ReadonlyArray<AbridgedNode> = [
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
        ];
        expectAbridgeNodes(text, expected);
    });

    it(Ast.NodeKind.InvokeExpression, () => {
        const text: string = `foo()`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Ast.NodeKind.IdentifierExpression, 0],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.ArrayWrapper, 0],
            [Ast.NodeKind.InvokeExpression, 0],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.ArrayWrapper, 1],
            [Ast.NodeKind.Constant, 2],
        ];
        expectAbridgeNodes(text, expected);
    });

    describe(`${Ast.NodeKind.IsExpression}`, () => {
        it(`1 is number`, () => {
            const text: string = `1 is number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.IsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`1 is number is number`, () => {
            const text: string = `1 is number is number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.IsExpression, undefined],
                [Ast.NodeKind.IsExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    it(Ast.NodeKind.ItemAccessExpression, () => {
        const text: string = `x{1}`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Ast.NodeKind.IdentifierExpression, 0],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.ArrayWrapper, 0],
            [Ast.NodeKind.ItemAccessExpression, 0],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
            [Ast.NodeKind.Constant, 2],
        ];
        expectAbridgeNodes(text, expected);
    });

    it(`${Ast.NodeKind.ItemAccessExpression} optional`, () => {
        const text: string = `x{1}?`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Ast.NodeKind.IdentifierExpression, 0],
            [Ast.NodeKind.Identifier, 1],
            [Ast.NodeKind.ArrayWrapper, 0],
            [Ast.NodeKind.ItemAccessExpression, 0],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
            [Ast.NodeKind.Constant, 2],
            [Ast.NodeKind.Constant, 3],
        ];
        expectAbridgeNodes(text, expected);
    });

    describe(`keywords`, () => {
        it(`#sections`, () => {
            const text: string = `#sections`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`#shared`, () => {
            const text: string = `#shared`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    it(Ast.NodeKind.LetExpression, () => {
        const text: string = `let x = 1 in x`;
        const expected: ReadonlyArray<AbridgedNode> = [
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
        ];
        expectAbridgeNodes(text, expected);
    });

    describe(`${Ast.NodeKind.ListExpression}`, () => {
        it(`{}`, () => {
            const text: string = `{}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`{1, 2}`, () => {
            const text: string = `{1, 2}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Csv, 1],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`{1..2}`, () => {
            const text: string = `{1..2}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.RangeExpression, 0],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`{1..2, 3..4}`, () => {
            const text: string = `{1..2, 3..4}`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`{1, 2..3}`, () => {
            const text: string = `{1, 2..3}`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`{1..2, 3}`, () => {
            const text: string = `{1..2, 3}`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.ListLiteral}`, () => {
        it(`[foo = {1}] section;`, () => {
            const text: string = `[foo = {1}] section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`[foo = {}] section;`, () => {
            const text: string = `[foo = {}] section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    it(Ast.NodeKind.ListType, () => {
        const text: string = `type {number}`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.TypePrimaryType, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.ListType, 1],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.Constant, 2],
        ];
        expectAbridgeNodes(text, expected);
    });

    describe(`${Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, () => {
            const text: string = `true`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`false`, () => {
            const text: string = `false`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`1`, () => {
            const text: string = `1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`0x1`, () => {
            const text: string = `0x1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`0X1`, () => {
            const text: string = `0X1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`1.2`, () => {
            const text: string = `1.2`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`.1`, () => {
            const text: string = ".1";
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`1e2`, () => {
            const text: string = "1e2";
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`1e+2`, () => {
            const text: string = "1e+2";
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`1e-2`, () => {
            const text: string = "1e-2";
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`#nan`, () => {
            const text: string = `#nan`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`""`, () => {
            const text: string = `""`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`""""`, () => {
            const text: string = `""""`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });

        it(`null`, () => {
            const text: string = `null`;
            const expected: ReadonlyArray<AbridgedNode> = [[Ast.NodeKind.LiteralExpression, undefined]];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.LogicalExpression}`, () => {
        it(`true and true`, () => {
            const text: string = `true and true`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`true or true`, () => {
            const text: string = `true or true`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    it(Ast.NodeKind.MetadataExpression, () => {
        const text: string = `1 meta 1`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.MetadataExpression, undefined],
            [Ast.NodeKind.LiteralExpression, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.LiteralExpression, 2],
        ];
        expectAbridgeNodes(text, expected);
    });

    it(Ast.NodeKind.NotImplementedExpression, () => {
        const text: string = `...`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.NotImplementedExpression, undefined],
            [Ast.NodeKind.Constant, 0],
        ];
        expectAbridgeNodes(text, expected);
    });

    it(Ast.NodeKind.NullablePrimitiveType, () => {
        const text: string = `1 is nullable number`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.IsExpression, undefined],
            [Ast.NodeKind.LiteralExpression, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.NullablePrimitiveType, 2],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
            [Ast.NodeKind.Constant, 0],
        ];
        expectAbridgeNodes(text, expected);
    });

    it(Ast.NodeKind.NullableType, () => {
        const text: string = `type nullable number`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.TypePrimaryType, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.NullableType, 1],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
            [Ast.NodeKind.Constant, 0],
        ];
        expectAbridgeNodes(text, expected);
    });

    // Ast.NodeKind.OtherwiseExpression covered by `${Ast.NodeKind.ErrorHandlingExpression} otherwise`

    // Ast.NodeKind.Parameter covered by many

    // Ast.NodeKind.ParameterList covered by many

    it(Ast.NodeKind.ParenthesizedExpression, () => {
        const text: string = `(1)`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Ast.NodeKind.ParenthesizedExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
            [Ast.NodeKind.Constant, 2],
        ];
        expectAbridgeNodes(text, expected);
    });

    describe(`${Ast.NodeKind.PrimitiveType}`, () => {
        it(`1 as time`, () => {
            const text: string = `1 as time`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.AsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
                [Ast.NodeKind.Constant, 0],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`[x=1]`, () => {
            const text: string = `[x=1]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RecordExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Csv, 0],
                [Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`[]`, () => {
            const text: string = `[]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RecordExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.RecordLiteral covered by many

    describe(`${Ast.NodeKind.RecordType}`, () => {
        it(`type [x]`, () => {
            const text: string = `type [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`type [x, ...]`, () => {
            const text: string = `type [x, ...]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.RecursivePrimaryExpression covered by many

    describe(`${Ast.NodeKind.RelationalExpression}`, () => {
        it(`1 > 2`, () => {
            const text: string = `1 > 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.RelationalOperatorKind.GreaterThan);
        });

        it(`1 >= 2`, () => {
            const text: string = `1 >= 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.RelationalOperatorKind.GreaterThanEqualTo);
        });

        it(`1 < 2`, () => {
            const text: string = `1 < 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.RelationalOperatorKind.LessThan);
        });

        it(`1 <= 2`, () => {
            const text: string = `1 <= 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.RelationalOperatorKind.LessThanEqualTo);
        });
    });

    describe(`${Ast.NodeKind.Section}`, () => {
        it(`section;`, () => {
            const text: string = `section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`[] section;`, () => {
            const text: string = `[] section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.RecordLiteral, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`section foo;`, () => {
            const text: string = `section foo;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Identifier, 2],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`section; x = 1;`, () => {
            const text: string = `section; x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`section; x = 1; y = 2;`, () => {
            const text: string = `section; x = 1; y = 2;`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.SectionMember}`, () => {
        it(`section; x = 1;`, () => {
            const text: string = `section; x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`section; [] x = 1;`, () => {
            const text: string = `section; [] x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`section; shared x = 1;`, () => {
            const text: string = `section; shared x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    describe(`${Ast.NodeKind.TableType}`, () => {
        it(`type table [x]`, () => {
            const text: string = `type table [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
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
            ];
            expectAbridgeNodes(text, expected);
        });

        it(`type table (x)`, () => {
            const text: string = `type table (x)`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.TypePrimaryType, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.TableType, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ParenthesizedExpression, 1],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.IdentifierExpression, 1],
                [Ast.NodeKind.Identifier, 1],
                [Ast.NodeKind.Constant, 2],
            ];
            expectAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.TypePrimaryType covered by many

    describe(`${Ast.NodeKind.UnaryExpression}`, () => {
        it(`-1`, () => {
            const text: string = `-1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.UnaryOperatorKind.Negative);
        });

        it(`not 1`, () => {
            const text: string = `not 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.UnaryOperatorKind.Not);
        });

        it(`+1`, () => {
            const text: string = `+1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ];
            expectAbridgeNodes(text, expected);

            const operatorNode: Ast.TConstant = expectNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);
            expect(operatorNode.constantKind).to.equal(Ast.UnaryOperatorKind.Positive);
        });
    });
});
