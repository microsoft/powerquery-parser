// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import {
    Assert,
    CommonError,
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
import { NodeIdMap, TXorNode, XorNodeUtils } from "../../../powerquery-parser/parser";
import { NoOpTraceManagerInstance } from "../../../powerquery-parser/common/trace";
import { TestAssertUtils } from "../../testUtils";

type AbridgedNode = [Language.Ast.NodeKind, number | undefined];

type CollectAbridgeNodeState = Traverse.ITraversalState<AbridgedNode[]>;

interface NthNodeOfKindState extends Traverse.ITraversalState<Language.Ast.TNode | undefined> {
    readonly nodeKind: Language.Ast.NodeKind;
    readonly nthRequired: number;
    nthCounter: number;
}

async function collectAbridgeNodeFromContext(text: string): Promise<ReadonlyArray<AbridgedNode>> {
    const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(DefaultSettings, text);

    let root: TXorNode;
    let nodeIdMapCollection: NodeIdMap.Collection;

    if (TaskUtils.isParseStageOk(triedLexParse)) {
        root = XorNodeUtils.boxAst(triedLexParse.ast);
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
    } else if (TaskUtils.isParseStageParseError(triedLexParse)) {
        root = XorNodeUtils.boxContext(Assert.asDefined(triedLexParse.parseState.contextState.root));
        nodeIdMapCollection = triedLexParse.nodeIdMapCollection;
    } else {
        throw new CommonError.InvariantError(
            `expected parse stage to be ok or parse error, got ${triedLexParse.stage}`,
        );
    }

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
        nodeIdMapCollection,
        root,
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

describe("Parser.AbridgedNode", () => {
    async function runAbridgedNodeTest(text: string, expected: ReadonlyArray<AbridgedNode>): Promise<void> {
        const actual: ReadonlyArray<AbridgedNode> = await collectAbridgeNodeFromContext(text);
        expect(actual).to.deep.equal(expected);
    }

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

            await runAbridgedNodeTest(text, [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.And);
        });

        it(`1 * 2`, async () => {
            const text: string = `1 * 2`;

            await runAbridgedNodeTest(text, [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Multiplication);
        });

        it(`1 / 2`, async () => {
            const text: string = `1 / 2`;

            await runAbridgedNodeTest(`1 / 2`, [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Division);
        });

        it(`1 + 2`, async () => {
            const text: string = `1 + 2`;

            await runAbridgedNodeTest(`1 + 2`, [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Addition);
        });

        it(`1 - 2`, async () => {
            const text: string = `1 - 2`;

            await runAbridgedNodeTest(`1 - 2`, [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.ArithmeticOperator.Subtraction);
        });

        it(`1 + 2 + 3 + 4`, async () => {
            await runAbridgedNodeTest(`1 + 2 + 3 + 4`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.AsExpression}`, () => {
        it(`1 as number`, async () => {
            await runAbridgedNodeTest(`1 as number`, [
                [Language.Ast.NodeKind.AsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`type function (x as number) as number`, async () => {
            await runAbridgedNodeTest(`type function (x as number) as number`, [
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
            ]);
        });
    });

    // Ast.NodeKind.Constant covered by many

    // Ast.NodeKind.Csv covered by many

    it(`${Language.Ast.NodeKind.EachExpression}`, async () => {
        await runAbridgedNodeTest(`each 1`, [
            [Language.Ast.NodeKind.EachExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
        ]);
    });

    describe(`${Language.Ast.NodeKind.EqualityExpression}`, () => {
        it(`1 = 2`, async () => {
            const text: string = `1 = 2`;

            await runAbridgedNodeTest(`1 = 2`, [
                [Language.Ast.NodeKind.EqualityExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.EqualityOperator.EqualTo);
        });

        it(`1 <> 2`, async () => {
            const text: string = `1 <> 2`;

            await runAbridgedNodeTest(`1 <> 2`, [
                [Language.Ast.NodeKind.EqualityExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

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
            await runAbridgedNodeTest(`try 1`, [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`try 1 otherwise 2`, async () => {
            await runAbridgedNodeTest(`try 1 otherwise 2`, [
                [Language.Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.OtherwiseExpression, 2],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`try 1 catch () => 1`, async () => {
            await runAbridgedNodeTest(`try 1 catch () => 1`, [
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
            ]);
        });

        it(`try 1 catch (x) => 1`, async () => {
            await runAbridgedNodeTest(`try 1 catch (x) => 1`, [
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
            ]);
        });
    });

    it(`${Language.Ast.NodeKind.ErrorRaisingExpression}`, async () => {
        await runAbridgedNodeTest(`error 1`, [
            [Language.Ast.NodeKind.ErrorRaisingExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
        ]);
    });

    describe(`${Language.Ast.NodeKind.FieldProjection}`, () => {
        it(`x[[y]]`, async () => {
            await runAbridgedNodeTest(`x[[y]]`, [
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
            ]);
        });

        it(`x[[y], [z]]`, async () => {
            await runAbridgedNodeTest(`x[[y], [z]]`, [
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
            ]);
        });

        it(`x[[y]]?`, async () => {
            await runAbridgedNodeTest(`x[[y]]?`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSelector}`, () => {
        it(`[x]`, async () => {
            await runAbridgedNodeTest(`[x]`, [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[x]?`, async () => {
            await runAbridgedNodeTest(`[x]?`, [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 3],
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSpecification}`, () => {
        it(`type [x]`, async () => {
            await runAbridgedNodeTest(`type [x]`, [
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
            ]);
        });

        it(`type [optional x]`, async () => {
            await runAbridgedNodeTest(`type [optional x]`, [
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
            ]);
        });

        it(`type [x = number]`, async () => {
            await runAbridgedNodeTest(`type [x = number]`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.FieldSpecificationList}`, () => {
        it(`type []`, async () => {
            await runAbridgedNodeTest(`type []`, [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.RecordType, 1],
                [Language.Ast.NodeKind.FieldSpecificationList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`type table []`, async () => {
            await runAbridgedNodeTest(`type table []`, [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.TableType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.FieldSpecificationList, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`${Language.Ast.NodeKind.FieldSpecificationList}`, async () => {
            await runAbridgedNodeTest(`type [x]`, [
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
            ]);
        });

        it(`type [x, ...]`, async () => {
            await runAbridgedNodeTest(`type [x, ...]`, [
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
            ]);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by FieldSpecification

    describe(`${Language.Ast.NodeKind.FunctionExpression}`, () => {
        it(`() => 1`, async () => {
            await runAbridgedNodeTest(`() => 1`, [
                [Language.Ast.NodeKind.FunctionExpression, undefined],
                [Language.Ast.NodeKind.ParameterList, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.LiteralExpression, 3],
            ]);
        });

        it(`(x) => 1`, async () => {
            await runAbridgedNodeTest(`(x) => 1`, [
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
            ]);
        });

        it(`(x, y, z) => 1`, async () => {
            await runAbridgedNodeTest(`(x, y, z) => 1`, [
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
            ]);
        });

        it(`(optional x) => 1`, async () => {
            await runAbridgedNodeTest(`(optional x) => 1`, [
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
            ]);
        });

        it(`(x as nullable text) => 1`, async () => {
            await runAbridgedNodeTest(`(x as nullable text) => 1`, [
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
            ]);
        });

        it(`(x) as number => x`, async () => {
            await runAbridgedNodeTest(`(x) as number => x`, [
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
            ]);
        });

        it(`(x as number) as number => x`, async () => {
            await runAbridgedNodeTest(`(x as number) as number => x`, [
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
            ]);
        });

        it(`(x as number) as nullable number => x`, async () => {
            await runAbridgedNodeTest(`(x as number) as nullable number => x`, [
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
            ]);
        });

        it(`let Fn = () as nullable text => "asd" in Fn`, async () => {
            await runAbridgedNodeTest(`let Fn = () as nullable text => "asd" in Fn`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.FunctionType}`, () => {
        it(`type function () as number`, async () => {
            await runAbridgedNodeTest(`type function () as number`, [
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
            ]);
        });

        it(`type function (x as number) as number`, async () => {
            await runAbridgedNodeTest(`type function (x as number) as number`, [
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
            ]);
        });
    });

    // Ast.NodeKind.FieldTypeSpecification covered by AsType

    describe(`${Language.Ast.NodeKind.GeneralizedIdentifier}`, () => {
        it(`[foo bar]`, async () => {
            await runAbridgedNodeTest(`[foo bar]`, [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[1]`, async () => {
            await runAbridgedNodeTest(`[1]`, [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[a.1]`, async () => {
            await runAbridgedNodeTest(`[a.1]`, [
                [Language.Ast.NodeKind.FieldSelector, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[#"a""" = 1]`, async () => {
            await runAbridgedNodeTest(`[#"a""" = 1]`, [
                [Language.Ast.NodeKind.RecordExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });
    });

    it(`Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral`, async () => {
        await runAbridgedNodeTest(`[x=1] section;`, [
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
        ]);
    });

    it(`${Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression}`, async () => {
        await runAbridgedNodeTest(`[x=1]`, [
            [Language.Ast.NodeKind.RecordExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.Csv, 0],
            [Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
            [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.LiteralExpression, 2],
            [Language.Ast.NodeKind.Constant, 2],
        ]);
    });

    // Ast.NodeKind.Identifier covered by many

    describe(`${Language.Ast.NodeKind.IdentifierExpression}`, () => {
        it(`@foo`, async () => {
            await runAbridgedNodeTest(`@foo`, [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`零`, async () => {
            await runAbridgedNodeTest(`零`, [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    it(`${Language.Ast.NodeKind.IdentifierPairedExpression}`, async () => {
        const text: string = `section; x = 1;`;

        await runAbridgedNodeTest(text, [
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
        ]);
    });

    it(`${Language.Ast.NodeKind.IfExpression}`, async () => {
        const text: string = `if x then x else x`;

        await runAbridgedNodeTest(text, [
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
        ]);
    });

    it(`${Language.Ast.NodeKind.InvokeExpression}`, async () => {
        const text: string = `foo()`;

        await runAbridgedNodeTest(text, [
            [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Language.Ast.NodeKind.IdentifierExpression, 0],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.InvokeExpression, 0],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.Constant, 2],
        ]);
    });

    describe(`${Language.Ast.NodeKind.IsExpression}`, () => {
        it(`1 is number`, async () => {
            await runAbridgedNodeTest(`1 is number`, [
                [Language.Ast.NodeKind.IsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        // it(`WIP 1 is`, async () => {
        //     const text: string = `1 is`;
        //     await runAbridgedNodeTest(text, [[Language.Ast.NodeKind.IsExpression, undefined]];

        //     await assertAbridgeContextNodes(text, expected);
        // });

        it(`1 is number is number`, async () => {
            await runAbridgedNodeTest(`1 is number is number`, [
                [Language.Ast.NodeKind.IsExpression, undefined],
                [Language.Ast.NodeKind.IsExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ]);
        });
    });

    it(`${Language.Ast.NodeKind.ItemAccessExpression}`, async () => {
        const text: string = `x{1}`;

        await runAbridgedNodeTest(text, [
            [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Language.Ast.NodeKind.IdentifierExpression, 0],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.ItemAccessExpression, 0],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
            [Language.Ast.NodeKind.Constant, 2],
        ]);
    });

    it(`${Language.Ast.NodeKind.ItemAccessExpression} optional`, async () => {
        const text: string = `x{1}?`;

        await runAbridgedNodeTest(text, [
            [Language.Ast.NodeKind.RecursivePrimaryExpression, undefined],
            [Language.Ast.NodeKind.IdentifierExpression, 0],
            [Language.Ast.NodeKind.Identifier, 1],
            [Language.Ast.NodeKind.ArrayWrapper, 1],
            [Language.Ast.NodeKind.ItemAccessExpression, 0],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.LiteralExpression, 1],
            [Language.Ast.NodeKind.Constant, 2],
            [Language.Ast.NodeKind.Constant, 3],
        ]);
    });

    describe(`keywords`, () => {
        it(`#sections`, async () => {
            await runAbridgedNodeTest(`#sections`, [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`#shared`, async () => {
            await runAbridgedNodeTest(`#shared`, [
                [Language.Ast.NodeKind.IdentifierExpression, undefined],
                [Language.Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.LetExpression}`, () => {
        it(`let x = 1 in x`, async () => {
            await runAbridgedNodeTest(`let x = 1 in x`, [
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
            ]);
        });

        it(`let x = 1 in try x`, async () => {
            await runAbridgedNodeTest(`let x = 1 in try x`, [
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
            ]);
        });

        it(`let a = let argh`, async () => {
            await runAbridgedNodeTest(`let a = let argh`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.ListExpression}`, () => {
        it(`{}`, async () => {
            await runAbridgedNodeTest(`{}`, [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1, 2}`, async () => {
            await runAbridgedNodeTest(`{1, 2}`, [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Csv, 1],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1..2}`, async () => {
            await runAbridgedNodeTest(`{1..2}`, [
                [Language.Ast.NodeKind.ListExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.RangeExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1..2, 3..4}`, async () => {
            await runAbridgedNodeTest(`{1..2, 3..4}`, [
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
            ]);
        });

        it(`{1, 2..3}`, async () => {
            await runAbridgedNodeTest(`{1, 2..3}`, [
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
            ]);
        });

        it(`{1..2, 3}`, async () => {
            await runAbridgedNodeTest(`{1..2, 3}`, [
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
            ]);
        });

        it(`let x = 1, y = {x..2} in y`, async () => {
            await runAbridgedNodeTest(`let x = 1, y = {x..2} in y`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.ListLiteral}`, () => {
        it(`[foo = {1}] section;`, async () => {
            await runAbridgedNodeTest(`[foo = {1}] section;`, [
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
            ]);
        });

        it(`[foo = {}] section;`, async () => {
            await runAbridgedNodeTest(`[foo = {}] section;`, [
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
            ]);
        });
    });

    it(`${Language.Ast.NodeKind.ListType}`, async () => {
        await runAbridgedNodeTest(`type {number}`, [
            [Language.Ast.NodeKind.TypePrimaryType, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.ListType, 1],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
            [Language.Ast.NodeKind.Constant, 2],
        ]);
    });

    describe(`${Language.Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, async () => {
            await runAbridgedNodeTest(`true`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`false`, async () => {
            await runAbridgedNodeTest(`false`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1`, async () => {
            await runAbridgedNodeTest(`1`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`0x1`, async () => {
            await runAbridgedNodeTest(`0x1`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`0X1`, async () => {
            await runAbridgedNodeTest(`0X1`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1.2`, async () => {
            await runAbridgedNodeTest(`1.2`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`.1`, async () => {
            await runAbridgedNodeTest(".1", [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e2`, async () => {
            await runAbridgedNodeTest("1e2", [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e+2`, async () => {
            await runAbridgedNodeTest("1e+2", [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e-2`, async () => {
            await runAbridgedNodeTest("1e-2", [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`#nan`, async () => {
            await runAbridgedNodeTest(`#nan`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`#infinity`, async () => {
            await runAbridgedNodeTest(`#infinity`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`""`, async () => {
            await runAbridgedNodeTest(`""`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`""""`, async () => {
            await runAbridgedNodeTest(`""""`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`null`, async () => {
            await runAbridgedNodeTest(`null`, [[Language.Ast.NodeKind.LiteralExpression, undefined]]);
        });
    });

    describe(`${Language.Ast.NodeKind.LogicalExpression}`, () => {
        it(`true and true`, async () => {
            await runAbridgedNodeTest(`true and true`, [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`true or true`, async () => {
            await runAbridgedNodeTest(`true or true`, [
                [Language.Ast.NodeKind.LogicalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    it(`${Language.Ast.NodeKind.MetadataExpression}`, async () => {
        const text: string = `1 meta 1`;

        await runAbridgedNodeTest(text, [
            [Language.Ast.NodeKind.MetadataExpression, undefined],
            [Language.Ast.NodeKind.LiteralExpression, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.LiteralExpression, 2],
        ]);
    });

    it(`${Language.Ast.NodeKind.NotImplementedExpression}`, async () => {
        const text: string = `...`;

        await runAbridgedNodeTest(text, [
            [Language.Ast.NodeKind.NotImplementedExpression, undefined],
            [Language.Ast.NodeKind.Constant, 0],
        ]);
    });

    it(`${Language.Ast.NodeKind.NullablePrimitiveType}`, async () => {
        const text: string = `1 is nullable number`;

        await runAbridgedNodeTest(text, [
            [Language.Ast.NodeKind.IsExpression, undefined],
            [Language.Ast.NodeKind.LiteralExpression, 0],
            [Language.Ast.NodeKind.Constant, 1],
            [Language.Ast.NodeKind.NullablePrimitiveType, 2],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
        ]);
    });

    it(`${Language.Ast.NodeKind.NullableType}`, async () => {
        const text: string = `type nullable number`;

        await runAbridgedNodeTest(text, [
            [Language.Ast.NodeKind.TypePrimaryType, undefined],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.NullableType, 1],
            [Language.Ast.NodeKind.Constant, 0],
            [Language.Ast.NodeKind.PrimitiveType, 1],
        ]);
    });

    describe(`${Language.Ast.NodeKind.NullCoalescingExpression}`, () => {
        it(`1 ?? a`, async () => {
            await runAbridgedNodeTest(`1 ?? a`, [
                [Language.Ast.NodeKind.NullCoalescingExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.IdentifierExpression, 2],
                [Language.Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`1 ?? 1 ?? 1`, async () => {
            await runAbridgedNodeTest(`1 ?? 1 ?? 1`, [
                [Language.Ast.NodeKind.NullCoalescingExpression, undefined],
                [Language.Ast.NodeKind.NullCoalescingExpression, 0],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    // Ast.NodeKind.OtherwiseExpression covered by `${Language.Ast.NodeKind.ErrorHandlingExpression} otherwise`

    // Ast.NodeKind.Parameter covered by many

    // Ast.NodeKind.ParameterList covered by many

    describe(`${Language.Ast.NodeKind.ParenthesizedExpression}`, () => {
        it(`(1)`, async () => {
            await runAbridgedNodeTest(`(1)`, [
                [Language.Ast.NodeKind.ParenthesizedExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`(1) + 1`, async () => {
            await runAbridgedNodeTest(`(1) + 1`, [
                [Language.Ast.NodeKind.ArithmeticExpression, undefined],
                [Language.Ast.NodeKind.ParenthesizedExpression, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`(if true then true else false) and true`, async () => {
            await runAbridgedNodeTest(`(if true then true else false) and true`, [
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
            ]);
        });

        it(`((1)) and true`, async () => {
            await runAbridgedNodeTest(`((1)) and true`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.PrimitiveType}`, () => {
        it(`1 as time`, async () => {
            await runAbridgedNodeTest(`1 as time`, [
                [Language.Ast.NodeKind.AsExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.PrimitiveType, 2],
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.RecordExpression}`, () => {
        it(`[x=1]`, async () => {
            await runAbridgedNodeTest(`[x=1]`, [
                [Language.Ast.NodeKind.RecordExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Csv, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifierPairedExpression, 0],
                [Language.Ast.NodeKind.GeneralizedIdentifier, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[]`, async () => {
            await runAbridgedNodeTest(`[]`, [
                [Language.Ast.NodeKind.RecordExpression, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });
    });

    // Ast.NodeKind.RecordLiteral covered by many

    describe(`${Language.Ast.NodeKind.RecordType}`, () => {
        it(`type [x]`, async () => {
            await runAbridgedNodeTest(`type [x]`, [
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
            ]);
        });

        it(`type [x, ...]`, async () => {
            await runAbridgedNodeTest(`type [x, ...]`, [
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
            ]);
        });
    });

    // Ast.NodeKind.RecursivePrimaryExpression covered by many

    describe(`${Language.Ast.NodeKind.RelationalExpression}`, () => {
        it(`1 > 2`, async () => {
            const text: string = `1 > 2`;

            await runAbridgedNodeTest(`1 > 2`, [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.GreaterThan);
        });

        it(`1 >= 2`, async () => {
            const text: string = `1 >= 2`;

            await runAbridgedNodeTest(`1 >= 2`, [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.GreaterThanEqualTo);
        });

        it(`1 < 2`, async () => {
            const text: string = `1 < 2`;

            await runAbridgedNodeTest(`1 < 2`, [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.RelationalOperator.LessThan);
        });

        it(`1 <= 2`, async () => {
            const text: string = `1 <= 2`;

            await runAbridgedNodeTest(`1 <= 2`, [
                [Language.Ast.NodeKind.RelationalExpression, undefined],
                [Language.Ast.NodeKind.LiteralExpression, 0],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.LiteralExpression, 2],
            ]);

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
            await runAbridgedNodeTest(`section;`, [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`[] section;`, async () => {
            await runAbridgedNodeTest(`[] section;`, [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.RecordLiteral, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ArrayWrapper, 1],
                [Language.Ast.NodeKind.Constant, 2],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`section foo;`, async () => {
            await runAbridgedNodeTest(`section foo;`, [
                [Language.Ast.NodeKind.Section, undefined],
                [Language.Ast.NodeKind.Constant, 1],
                [Language.Ast.NodeKind.Identifier, 2],
                [Language.Ast.NodeKind.Constant, 3],
                [Language.Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`section; x = 1;`, async () => {
            await runAbridgedNodeTest(`section; x = 1;`, [
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
            ]);
        });

        it(`section; x = 1; y = 2;`, async () => {
            await runAbridgedNodeTest(`section; x = 1; y = 2;`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.SectionMember}`, () => {
        it(`section; x = 1;`, async () => {
            await runAbridgedNodeTest(`section; x = 1;`, [
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
            ]);
        });

        it(`section; [] x = 1;`, async () => {
            await runAbridgedNodeTest(`section; [] x = 1;`, [
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
            ]);
        });

        it(`section; shared x = 1;`, async () => {
            await runAbridgedNodeTest(`section; shared x = 1;`, [
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
            ]);
        });
    });

    describe(`${Language.Ast.NodeKind.TableType}`, () => {
        it(`type table [x]`, async () => {
            await runAbridgedNodeTest(`type table [x]`, [
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
            ]);
        });

        it(`type table (x)`, async () => {
            await runAbridgedNodeTest(`type table (x)`, [
                [Language.Ast.NodeKind.TypePrimaryType, undefined],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.TableType, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.ParenthesizedExpression, 1],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.IdentifierExpression, 1],
                [Language.Ast.NodeKind.Identifier, 1],
                [Language.Ast.NodeKind.Constant, 2],
            ]);
        });
    });

    // Ast.NodeKind.TypePrimaryType covered by many

    describe(`${Language.Ast.NodeKind.UnaryExpression}`, () => {
        it(`-1`, async () => {
            const text: string = `-1`;

            await runAbridgedNodeTest(`-1`, [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Negative);
        });

        it(`not 1`, async () => {
            const text: string = `not 1`;

            await runAbridgedNodeTest(`not 1`, [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Not);
        });

        it(`+1`, async () => {
            const text: string = `+1`;

            await runAbridgedNodeTest(`+1`, [
                [Language.Ast.NodeKind.UnaryExpression, undefined],
                [Language.Ast.NodeKind.ArrayWrapper, 0],
                [Language.Ast.NodeKind.Constant, 0],
                [Language.Ast.NodeKind.LiteralExpression, 1],
            ]);

            const operatorNode: Language.Ast.TConstant = await assertGetNthNodeOfKind<Language.Ast.TConstant>(
                text,
                Language.Ast.NodeKind.Constant,
                1,
            );

            expect(operatorNode.constantKind).to.equal(Language.Constant.UnaryOperator.Positive);
        });
    });
});
