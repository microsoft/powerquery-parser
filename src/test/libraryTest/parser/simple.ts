// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import {
    Assert,
    DefaultLocale,
    DefaultSettings,
    Language,
    Parser,
    Settings,
    Task,
    TaskUtils,
    Traverse,
} from "../../..";
import { TestAssertUtils } from "../../testUtils";

type AbridgedNode = [Language.Ast.NodeKind, number | undefined];

interface CollectAbridgeNodeState extends Traverse.ITraversalState<AbridgedNode[]> {}

interface NthNodeOfKindState extends Traverse.ITraversalState<Language.Ast.TNode | undefined> {
    readonly nodeKind: Language.Ast.NodeKind;
    readonly nthRequired: number;
    nthCounter: number;
}

function collectAbridgeNodeFromAst(text: string): ReadonlyArray<AbridgedNode> {
    const lexParseOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
    const state: CollectAbridgeNodeState = {
        locale: DefaultLocale,
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
        Traverse.assertGetAllAstChildren,
        undefined,
    );
    Assert.isOk(triedTraverse);

    return triedTraverse.value;
}

function assertGetNthNodeOfKind<N extends Language.Ast.TNode>(
    text: string,
    nodeKind: Language.Ast.NodeKind,
    nthRequired: number,
): N {
    const parseTaskOk: Task.ParseTaskOk = TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);
    const state: NthNodeOfKindState = {
        locale: DefaultLocale,
        result: undefined,
        nodeKind,
        nthCounter: 0,
        nthRequired,
    };

    const triedTraverse: Traverse.TriedTraverse<Language.Ast.TNode | undefined> = Traverse.tryTraverseAst<
        NthNodeOfKindState,
        Language.Ast.TNode | undefined
    >(
        state,
        parseTaskOk.nodeIdMapCollection,
        parseTaskOk.ast,
        Traverse.VisitNodeStrategy.BreadthFirst,
        nthNodeVisit,
        Traverse.assertGetAllAstChildren,
        nthNodeEarlyExit,
    );

    Assert.isOk(triedTraverse);
    return Assert.asDefined(triedTraverse.value) as N;
}

function collectAbridgeNodeVisit(state: CollectAbridgeNodeState, node: Language.Ast.TNode): void {
    state.result.push([node.kind, node.maybeAttributeIndex]);
}

function nthNodeVisit(state: NthNodeOfKindState, node: Language.Ast.TNode): void {
    if (node.kind === state.nodeKind) {
        state.nthCounter += 1;
        if (state.nthCounter === state.nthRequired) {
            state.result = node;
        }
    }
}

function nthNodeEarlyExit(state: NthNodeOfKindState, _: Language.Ast.TNode): boolean {
    return state.nthCounter === state.nthRequired;
}

function assertAbridgeNodes(text: string, expected: ReadonlyArray<AbridgedNode>): void {
    const actual: ReadonlyArray<AbridgedNode> = collectAbridgeNodeFromAst(text);
    expect(actual).deep.equal(expected, JSON.stringify(actual));
}

describe("Parser.AbridgedNode", () => {
    describe(`custom IParser.read`, () => {
        it(`readParameterSpecificationList`, () => {
            const customSettings: Settings = {
                ...DefaultSettings,
                parser: Parser.RecursiveDescentParser,
                maybeParserEntryPointFn: Parser.RecursiveDescentParser.readParameterSpecificationList,
            };
            const triedLexParseTask: Task.TriedLexParseTask = TaskUtils.tryLexParse(
                customSettings,
                "(a as number, optional b as text)",
            );
            TaskUtils.assertIsParseStageOk(triedLexParseTask);
        });
    });

    describe(`${Language.Ast.NodeKind.ArithmeticExpression}`, () => {
        it(`1 & 2`, () => {
            const text: string = `1 & 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.And);
        });

        it(`1 * 2`, () => {
            const text: string = `1 * 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Multiplication);
        });

        it(`1 / 2`, () => {
            const text: string = `1 / 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Division);
        });

        it(`1 + 2`, () => {
            const text: string = `1 + 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Addition);
        });

        it(`1 - 2`, () => {
            const text: string = `1 - 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Subtraction);
        });

        it(`1 + 2 + 3 + 4`, () => {
            const text: string = `1 + 2 + 3 + 4`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.ArithmeticExpression, 0],
                [Language.Ast.NodeKind.ArithmeticExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.AsExpression}`, () => {
        it(`1 as number`, () => {
            const text: string = `1 as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.AsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`type function (x as number) as number`, () => {
            const text: string = `type function (x as number) as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FunctionType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ParameterList, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.AsType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.AsType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.Constant covered by many

    // Ast.NodeKind.Csv covered by many

    it(`${Language.Ast.NodeKind.EachExpression}`, () => {
        const text: string = `each 1`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.EachExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
        ];
        assertAbridgeNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.EqualityExpression}`, () => {
        it(`1 = 2`, () => {
            const text: string = `1 = 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.EqualityExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.EqualityOperator.EqualTo);
        });

        it(`1 <> 2`, () => {
            const text: string = `1 <> 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.EqualityExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.EqualityOperator.NotEqualTo);
        });
    });

    describe(`${Language.Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try 1`, () => {
            const text: string = `try 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`try 1 otherwise 2`, () => {
            const text: string = `try 1 otherwise 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.OtherwiseExpression, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.ErrorRaisingExpression}`, () => {
        const text: string = `error 1`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.ErrorRaisingExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
        ];
        assertAbridgeNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.FieldProjection}`, () => {
        it(`x[[y]]`, () => {
            const text: string = `x[[y]]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Language.Ast.NodeKind.IdentifierExpression, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.FieldProjection, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSelector, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`x[[y], [z]]`, () => {
            const text: string = `x[[y], [z]]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Language.Ast.NodeKind.IdentifierExpression, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.FieldProjection, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSelector, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.FieldSelector, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`x[[y]]?`, () => {
            const text: string = `x[[y]]?`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
                [Language.Ast.NodeKind.IdentifierExpression, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.FieldProjection, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSelector, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSelector}`, () => {
        it(`[x]`, () => {
            const text: string = `[x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`[x]?`, () => {
            const text: string = `[x]?`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSpecification}`, () => {
        it(`type [x]`, () => {
            const text: string = `type [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`type [optional x]`, () => {
            const text: string = `type [optional x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`type [x = number]`, () => {
            const text: string = `type [x = number]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.FieldTypeSpecification, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSpecificationList}`, () => {
        it(`${Language.Ast.NodeKind.FieldSpecificationList}`, () => {
            const text: string = `type [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`type [x, ...]`, () => {
            const text: string = `type [x, ...]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by FieldSpecification

    describe(`${Language.Ast.NodeKind.FunctionExpression}`, () => {
        it(`() => 1`, () => {
            const text: string = `() => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(x) => 1`, () => {
            const text: string = `(x) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(x, y, z) => 1`, () => {
            const text: string = `(x, y, z) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 2],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(optional x) => 1`, () => {
            const text: string = `(optional x) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(x as nullable text) => 1`, () => {
            const text: string = `(x as nullable text) => 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.AsNullablePrimitiveType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.NullablePrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(x) as number => x`, () => {
            const text: string = `(x) as number => x`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.IdentifierExpression, 3],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(x as number) as number => x`, () => {
            const text: string = `(x as number) as number => x`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.AsNullablePrimitiveType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.IdentifierExpression, 3],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(x as number) as nullable number => x`, () => {
            const text: string = `(x as number) as nullable number => x`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.AsNullablePrimitiveType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.NullablePrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.IdentifierExpression, 3],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`let Fn = () as nullable text => "asd" in Fn`, () => {
            const text: string = `let Fn = () as nullable text => "asd" in Fn`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LetExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.FunctionExpression, 2],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.AsNullablePrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.NullablePrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.IdentifierExpression, 3],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FunctionType}`, () => {
        it(`type function () as number`, () => {
            const text: string = `type function () as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FunctionType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ParameterList, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.AsType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`type function (x as number) as number`, () => {
            const text: string = `type function (x as number) as number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FunctionType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ParameterList, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.Parameter, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.AsType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.AsType, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.PrimitiveType, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by AsType

    describe(`${Language.Ast.NodeKind.GeneralizedIdentifier}`, () => {
        it(`[foo bar]`, () => {
            const text: string = `[foo bar]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`[1]`, () => {
            const text: string = `[1]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`[a.1]`, () => {
            const text: string = `[a.1]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`[#"a""" = 1]`, () => {
            const text: string = `[#"a""" = 1]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RecordExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    it(`Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral`, () => {
        const text: string = `[x=1] section;`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.Section, undefined],
            [Language.Ast.NodeKind.RecordLiteral, 0],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.Csv, 0],
            [Language.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, 0],
            [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.LiteralExpression, 2],
            [Language.Ast.NodeKind.Constant, 2],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.Constant, 3],
            [Language.Ast.NodeKind.ArrayWrapper, 4],
        ];
        assertAbridgeNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression}`, () => {
        const text: string = `[x=1]`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.RecordExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.Csv, 0],
            [Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
            [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.LiteralExpression, 2],
            [Language.Ast.NodeKind.Constant, 2],
        ];
        assertAbridgeNodes(text, expected);
    });

    // Ast.NodeKind.Identifier covered by many

    describe(`${Language.Ast.NodeKind.IdentifierExpression}`, () => {
        it(`@foo`, () => {
            const text: string = `@foo`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.IdentifierPairedExpression}`, () => {
        const text: string = `section; x = 1;`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.Section, undefined],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.Constant, 3],
            [Language.Ast.NodeKind.ArrayWrapper, 4],
            [Language.Ast.NodeKind.SectionMember, 0],
            [Language.Ast.NodeKind.IdentifierPairedExpression, 2],
            [Language.Ast.NodeKind.Identifier, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.LiteralExpression, 2],
            [Language.Ast.NodeKind.Constant, 3],
        ];
        assertAbridgeNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.IfExpression}`, () => {
        const text: string = `if x then x else x`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.IfExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.IdentifierExpression, 1],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.Constant, 2],
            [Language.Ast.NodeKind.IdentifierExpression, 3],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.Constant, 4],
            [Language.Ast.NodeKind.IdentifierExpression, 5],
            [Language.Ast.NodeKind.Identifier, 1],
        ];
        assertAbridgeNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.InvokeExpression}`, () => {
        const text: string = `foo()`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Language.Ast.NodeKind.IdentifierExpression, 0],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.InvokeExpression, 0],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.Constant, 2],
        ];
        assertAbridgeNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.IsExpression}`, () => {
        it(`1 is number`, () => {
            const text: string = `1 is number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`1 is number is number`, () => {
            const text: string = `1 is number is number`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IsExpression, undefined],
                [Language.Ast.NodeKind.IsExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.ItemAccessExpression}`, () => {
        const text: string = `x{1}`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Language.Ast.NodeKind.IdentifierExpression, 0],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.ItemAccessExpression, 0],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
            [Language.Ast.NodeKind.Constant, 2],
        ];
        assertAbridgeNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.ItemAccessExpression} optional`, () => {
        const text: string = `x{1}?`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Language.Ast.NodeKind.IdentifierExpression, 0],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.ItemAccessExpression, 0],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
            [Language.Ast.NodeKind.Constant, 2],
            [Language.Ast.NodeKind.Constant, 3],
        ];
        assertAbridgeNodes(text, expected);
    });

    describe(`keywords`, () => {
        it(`#sections`, () => {
            const text: string = `#sections`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`#shared`, () => {
            const text: string = `#shared`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.LetExpression}`, () => {
        it(`let x = 1 in x`, () => {
            const text: string = `let x = 1 in x`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LetExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.IdentifierExpression, 3],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`let x = 1 in try x`, () => {
            const text: string = `let x = 1 in try x`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LetExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.ErrorHandlingExpression, 3],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.IdentifierExpression, 1],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ListExpression}`, () => {
        it(`{}`, () => {
            const text: string = `{}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`{1, 2}`, () => {
            const text: string = `{1, 2}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`{1..2}`, () => {
            const text: string = `{1..2}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.RangeExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`{1..2, 3..4}`, () => {
            const text: string = `{1..2, 3..4}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.RangeExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.RangeExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`{1, 2..3}`, () => {
            const text: string = `{1, 2..3}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.RangeExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`{1..2, 3}`, () => {
            const text: string = `{1..2, 3}`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.RangeExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`let x = 1, y = {x..2} in y`, () => {
            const text: string = `let x = 1, y = {x..2} in y`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LetExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.ListExpression, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.RangeExpression, 0],
                [Language.Ast.NodeKind.IdentifierExpression, 0],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.IdentifierExpression, 3],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ListLiteral}`, () => {
        it(`[foo = {1}] section;`, () => {
            const text: string = `[foo = {1}] section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.RecordLiteral, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.ListLiteral, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`[foo = {}] section;`, () => {
            const text: string = `[foo = {}] section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.RecordLiteral, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.ListLiteral, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.ListType}`, () => {
        const text: string = `type {number}`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.TypePrimaryType, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ListType, 1],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
            [Language.Ast.NodeKind.Constant, 2],
        ];
        assertAbridgeNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, () => {
            const text: string = `true`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`false`, () => {
            const text: string = `false`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`1`, () => {
            const text: string = `1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`0x1`, () => {
            const text: string = `0x1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`0X1`, () => {
            const text: string = `0X1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`1.2`, () => {
            const text: string = `1.2`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`.1`, () => {
            const text: string = ".1";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`1e2`, () => {
            const text: string = "1e2";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`1e+2`, () => {
            const text: string = "1e+2";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`1e-2`, () => {
            const text: string = "1e-2";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`#nan`, () => {
            const text: string = `#nan`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`#infinity`, () => {
            const text: string = `#infinity`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`""`, () => {
            const text: string = `""`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`""""`, () => {
            const text: string = `""""`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });

        it(`null`, () => {
            const text: string = `null`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.LogicalExpression}`, () => {
        it(`true and true`, () => {
            const text: string = `true and true`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`true or true`, () => {
            const text: string = `true or true`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.MetadataExpression}`, () => {
        const text: string = `1 meta 1`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.MetadataExpression, undefined],
            [Language.Ast.NodeKind.LiteralExpression, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.LiteralExpression, 2],
        ];
        assertAbridgeNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.NotImplementedExpression}`, () => {
        const text: string = `...`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.NotImplementedExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
        ];
        assertAbridgeNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.NullablePrimitiveType}`, () => {
        const text: string = `1 is nullable number`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.IsExpression, undefined],
            [Language.Ast.NodeKind.LiteralExpression, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.NullablePrimitiveType, 2],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
        ];
        assertAbridgeNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.NullableType}`, () => {
        const text: string = `type nullable number`;
        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.TypePrimaryType, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.NullableType, 1],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
        ];
        assertAbridgeNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.NullCoalescingExpression}`, () => {
        it(`1 ?? a`, () => {
            const text: string = `1 ?? a`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.NullCoalescingExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.IdentifierExpression, 2],
                [Language.Ast.NodeKind.Identifier, 1],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`1 ?? 1 ?? 1`, () => {
            const text: string = `1 ?? 1 ?? 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.NullCoalescingExpression, undefined],
                [Language.Ast.NodeKind.NullCoalescingExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.OtherwiseExpression covered by `${Language.Ast.NodeKind.ErrorHandlingExpression} otherwise`

    // Ast.NodeKind.Parameter covered by many

    // Ast.NodeKind.ParameterList covered by many

    describe(`${Language.Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`(1)`, () => {
            const text: string = `(1)`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ParenthesizedExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(1) + 1`, () => {
            const text: string = `(1) + 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.ParenthesizedExpression, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`(if true then true else false) and true`, () => {
            const text: string = `(if true then true else false) and true`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.ParenthesizedExpression, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.IfExpression, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
                [Language.Ast.NodeKind.Constant, 4],
                [Language.Ast.NodeKind.LiteralExpression, 5],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`((1)) and true`, () => {
            const text: string = `((1)) and true`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.ParenthesizedExpression, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ParenthesizedExpression, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.PrimitiveType}`, () => {
        it(`1 as time`, () => {
            const text: string = `1 as time`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.AsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.RecordExpression}`, () => {
        it(`[x=1]`, () => {
            const text: string = `[x=1]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RecordExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`[]`, () => {
            const text: string = `[]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RecordExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.RecordLiteral covered by many

    describe(`${Language.Ast.NodeKind.RecordType}`, () => {
        it(`type [x]`, () => {
            const text: string = `type [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`type [x, ...]`, () => {
            const text: string = `type [x, ...]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.RecursivePrimaryExpression covered by many

    describe(`${Language.Ast.NodeKind.RelationalExpression}`, () => {
        it(`1 > 2`, () => {
            const text: string = `1 > 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.GreaterThan);
        });

        it(`1 >= 2`, () => {
            const text: string = `1 >= 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.GreaterThanEqualTo);
        });

        it(`1 < 2`, () => {
            const text: string = `1 < 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.LessThan);
        });

        it(`1 <= 2`, () => {
            const text: string = `1 <= 2`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.LessThanEqualTo);
        });
    });

    describe(`${Language.Ast.NodeKind.Section}`, () => {
        it(`section;`, () => {
            const text: string = `section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`[] section;`, () => {
            const text: string = `[] section;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.RecordLiteral, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`section foo;`, () => {
            const text: string = `section foo;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Identifier, 2],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`section; x = 1;`, () => {
            const text: string = `section; x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
                [Language.Ast.NodeKind.SectionMember, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 2],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`section; x = 1; y = 2;`, () => {
            const text: string = `section; x = 1; y = 2;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
                [Language.Ast.NodeKind.SectionMember, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 2],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.SectionMember, 1],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 2],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.SectionMember}`, () => {
        it(`section; x = 1;`, () => {
            const text: string = `section; x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
                [Language.Ast.NodeKind.SectionMember, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 2],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`section; [] x = 1;`, () => {
            const text: string = `section; [] x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
                [Language.Ast.NodeKind.SectionMember, 0],
                [Language.Ast.NodeKind.RecordLiteral, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 2],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`section; shared x = 1;`, () => {
            const text: string = `section; shared x = 1;`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
                [Language.Ast.NodeKind.SectionMember, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 2],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.TableType}`, () => {
        it(`type table [x]`, () => {
            const text: string = `type table [x]`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.TableType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FieldSpecificationList, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.FieldSpecification, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });

        it(`type table (x)`, () => {
            const text: string = `type table (x)`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.TableType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ParenthesizedExpression, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.IdentifierExpression, 1],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];
            assertAbridgeNodes(text, expected);
        });
    });

    // Ast.NodeKind.TypePrimaryType covered by many

    describe(`${Language.Ast.NodeKind.UnaryExpression}`, () => {
        it(`-1`, () => {
            const text: string = `-1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Negative);
        });

        it(`not 1`, () => {
            const text: string = `not 1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Not);
        });

        it(`+1`, () => {
            const text: string = `+1`;
            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];
            assertAbridgeNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );
            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Positive);
        });
    });
});
