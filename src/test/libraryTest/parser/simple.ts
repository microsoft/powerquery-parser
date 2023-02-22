// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import {
    Assert,
    DefaultLocale,
    DefaultSettings,
    Language,
    Parser,
    ResultUtils,
    Settings,
    Task,
    TaskUtils,
    Traverse,
} from "../../..";
import { TXorNode, XorNodeUtils } from "../../../powerquery-parser/parser";
import { NoOpTraceManagerInstance } from "../../../powerquery-parser/common/trace";
import { TestAssertUtils } from "../../testUtils";

type AbridgedNode = [Language.Ast.NodeKind, number | undefined];

type CollectAbridgeNodeState = Traverse.ITraversalState<AbridgedNode[]>;

interface NthNodeOfKindState extends Traverse.ITraversalState<Language.Ast.TNode | undefined> {
    readonly nodeKind: Language.Ast.NodeKind;
    readonly nthRequired: number;
    nthCounter: number;
}

async function collectAbridgeNodeFromAst(text: string): Promise<ReadonlyArray<AbridgedNode>> {
    const lexParseOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);

    const state: CollectAbridgeNodeState = {
        locale: DefaultLocale,
        result: [],
        cancellationToken: undefined,
        initialCorrelationId: undefined,
        traceManager: NoOpTraceManagerInstance,
    };

    const triedTraverse: Traverse.TriedTraverse<AbridgedNode[]> = await Traverse.tryTraverseAst<
        CollectAbridgeNodeState,
        AbridgedNode[]
    >(
        state,
        lexParseOk.nodeIdMapCollection,
        lexParseOk.ast,
        Traverse.VisitNodeStrategy.BreadthFirst,
        collectAbridgeAstNodeVisit,
        Traverse.assertGetAllAstChildren,
        undefined,
    );

    ResultUtils.assertIsOk(triedTraverse);

    return triedTraverse.value;
}

async function collectAbridgeNodeFromContext(text: string): Promise<ReadonlyArray<AbridgedNode>> {
    const parseError: Task.ParseTaskParseError = await TestAssertUtils.assertGetLexParseError(DefaultSettings, text);

    const state: CollectAbridgeNodeState = {
        locale: DefaultLocale,
        result: [],
        cancellationToken: undefined,
        initialCorrelationId: undefined,
        traceManager: NoOpTraceManagerInstance,
    };

    const triedTraverse: Traverse.TriedTraverse<AbridgedNode[]> = await Traverse.tryTraverseXor<
        CollectAbridgeNodeState,
        AbridgedNode[]
    >(
        state,
        parseError.nodeIdMapCollection,
        XorNodeUtils.boxContext(Assert.asDefined(parseError.parseState.contextState.root)),
        Traverse.VisitNodeStrategy.BreadthFirst,
        collectAbridgeXorNodeVisit,
        Traverse.assertGetAllXorChildren,
        undefined,
    );

    ResultUtils.assertIsOk(triedTraverse);

    return triedTraverse.value;
}

async function assertGetNthNodeOfKind<N extends Language.Ast.TNode>(
    text: string,
    nodeKind: Language.Ast.NodeKind,
    nthRequired: number,
): Promise<N> {
    const parseTaskOk: Task.ParseTaskOk = await TestAssertUtils.assertGetLexParseOk(DefaultSettings, text);

    const state: NthNodeOfKindState = {
        locale: DefaultLocale,
        result: undefined,
        nodeKind,
        nthCounter: 0,
        nthRequired,
        cancellationToken: undefined,
        initialCorrelationId: undefined,
        traceManager: NoOpTraceManagerInstance,
    };

    const triedTraverse: Traverse.TriedTraverse<Language.Ast.TNode | undefined> = await Traverse.tryTraverseAst<
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

    ResultUtils.assertIsOk(triedTraverse);

    return Assert.asDefined(triedTraverse.value) as N;
}

// eslint-disable-next-line require-await
async function collectAbridgeAstNodeVisit(state: CollectAbridgeNodeState, node: Language.Ast.TNode): Promise<void> {
    state.result.push([node.kind, node.attributeIndex]);
}

// eslint-disable-next-line require-await
async function collectAbridgeXorNodeVisit(state: CollectAbridgeNodeState, xorNode: TXorNode): Promise<void> {
    state.result.push([xorNode.node.kind, xorNode.node.attributeIndex]);
}

// eslint-disable-next-line require-await
async function nthNodeVisit(state: NthNodeOfKindState, node: Language.Ast.TNode): Promise<void> {
    if (node.kind === state.nodeKind) {
        state.nthCounter += 1;

        if (state.nthCounter === state.nthRequired) {
            state.result = node;
        }
    }
}

// eslint-disable-next-line require-await
async function nthNodeEarlyExit(state: NthNodeOfKindState, _: Language.Ast.TNode): Promise<boolean> {
    return state.nthCounter === state.nthRequired;
}

async function assertAbridgeAstNodes(text: string, expected: ReadonlyArray<AbridgedNode>): Promise<void> {
    const actual: ReadonlyArray<AbridgedNode> = await collectAbridgeNodeFromAst(text);
    expect(actual).deep.equal(expected, JSON.stringify(actual));
}

async function assertAbridgeContextNodes(text: string, expected: ReadonlyArray<AbridgedNode>): Promise<void> {
    const actual: ReadonlyArray<AbridgedNode> = await collectAbridgeNodeFromContext(text);
    expect(actual).deep.equal(expected, JSON.stringify(actual));
}

describe("Parser.AbridgedNode", () => {
    describe(`custom IParser.read`, () => {
        it(`readParameterSpecificationList`, async () => {
            const customSettings: Settings = {
                ...DefaultSettings,
                parser: Parser.RecursiveDescentParser,
                parserEntryPoint: Parser.RecursiveDescentParser.readParameterSpecificationList,
            };

            const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                customSettings,
                "(a as number, optional b as text)",
            );

            TaskUtils.assertIsParseStageOk(triedLexParseTask);
        });
    });

    describe(`${Language.Ast.NodeKind.ArithmeticExpression}`, () => {
        it(`1 & 2`, async () => {
            const text: string = `1 & 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.And);
        });

        it(`1 * 2`, async () => {
            const text: string = `1 * 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Multiplication);
        });

        it(`1 / 2`, async () => {
            const text: string = `1 / 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Division);
        });

        it(`1 + 2`, async () => {
            const text: string = `1 + 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Addition);
        });

        it(`1 - 2`, async () => {
            const text: string = `1 - 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Subtraction);
        });

        it(`1 + 2 + 3 + 4`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.AsExpression}`, () => {
        it(`1 as number`, async () => {
            const text: string = `1 as number`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.AsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type function (x as number) as number`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    // Ast.NodeKind.Constant covered by many

    // Ast.NodeKind.Csv covered by many

    it(`${Language.Ast.NodeKind.EachExpression}`, async () => {
        const text: string = `each 1`;

        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.EachExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
        ];

        await assertAbridgeAstNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.EqualityExpression}`, () => {
        it(`1 = 2`, async () => {
            const text: string = `1 = 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.EqualityExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.EqualityOperator.EqualTo);
        });

        it(`1 <> 2`, async () => {
            const text: string = `1 <> 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.EqualityExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.EqualityOperator.NotEqualTo);
        });
    });

    describe(`${Language.Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try 1`, async () => {
            const text: string = `try 1`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`try 1 otherwise 2`, async () => {
            const text: string = `try 1 otherwise 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.OtherwiseExpression, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`try 1 catch () => 1`, async () => {
            const text: string = `try 1 catch () => 1`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.CatchExpression, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FunctionExpression, 1],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`try 1 catch (x) => 1`, async () => {
            const text: string = `try 1 catch (x) => 1`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.CatchExpression, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FunctionExpression, 1],
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.ErrorRaisingExpression}`, async () => {
        const text: string = `error 1`;

        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.ErrorRaisingExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
        ];

        await assertAbridgeAstNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.FieldProjection}`, () => {
        it(`x[[y]]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`x[[y], [z]]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`x[[y]]?`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSelector}`, () => {
        it(`[x]`, async () => {
            const text: string = `[x]`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`[x]?`, async () => {
            const text: string = `[x]?`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ];

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSpecification}`, () => {
        it(`type [x]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type [optional x]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type [x = number]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSpecificationList}`, () => {
        it(`type []`, async () => {
            const text: string = `type []`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type table []`, async () => {
            const text: string = `type table []`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.TableType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FieldSpecificationList, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`${Language.Ast.NodeKind.FieldSpecificationList}`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type [x, ...]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by FieldSpecification

    describe(`${Language.Ast.NodeKind.FunctionExpression}`, () => {
        it(`() => 1`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(x) => 1`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(x, y, z) => 1`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(optional x) => 1`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(x as nullable text) => 1`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(x) as number => x`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(x as number) as number => x`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(x as number) as nullable number => x`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`let Fn = () as nullable text => "asd" in Fn`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.FunctionType}`, () => {
        it(`type function () as number`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type function (x as number) as number`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by AsType

    describe(`${Language.Ast.NodeKind.GeneralizedIdentifier}`, () => {
        it(`[foo bar]`, async () => {
            const text: string = `[foo bar]`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`[1]`, async () => {
            const text: string = `[1]`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`[a.1]`, async () => {
            const text: string = `[a.1]`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`[#"a""" = 1]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    it(`Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral`, async () => {
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

        await assertAbridgeAstNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression}`, async () => {
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

        await assertAbridgeAstNodes(text, expected);
    });

    // Ast.NodeKind.Identifier covered by many

    describe(`${Language.Ast.NodeKind.IdentifierExpression}`, () => {
        it(`@foo`, async () => {
            const text: string = `@foo`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.Identifier, 1],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`零`, async () => {
            const text: string = `零`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ];

            await assertAbridgeAstNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.IdentifierPairedExpression}`, async () => {
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

        await assertAbridgeAstNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.IfExpression}`, async () => {
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

        await assertAbridgeAstNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.InvokeExpression}`, async () => {
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

        await assertAbridgeAstNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.IsExpression}`, () => {
        it(`1 is number`, async () => {
            const text: string = `1 is number`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`1 is number is number`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.ItemAccessExpression}`, async () => {
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

        await assertAbridgeAstNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.ItemAccessExpression} optional`, async () => {
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

        await assertAbridgeAstNodes(text, expected);
    });

    describe(`keywords`, () => {
        it(`#sections`, async () => {
            const text: string = `#sections`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`#shared`, async () => {
            const text: string = `#shared`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ];

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.LetExpression}`, () => {
        it(`let x = 1 in x`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`let x = 1 in try x`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`let a = let argh`, async () => {
            const text: string = `let a = let argh`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LetExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LetExpression, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.IdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.Identifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
            ];

            await assertAbridgeContextNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ListExpression}`, () => {
        it(`{}`, async () => {
            const text: string = `{}`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`{1, 2}`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`{1..2}`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`{1..2, 3..4}`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`{1, 2..3}`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`{1..2, 3}`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`let x = 1, y = {x..2} in y`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.ListLiteral}`, () => {
        it(`[foo = {1}] section;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`[foo = {}] section;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.ListType}`, async () => {
        const text: string = `type {number}`;

        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.TypePrimaryType, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ListType, 1],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
            [Language.Ast.NodeKind.Constant, 2],
        ];

        await assertAbridgeAstNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, async () => {
            const text: string = `true`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`false`, async () => {
            const text: string = `false`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`1`, async () => {
            const text: string = `1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`0x1`, async () => {
            const text: string = `0x1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`0X1`, async () => {
            const text: string = `0X1`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`1.2`, async () => {
            const text: string = `1.2`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`.1`, async () => {
            const text: string = ".1";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`1e2`, async () => {
            const text: string = "1e2";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`1e+2`, async () => {
            const text: string = "1e+2";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`1e-2`, async () => {
            const text: string = "1e-2";
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`#nan`, async () => {
            const text: string = `#nan`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`#infinity`, async () => {
            const text: string = `#infinity`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`""`, async () => {
            const text: string = `""`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`""""`, async () => {
            const text: string = `""""`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });

        it(`null`, async () => {
            const text: string = `null`;
            const expected: ReadonlyArray<AbridgedNode> = [[Language.Ast.NodeKind.LiteralExpression, undefined]];
            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.LogicalExpression}`, () => {
        it(`true and true`, async () => {
            const text: string = `true and true`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`true or true`, async () => {
            const text: string = `true or true`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });
    });

    it(`${Language.Ast.NodeKind.MetadataExpression}`, async () => {
        const text: string = `1 meta 1`;

        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.MetadataExpression, undefined],
            [Language.Ast.NodeKind.LiteralExpression, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.LiteralExpression, 2],
        ];

        await assertAbridgeAstNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.NotImplementedExpression}`, async () => {
        const text: string = `...`;

        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.NotImplementedExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
        ];

        await assertAbridgeAstNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.NullablePrimitiveType}`, async () => {
        const text: string = `1 is nullable number`;

        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.IsExpression, undefined],
            [Language.Ast.NodeKind.LiteralExpression, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.NullablePrimitiveType, 2],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
        ];

        await assertAbridgeAstNodes(text, expected);
    });

    it(`${Language.Ast.NodeKind.NullableType}`, async () => {
        const text: string = `type nullable number`;

        const expected: ReadonlyArray<AbridgedNode> = [
            [Language.Ast.NodeKind.TypePrimaryType, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.NullableType, 1],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
        ];

        await assertAbridgeAstNodes(text, expected);
    });

    describe(`${Language.Ast.NodeKind.NullCoalescingExpression}`, () => {
        it(`1 ?? a`, async () => {
            const text: string = `1 ?? a`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.NullCoalescingExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.IdentifierExpression, 2],
                [Language.Ast.NodeKind.Identifier, 1],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`1 ?? 1 ?? 1`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    // Ast.NodeKind.OtherwiseExpression covered by `${Language.Ast.NodeKind.ErrorHandlingExpression} otherwise`

    // Ast.NodeKind.Parameter covered by many

    // Ast.NodeKind.ParameterList covered by many

    describe(`${Language.Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`(1)`, async () => {
            const text: string = `(1)`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.ParenthesizedExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(1) + 1`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`(if true then true else false) and true`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`((1)) and true`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.PrimitiveType}`, () => {
        it(`1 as time`, async () => {
            const text: string = `1 as time`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.AsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.RecordExpression}`, () => {
        it(`[x=1]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`[]`, async () => {
            const text: string = `[]`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RecordExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ];

            await assertAbridgeAstNodes(text, expected);
        });
    });

    // Ast.NodeKind.RecordLiteral covered by many

    describe(`${Language.Ast.NodeKind.RecordType}`, () => {
        it(`type [x]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type [x, ...]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    // Ast.NodeKind.RecursivePrimaryExpression covered by many

    describe(`${Language.Ast.NodeKind.RelationalExpression}`, () => {
        it(`1 > 2`, async () => {
            const text: string = `1 > 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.GreaterThan);
        });

        it(`1 >= 2`, async () => {
            const text: string = `1 >= 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.GreaterThanEqualTo);
        });

        it(`1 < 2`, async () => {
            const text: string = `1 < 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.LessThan);
        });

        it(`1 <= 2`, async () => {
            const text: string = `1 <= 2`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.LessThanEqualTo);
        });
    });

    describe(`${Language.Ast.NodeKind.Section}`, () => {
        it(`section;`, async () => {
            const text: string = `section;`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`[] section;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`section foo;`, async () => {
            const text: string = `section foo;`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Identifier, 2],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ];

            await assertAbridgeAstNodes(text, expected);
        });

        it(`section; x = 1;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`section; x = 1; y = 2;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.SectionMember}`, () => {
        it(`section; x = 1;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`section; [] x = 1;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`section; shared x = 1;`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    describe(`${Language.Ast.NodeKind.TableType}`, () => {
        it(`type table [x]`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });

        it(`type table (x)`, async () => {
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

            await assertAbridgeAstNodes(text, expected);
        });
    });

    // Ast.NodeKind.TypePrimaryType covered by many

    describe(`${Language.Ast.NodeKind.UnaryExpression}`, () => {
        it(`-1`, async () => {
            const text: string = `-1`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Negative);
        });

        it(`WIP not 1`, async () => {
            const text: string = `not 1`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Not);
        });

        it(`+1`, async () => {
            const text: string = `+1`;

            const expected: ReadonlyArray<AbridgedNode> = [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ];

            await assertAbridgeAstNodes(text, expected);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Positive);
        });
    });
});
