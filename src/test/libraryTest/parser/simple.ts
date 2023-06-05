// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Assert, DefaultLocale, DefaultSettings, ResultUtils, Task, TaskUtils, Traverse } from "../../..";
import { Ast, Constant } from "../../../powerquery-parser/language";
import { NodeIdMap, TXorNode, XorNodeUtils } from "../../../powerquery-parser/parser";
import { NoOpTraceManagerInstance } from "../../../powerquery-parser/common/trace";
import { TestAssertUtils } from "../../testUtils";

type AbridgedNode = [Ast.NodeKind, number | undefined];

type CollectAbridgeNodeState = Traverse.ITraversalState<AbridgedNode[]>;

interface NthNodeOfKindState extends Traverse.ITraversalState<Ast.TNode | undefined> {
    readonly nodeKind: Ast.NodeKind;
    readonly nthRequired: number;
    nthCounter: number;
}

async function collectAbridgeNodeFromXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    root: TXorNode,
): Promise<ReadonlyArray<AbridgedNode>> {
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

async function assertGetNthNodeOfKind<N extends Ast.TNode>(
    text: string,
    nodeKind: Ast.NodeKind,
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

    const triedTraverse: Traverse.TriedTraverse<Ast.TNode | undefined> = await Traverse.tryTraverseAst<
        NthNodeOfKindState,
        Ast.TNode | undefined
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
async function nthNodeVisit(state: NthNodeOfKindState, node: Ast.TNode): Promise<void> {
    if (node.kind === state.nodeKind) {
        state.nthCounter += 1;

        if (state.nthCounter === state.nthRequired) {
            state.result = node;
        }
    }
}

// eslint-disable-next-line require-await
async function nthNodeEarlyExit(state: NthNodeOfKindState, _: Ast.TNode): Promise<boolean> {
    return state.nthCounter === state.nthRequired;
}

function validateNodeIdMapCollection(nodeIdMapCollection: NodeIdMap.Collection, root: TXorNode): void {
    const astNodeIds: Set<number> = new Set(nodeIdMapCollection.astNodeById.keys());
    const contextNodeIds: Set<number> = new Set(nodeIdMapCollection.contextNodeById.keys());
    const allNodeIds: Set<number> = new Set([...astNodeIds].concat([...contextNodeIds]));

    expect(nodeIdMapCollection.parentIdById).to.not.have.key(root.node.id.toString());

    expect(nodeIdMapCollection.parentIdById.size).to.equal(
        allNodeIds.size - 1,
        "parentIdById should have one less entry than allNodeIds",
    );

    expect(astNodeIds.size + contextNodeIds.size).to.equal(
        allNodeIds.size,
        "allNodeIds should be a union of astNodeIds and contextNodeIds",
    );

    for (const [childId, parentId] of nodeIdMapCollection.parentIdById.entries()) {
        expect(allNodeIds).to.include(childId, "keys for parentIdById should be in allNodeIds");
        expect(allNodeIds).to.include(parentId, "values for parentIdById should be in allNodeIds");
    }

    for (const [parentId, childrenIds] of nodeIdMapCollection.childIdsById.entries()) {
        expect(allNodeIds).to.include(parentId, "keys for childIdsById should be in allNodeIds");

        for (const childId of childrenIds) {
            expect(allNodeIds).to.include(childId, "childIds should be in allNodeIds");

            if (astNodeIds.has(parentId)) {
                expect(astNodeIds).to.include(childId, "if a parent is an astNode then so should be its children");
            }
        }
    }
}

describe("Parser.AbridgedNode", () => {
    async function runAbridgedNodeTest(text: string, expected: ReadonlyArray<AbridgedNode>): Promise<void> {
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
            throw new Error(`expected isParseStageOk/isParseStageParseError`);
        }

        validateNodeIdMapCollection(nodeIdMapCollection, root);

        const actual: ReadonlyArray<AbridgedNode> = await collectAbridgeNodeFromXor(nodeIdMapCollection, root);
        expect(actual).to.deep.equal(expected);
    }

    async function runAbridgedNodeAndOperatorTest(
        text: string,
        constant: Constant.TConstant,
        expected: ReadonlyArray<AbridgedNode>,
    ): Promise<void> {
        await runAbridgedNodeTest(text, expected);

        const operatorNode: Ast.TConstant = await assertGetNthNodeOfKind<Ast.TConstant>(text, Ast.NodeKind.Constant, 1);

        expect(operatorNode.constantKind).to.equal(constant);
    }

    describe(`${Ast.NodeKind.ArithmeticExpression}`, () => {
        it(`1 & 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 & 2`, Constant.ArithmeticOperator.And, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 * 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 * 2`, Constant.ArithmeticOperator.Multiplication, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 / 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 / 2`, Constant.ArithmeticOperator.Division, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 + 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 + 2`, Constant.ArithmeticOperator.Addition, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 - 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 - 2`, Constant.ArithmeticOperator.Subtraction, [
                [Ast.NodeKind.ArithmeticExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 + 2 + 3 + 4`, async () => {
            await runAbridgedNodeTest(`1 + 2 + 3 + 4`, [
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
            await runAbridgedNodeTest(`1 as`, [
                [Ast.NodeKind.NullCoalescingExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.AsExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 as number`, async () => {
            await runAbridgedNodeTest(`1 as number`, [
                [Ast.NodeKind.AsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 as number as logical`, async () => {
            await runAbridgedNodeTest(`1 as number as logical`, [
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
            await runAbridgedNodeTest(`type function (x as number) as number`, [
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
        await runAbridgedNodeTest(`each 1`, [
            [Ast.NodeKind.EachExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
        ]);
    });

    describe(`${Ast.NodeKind.EqualityExpression}`, () => {
        it(`1 = 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 = 2`, Constant.EqualityOperator.EqualTo, [
                [Ast.NodeKind.EqualityExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 <> 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 <> 2`, Constant.EqualityOperator.NotEqualTo, [
                [Ast.NodeKind.EqualityExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.ErrorHandlingExpression}`, () => {
        it(`try 1`, async () => {
            await runAbridgedNodeTest(`try 1`, [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`try 1 otherwise 2`, async () => {
            await runAbridgedNodeTest(`try 1 otherwise 2`, [
                [Ast.NodeKind.ErrorHandlingExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.OtherwiseExpression, 2],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`try 1 catch () => 1`, async () => {
            await runAbridgedNodeTest(`try 1 catch () => 1`, [
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
            await runAbridgedNodeTest(`try 1 catch (x) => 1`, [
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
        await runAbridgedNodeTest(`error 1`, [
            [Ast.NodeKind.ErrorRaisingExpression, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.LiteralExpression, 1],
        ]);
    });

    describe(`${Ast.NodeKind.FieldProjection}`, () => {
        it(`x[[y]]`, async () => {
            await runAbridgedNodeTest(`x[[y]]`, [
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
            await runAbridgedNodeTest(`x[[y], [z]]`, [
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
            await runAbridgedNodeTest(`x[[y]]?`, [
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
            await runAbridgedNodeTest(`[x]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[x]?`, async () => {
            await runAbridgedNodeTest(`[x]?`, [
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
            await runAbridgedNodeTest(`type [x]`, [
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
            await runAbridgedNodeTest(`type [optional x]`, [
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
            await runAbridgedNodeTest(`type [x = number]`, [
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
            await runAbridgedNodeTest(`type []`, [
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
            await runAbridgedNodeTest(`type table []`, [
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
            await runAbridgedNodeTest(`type [x]`, [
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
            await runAbridgedNodeTest(`type [x, ...]`, [
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
            await runAbridgedNodeTest(`() => 1`, [
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
            await runAbridgedNodeTest(`(x) => 1`, [
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
            await runAbridgedNodeTest(`(x, y, z) => 1`, [
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
            await runAbridgedNodeTest(`(optional x) => 1`, [
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
            await runAbridgedNodeTest(`(x as nullable text) => 1`, [
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
            await runAbridgedNodeTest(`(x) as number => x`, [
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
            await runAbridgedNodeTest(`(x as number) as number => x`, [
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
            await runAbridgedNodeTest(`(x as number) as nullable number => x`, [
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
            await runAbridgedNodeTest(`let Fn = () as nullable text => "asd" in Fn`, [
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
            await runAbridgedNodeTest(`type function () as number`, [
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
            await runAbridgedNodeTest(`type function (x as number) as number`, [
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
            await runAbridgedNodeTest(`[foo bar]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[1]`, async () => {
            await runAbridgedNodeTest(`[1]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[a.1]`, async () => {
            await runAbridgedNodeTest(`[a.1]`, [
                [Ast.NodeKind.FieldSelector, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.GeneralizedIdentifier, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`[#"a""" = 1]`, async () => {
            await runAbridgedNodeTest(`[#"a""" = 1]`, [
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
        await runAbridgedNodeTest(`[x=1] section;`, [
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
        await runAbridgedNodeTest(`[x=1]`, [
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
            await runAbridgedNodeTest(`@foo`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`零`, async () => {
            await runAbridgedNodeTest(`零`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    it(`${Ast.NodeKind.IdentifierPairedExpression}`, async () => {
        await runAbridgedNodeTest(`section; x = 1;`, [
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
        await runAbridgedNodeTest(`if x then x else x`, [
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
        await runAbridgedNodeTest(`foo()`, [
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
            await runAbridgedNodeTest(`1 is`, [
                [Ast.NodeKind.NullCoalescingExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.IsExpression, 1],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 is number`, async () => {
            await runAbridgedNodeTest(`1 is number`, [
                [Ast.NodeKind.IsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });

        it(`1 is number is number`, async () => {
            await runAbridgedNodeTest(`1 is number is number`, [
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
        await runAbridgedNodeTest(`x{1}`, [
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
        await runAbridgedNodeTest(`x{1}?`, [
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
            await runAbridgedNodeTest(`#sections`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`#shared`, async () => {
            await runAbridgedNodeTest(`#shared`, [
                [Ast.NodeKind.IdentifierExpression, undefined],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });
    });

    describe(`${Ast.NodeKind.LetExpression}`, () => {
        it(`let x = 1 in x`, async () => {
            await runAbridgedNodeTest(`let x = 1 in x`, [
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
            await runAbridgedNodeTest(`let x = 1 in try x`, [
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
            await runAbridgedNodeTest(`let a = let argh`, [
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
            await runAbridgedNodeTest(`{}`, [
                [Ast.NodeKind.ListExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.ArrayWrapper, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`{1, 2}`, async () => {
            await runAbridgedNodeTest(`{1, 2}`, [
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
            await runAbridgedNodeTest(`{1..2}`, [
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
            await runAbridgedNodeTest(`{1..2, 3..4}`, [
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
            await runAbridgedNodeTest(`{1, 2..3}`, [
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
            await runAbridgedNodeTest(`{1..2, 3}`, [
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
            await runAbridgedNodeTest(`let x = 1, y = {x..2} in y`, [
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
            await runAbridgedNodeTest(`[foo = {1}] section;`, [
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
            await runAbridgedNodeTest(`[foo = {}] section;`, [
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
        await runAbridgedNodeTest(`type {number}`, [
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
            await runAbridgedNodeTest(`true`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`false`, async () => {
            await runAbridgedNodeTest(`false`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1`, async () => {
            await runAbridgedNodeTest(`1`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`0x1`, async () => {
            await runAbridgedNodeTest(`0x1`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`0X1`, async () => {
            await runAbridgedNodeTest(`0X1`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1.2`, async () => {
            await runAbridgedNodeTest(`1.2`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`.1`, async () => {
            await runAbridgedNodeTest(".1", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e2`, async () => {
            await runAbridgedNodeTest("1e2", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e+2`, async () => {
            await runAbridgedNodeTest("1e+2", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`1e-2`, async () => {
            await runAbridgedNodeTest("1e-2", [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`#nan`, async () => {
            await runAbridgedNodeTest(`#nan`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`#infinity`, async () => {
            await runAbridgedNodeTest(`#infinity`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`""`, async () => {
            await runAbridgedNodeTest(`""`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`""""`, async () => {
            await runAbridgedNodeTest(`""""`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });

        it(`null`, async () => {
            await runAbridgedNodeTest(`null`, [[Ast.NodeKind.LiteralExpression, undefined]]);
        });
    });

    describe(`${Ast.NodeKind.LogicalExpression}`, () => {
        it(`true and true`, async () => {
            await runAbridgedNodeTest(`true and true`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`true or true`, async () => {
            await runAbridgedNodeTest(`true or true`, [
                [Ast.NodeKind.LogicalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    it(`${Ast.NodeKind.MetadataExpression}`, async () => {
        await runAbridgedNodeTest(`1 meta 1`, [
            [Ast.NodeKind.MetadataExpression, undefined],
            [Ast.NodeKind.LiteralExpression, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.LiteralExpression, 2],
        ]);
    });

    it(`${Ast.NodeKind.NotImplementedExpression}`, async () => {
        await runAbridgedNodeTest(`...`, [
            [Ast.NodeKind.NotImplementedExpression, undefined],
            [Ast.NodeKind.Constant, 0],
        ]);
    });

    it(`${Ast.NodeKind.NullablePrimitiveType}`, async () => {
        await runAbridgedNodeTest(`1 is nullable number`, [
            [Ast.NodeKind.IsExpression, undefined],
            [Ast.NodeKind.LiteralExpression, 0],
            [Ast.NodeKind.Constant, 1],
            [Ast.NodeKind.NullablePrimitiveType, 2],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
        ]);
    });

    it(`${Ast.NodeKind.NullableType}`, async () => {
        await runAbridgedNodeTest(`type nullable number`, [
            [Ast.NodeKind.TypePrimaryType, undefined],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.NullableType, 1],
            [Ast.NodeKind.Constant, 0],
            [Ast.NodeKind.PrimitiveType, 1],
        ]);
    });

    describe(`${Ast.NodeKind.NullCoalescingExpression}`, () => {
        it(`1 ?? a`, async () => {
            await runAbridgedNodeTest(`1 ?? a`, [
                [Ast.NodeKind.NullCoalescingExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.IdentifierExpression, 2],
                [Ast.NodeKind.Identifier, 1],
            ]);
        });

        it(`1 ?? 2 ?? 3`, async () => {
            await runAbridgedNodeTest(`1 ?? 2 ?? 3`, [
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
            await runAbridgedNodeTest(`(1)`, [
                [Ast.NodeKind.ParenthesizedExpression, undefined],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
                [Ast.NodeKind.Constant, 2],
            ]);
        });

        it(`(1) + 1`, async () => {
            await runAbridgedNodeTest(`(1) + 1`, [
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
            await runAbridgedNodeTest(`(if true then true else false) and true`, [
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
            await runAbridgedNodeTest(`((1)) and true`, [
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
            await runAbridgedNodeTest(`1 as time`, [
                [Ast.NodeKind.AsExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.PrimitiveType, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression}`, () => {
        it(`[x=1]`, async () => {
            await runAbridgedNodeTest(`[x=1]`, [
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
            await runAbridgedNodeTest(`[]`, [
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
            await runAbridgedNodeTest(`type [x]`, [
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
            await runAbridgedNodeTest(`type [x, ...]`, [
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
            await runAbridgedNodeAndOperatorTest(`1 > 2`, Constant.RelationalOperator.GreaterThan, [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 >= 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 >= 2`, Constant.RelationalOperator.GreaterThanEqualTo, [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 < 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 < 2`, Constant.RelationalOperator.LessThan, [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });

        it(`1 <= 2`, async () => {
            await runAbridgedNodeAndOperatorTest(`1 <= 2`, Constant.RelationalOperator.LessThanEqualTo, [
                [Ast.NodeKind.RelationalExpression, undefined],
                [Ast.NodeKind.LiteralExpression, 0],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.LiteralExpression, 2],
            ]);
        });
    });

    describe(`${Ast.NodeKind.Section}`, () => {
        it(`section;`, async () => {
            await runAbridgedNodeTest(`section;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`[] section;`, async () => {
            await runAbridgedNodeTest(`[] section;`, [
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
            await runAbridgedNodeTest(`section foo;`, [
                [Ast.NodeKind.Section, undefined],
                [Ast.NodeKind.Constant, 1],
                [Ast.NodeKind.Identifier, 2],
                [Ast.NodeKind.Constant, 3],
                [Ast.NodeKind.ArrayWrapper, 4],
            ]);
        });

        it(`section; x = 1;`, async () => {
            await runAbridgedNodeTest(`section; x = 1;`, [
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
            await runAbridgedNodeTest(`section; x = 1; y = 2;`, [
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
            await runAbridgedNodeTest(`section; x = 1;`, [
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
            await runAbridgedNodeTest(`section; [] x = 1;`, [
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
            await runAbridgedNodeTest(`section; shared x = 1;`, [
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
            await runAbridgedNodeTest(`type table [x]`, [
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
            await runAbridgedNodeTest(`type table (x)`, [
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
            await runAbridgedNodeAndOperatorTest(`-1`, Constant.UnaryOperator.Negative, [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`not 1`, async () => {
            await runAbridgedNodeAndOperatorTest(`not 1`, Constant.UnaryOperator.Not, [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });

        it(`+1`, async () => {
            await runAbridgedNodeAndOperatorTest(`+1`, Constant.UnaryOperator.Positive, [
                [Ast.NodeKind.UnaryExpression, undefined],
                [Ast.NodeKind.ArrayWrapper, 0],
                [Ast.NodeKind.Constant, 0],
                [Ast.NodeKind.LiteralExpression, 1],
            ]);
        });
    });
});
