// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils } from "../../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../../language";
import { NodeIdMap, ParseContext, ParseContextUtils, ParseStateUtils } from "../..";
import { CombinatorialParserV2TraceConstant } from "./commonTypes";
import { NaiveParseSteps } from "..";
import { Parser } from "../../parser";
import { ParseState } from "../../parseState";
import { Trace } from "../../../common/trace";

export function combineOperatorsAndOperands(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    correlationId: number,
): Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType {
    Assert.isTrue(
        operatorConstants.length + 1 === operands.length,
        `operators.length !== (operands.length + 1) failed`,
        {
            operandsLength: operands.length,
            operatorsLength: operatorConstants.length,
        },
    );

    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        combineOperatorsAndOperands.name,
        correlationId,
    );

    while (operatorConstants.length) {
        const index: number = findHighestPrecedenceIndex(operatorConstants);
        const operatorConstant: Ast.TBinOpExpressionConstant = ArrayUtils.assertGet(operatorConstants, index);
        const operatorConstantKind: Constant.TBinOpExpressionOperator = operatorConstant.constantKind;

        const operand: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType | undefined =
            operands[index + 1];

        let combineRemainders: CombineRemainders;

        switch (operatorConstantKind) {
            case Constant.ArithmeticOperator.Division:
            case Constant.ArithmeticOperator.Multiplication:
            case Constant.ArithmeticOperator.Addition:
            case Constant.ArithmeticOperator.Subtraction:
            case Constant.ArithmeticOperator.And:
            case Constant.EqualityOperator.EqualTo:
            case Constant.EqualityOperator.NotEqualTo:
            case Constant.RelationalOperator.GreaterThan:
            case Constant.RelationalOperator.GreaterThanEqualTo:
            case Constant.RelationalOperator.LessThan:
            case Constant.RelationalOperator.LessThanEqualTo:
                // eslint-disable-next-line no-lone-blocks
                {
                    combineRemainders = combineWhile<TEqualityExpressionAndBelow>(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operatorConstants,
                        operands,
                        EqualityExpressionAndBelowCombiner,
                        {
                            index,
                            nodeKind: MapUtils.assertGet(
                                NodeKindByTEqualityExpressionAndBelowOperatorKind,
                                operatorConstantKind,
                            ),
                            operatorConstant,
                            operand,
                        },
                        trace.id,
                    );
                }

                break;

            case Constant.LogicalOperator.And: {
                combineRemainders = combineWhile<Ast.LogicalExpression>(
                    state,
                    parser,
                    placeholderContextNodeId,
                    operatorConstants,
                    operands,
                    LogicalAndExpressionCombiner,
                    {
                        index,
                        nodeKind: Ast.NodeKind.LogicalExpression,
                        operatorConstant,
                        operand,
                    },
                    trace.id,
                );

                break;
            }

            case Constant.LogicalOperator.Or: {
                combineRemainders = combineWhile<Ast.LogicalExpression>(
                    state,
                    parser,
                    placeholderContextNodeId,
                    operatorConstants,
                    operands,
                    LogicalOrExpressionCombiner,
                    {
                        index,
                        nodeKind: Ast.NodeKind.LogicalExpression,
                        operatorConstant,
                        operand,
                    },
                    trace.id,
                );

                break;
            }

            case Constant.KeywordConstant.As: {
                combineRemainders = combineWhile<Ast.AsExpression>(
                    state,
                    parser,
                    placeholderContextNodeId,
                    operatorConstants,
                    operands,
                    AsExpressionCombiner,
                    {
                        index,
                        nodeKind: Ast.NodeKind.AsExpression,
                        operatorConstant,
                        operand,
                    },
                    trace.id,
                );

                break;
            }

            case Constant.KeywordConstant.Is: {
                combineRemainders = combineWhile<Ast.IsExpression>(
                    state,
                    parser,
                    placeholderContextNodeId,
                    operatorConstants,
                    operands,
                    IsExpressionCombiner,
                    {
                        index,
                        nodeKind: Ast.NodeKind.IsExpression,
                        operatorConstant,
                        operand,
                    },
                    trace.id,
                );

                break;
            }

            case Constant.KeywordConstant.Meta: {
                combineRemainders = combineWhile<Ast.MetadataExpression>(
                    state,
                    parser,
                    placeholderContextNodeId,
                    operatorConstants,
                    operands,
                    MetadataExpressionCombiner,
                    {
                        index,
                        nodeKind: Ast.NodeKind.MetadataExpression,
                        operatorConstant,
                        operand,
                    },
                    trace.id,
                );

                break;
            }

            case Constant.MiscConstant.NullCoalescingOperator: {
                combineRemainders = combineWhile<Ast.NullCoalescingExpression>(
                    state,
                    parser,
                    placeholderContextNodeId,
                    operatorConstants,
                    operands,
                    NullCoalescingExpressionCombiner,
                    {
                        index,
                        nodeKind: Ast.NodeKind.NullCoalescingExpression,
                        operatorConstant,
                        operand,
                    },
                    trace.id,
                );

                break;
            }

            default:
                Assert.isNever(operatorConstantKind);
        }

        operatorConstants = combineRemainders.operatorConstants;
        operands = combineRemainders.operands;
    }

    Assert.isTrue(operands.length === 1, `operands.length === 1 failed`, {
        operandsLength: operands.length,
        operatorsLength: operatorConstants.length,
    });

    trace.exit();

    const result: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType = ArrayUtils.assertGet(
        operands,
        0,
    );

    Assert.isTrue(
        AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result),
        `AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result) failed`,
        { resultNodeKind: result.kind },
    );

    return result;
}

export interface CombineRemainders {
    readonly operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>;
    readonly operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>;
}

type TEqualityExpressionAndBelow = Ast.ArithmeticExpression | Ast.EqualityExpression | Ast.RelationalExpression;

interface NextCombine {
    readonly operatorConstant: Ast.TBinOpExpressionConstant;
    readonly operand: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType | undefined;
    readonly index: number;
    readonly nodeKind: Ast.TBinOpExpressionNodeKind;
}

interface Combiner<Node extends Ast.TBinOpExpression> {
    // The tag has zero functional use.
    // It's only exists because I'm lazy while debugging.
    readonly tag: Node["kind"];
    // The function combineWhile is driven by instances of this interface.
    // So long as there exists an operatorConstant it'll call getNextCombine to determine if/where to combine next.
    // Assume that operatorConstants and operands are of equal length and are non-empty.
    // A value of undefined indicates that there's no more combining to do as-is.
    // There are currently two ways to generate a new NextCombine:
    //  - Keep combining at the same operator index so long as a valid operator is next.
    //    For example, take `1 is number is number`:
    //      - there are 3 operands (`1`, `number`, `number`) and 2 operators (`is`, `is`)
    //      - start combining at the index of the first `is` operator
    //      - create a new IsExpression with `1` and `number` as operands and `is` as the operator
    //      - there are now 2 operands (`1 is number`, `number`) and 1 operator (`is`)
    //      - conditionally return the same operator index if the next operator is the same as the previous
    //  - Find the operator index with the highest precedence
    readonly getNextCombine: (
        operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
        operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
        previousNextCombine: NextCombine,
    ) => NextCombine | undefined;
    // Checks if the left operand is of the correct type
    readonly leftValidator: (node: Ast.TNode) => node is Node["left"];
    // If leftValidator fails, then this is the fallback function called.
    // It's expected to be a read function from NaiveParseSteps which will throw a ParseError
    readonly leftFallback: (state: ParseState, parser: Parser, correlationId: number) => void;
    readonly operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ) => operatorConstant is Node["operatorConstant"];
    // Same behavior and expectations as leftValidator/leftFallback
    readonly rightValidator: (node: Ast.TNode) => node is Node["right"];
    readonly rightFallback: (state: ParseState, parser: Parser, correlationId: number) => void;
}

function getSameNextCombineIfSameConstantKind(
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    previousNextCombine: NextCombine,
): NextCombine | undefined {
    const index: number = previousNextCombine.index;

    const nextOperatorKind: Constant.TBinOpExpressionOperator | undefined = operatorConstants[index]?.constantKind;

    return nextOperatorKind === previousNextCombine.operatorConstant.constantKind
        ? {
              operatorConstant: operatorConstants[index],
              operand: operands[index + 1],
              index,
              nodeKind: previousNextCombine.nodeKind,
          }
        : undefined;
}

// Cache

const NodeKindByTEqualityExpressionAndBelowOperatorKind: ReadonlyMap<string, TEqualityExpressionAndBelow["kind"]> =
    new Map<string, TEqualityExpressionAndBelow["kind"]>([
        [Constant.ArithmeticOperator.Multiplication, Ast.NodeKind.ArithmeticExpression],
        [Constant.ArithmeticOperator.Division, Ast.NodeKind.ArithmeticExpression],
        [Constant.ArithmeticOperator.Addition, Ast.NodeKind.ArithmeticExpression],
        [Constant.ArithmeticOperator.Subtraction, Ast.NodeKind.ArithmeticExpression],
        [Constant.ArithmeticOperator.And, Ast.NodeKind.ArithmeticExpression],
        [Constant.EqualityOperator.EqualTo, Ast.NodeKind.EqualityExpression],
        [Constant.EqualityOperator.NotEqualTo, Ast.NodeKind.EqualityExpression],
        [Constant.RelationalOperator.LessThan, Ast.NodeKind.RelationalExpression],
        [Constant.RelationalOperator.LessThanEqualTo, Ast.NodeKind.RelationalExpression],
        [Constant.RelationalOperator.GreaterThan, Ast.NodeKind.RelationalExpression],
        [Constant.RelationalOperator.GreaterThanEqualTo, Ast.NodeKind.RelationalExpression],
    ]);

// Combiners

const AsExpressionCombiner: Combiner<Ast.AsExpression> = {
    tag: Ast.NodeKind.AsExpression,
    getNextCombine: getSameNextCombineIfSameConstantKind,
    leftValidator: (node: Ast.TNode): node is Ast.TEqualityExpression => AstUtils.isTEqualityExpression(node),
    leftFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readEqualityExpression(state, parser, correlationId),
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ): operatorConstant is Ast.AsExpression["operatorConstant"] =>
        operatorConstant.constantKind === Constant.KeywordConstant.As,
    rightValidator: (node: Ast.TNode): node is Ast.TNullablePrimitiveType => AstUtils.isTNullablePrimitiveType(node),
    rightFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const EqualityExpressionAndBelowCombiner: Combiner<TEqualityExpressionAndBelow> = {
    tag: Ast.NodeKind.EqualityExpression,
    getNextCombine: (
        operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
        operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
        _previousNextCombine: NextCombine,
    ): NextCombine | undefined => {
        const index: number = findHighestPrecedenceIndex(operatorConstants);
        const operatorConstant: Ast.TBinOpExpressionConstant = ArrayUtils.assertGet(operatorConstants, index);

        const nodeKind: TEqualityExpressionAndBelow["kind"] | undefined =
            NodeKindByTEqualityExpressionAndBelowOperatorKind.get(operatorConstant.constantKind);

        if (!nodeKind) {
            return undefined;
        }

        return {
            operatorConstant,
            operand: ArrayUtils.assertGet(operands, index),
            nodeKind,
            index,
        };
    },
    leftValidator: (node: Ast.TNode): node is Ast.TMetadataExpression => AstUtils.isTEqualityExpression(node),
    leftFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ): operatorConstant is TEqualityExpressionAndBelow["operatorConstant"] =>
        NodeKindByTEqualityExpressionAndBelowOperatorKind.has(operatorConstant.constantKind),
    rightValidator: (node: Ast.TNode): node is Ast.TMetadataExpression => AstUtils.isTEqualityExpression(node),
    rightFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
};

const IsExpressionCombiner: Combiner<Ast.IsExpression> = {
    tag: Ast.NodeKind.IsExpression,
    getNextCombine: getSameNextCombineIfSameConstantKind,
    leftValidator: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTAsExpression(node),
    leftFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ): operatorConstant is Ast.IsExpression["operatorConstant"] =>
        operatorConstant.constantKind === Constant.KeywordConstant.Is,
    rightValidator: (node: Ast.TNode): node is Ast.TNullablePrimitiveType => AstUtils.isTNullablePrimitiveType(node),
    rightFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const LogicalAndExpressionCombiner: Combiner<Ast.LogicalExpression> = {
    tag: Ast.NodeKind.LogicalExpression,
    getNextCombine: getSameNextCombineIfSameConstantKind,
    leftValidator: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    leftFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ): operatorConstant is Ast.LogicalExpression["operatorConstant"] =>
        operatorConstant.constantKind === Constant.LogicalOperator.And,
    rightValidator: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTIsExpression(node),
    rightFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const LogicalOrExpressionCombiner: Combiner<Ast.LogicalExpression> = {
    tag: Ast.NodeKind.LogicalExpression,
    getNextCombine: getSameNextCombineIfSameConstantKind,
    leftValidator: isTIsExpressionOrLogicalAndExpression,
    leftFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ): operatorConstant is Ast.LogicalExpression["operatorConstant"] =>
        operatorConstant.constantKind === Constant.LogicalOperator.Or,
    rightValidator: isTIsExpressionOrLogicalAndExpression,
    rightFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const NullCoalescingExpressionCombiner: Combiner<Ast.NullCoalescingExpression> = {
    tag: Ast.NodeKind.NullCoalescingExpression,
    getNextCombine: getSameNextCombineIfSameConstantKind,
    leftValidator: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    leftFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ): operatorConstant is Ast.NullCoalescingExpression["operatorConstant"] =>
        operatorConstant.constantKind === Constant.MiscConstant.NullCoalescingOperator,
    rightValidator: (node: Ast.TNode): node is Ast.TNullCoalescingExpression =>
        AstUtils.isTNullCoalescingExpression(node),
    rightFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const MetadataExpressionCombiner: Combiner<Ast.MetadataExpression> = {
    tag: Ast.NodeKind.MetadataExpression,
    getNextCombine: getSameNextCombineIfSameConstantKind,
    leftValidator: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    leftFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ): operatorConstant is Ast.MetadataExpression["operatorConstant"] =>
        operatorConstant.constantKind === Constant.KeywordConstant.Meta,
    rightValidator: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    rightFallback: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

function addAstAsChild(nodeIdMapCollection: NodeIdMap.Collection, parent: ParseContext.TNode, child: Ast.TNode): void {
    parent.attributeCounter += 1;

    const parentId: number = parent.id;
    const oldChildren: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(parentId);

    nodeIdMapCollection.astNodeById.set(child.id, child);
    nodeIdMapCollection.parentIdById.set(child.id, parentId);
    nodeIdMapCollection.childIdsById.set(parentId, [...(oldChildren ?? []), child.id]);
    addNodeKindToCollection(nodeIdMapCollection.idsByNodeKind, child.kind, child.id);
}

function addNodeKindToCollection(
    idsByNodeKind: Map<Ast.NodeKind, Set<number>>,
    nodeKind: Ast.NodeKind,
    nodeId: number,
): void {
    const collection: Set<number> | undefined = idsByNodeKind.get(nodeKind);

    if (collection) {
        collection.add(nodeId);
    } else {
        idsByNodeKind.set(nodeKind, new Set([nodeId]));
    }
}

// It's assumed that operatorConstants and operands are the same length.
// Most of the internal logic of if/how to combine is driven by the combiner argument.
function combineWhile<Node extends Ast.TBinOpExpression>(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    combiner: Combiner<Node>,
    initialNextCombine: NextCombine,
    correlationId: number,
): CombineRemainders {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        combineWhile.name,
        correlationId,
    );

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const initialLeft: Ast.TNode = ArrayUtils.assertGet(operands, initialNextCombine.index);
    const initialOperatorConstant: Ast.TBinOpExpressionConstant = initialNextCombine.operatorConstant;

    // If leftValidator fails we should run the fallback which should throw.
    if (!combiner.leftValidator(initialLeft)) {
        ParseStateUtils.startContext(state, initialNextCombine.nodeKind);
        setParseStateToNodeStart(state, initialLeft);
        combiner.leftFallback(state, parser, trace.id);
        throw new CommonError.InvariantError(`leftValidator failed and then leftFallback did not throw.`);
    }

    // This should never happen, but setup the parse state to handle it just in case.
    if (!combiner.operatorConstantValidator(initialOperatorConstant)) {
        ParseStateUtils.startContext(state, initialNextCombine.nodeKind);
        setParseStateToNodeStart(state, initialOperatorConstant);
        throw new CommonError.InvariantError(`operatorConstantValidator failed.`);
    }

    let left: Node["left"] | Node = initialLeft;
    let nextCombine: NextCombine | undefined = initialNextCombine;

    // Continually combine `left <-> operator <-> right` as a new left until we encounter an operator we can't handle.
    while (nextCombine) {
        const operatorConstant: Ast.TBinOpExpressionConstant = nextCombine.operatorConstant;

        const binOpParseContext: ParseContext.TNode = ParseContextUtils.startContext(
            state.contextState,
            nextCombine.nodeKind,
            operatorConstant.tokenRange.tokenIndexStart,
            state.lexerSnapshot.tokens[operatorConstant.tokenRange.tokenIndexEnd + 1],
            undefined,
        );

        placeParseContextUnderPlaceholderContext(state, binOpParseContext, placeholderContextNodeId);
        addAstAsChild(nodeIdMapCollection, binOpParseContext, left);
        addAstAsChild(nodeIdMapCollection, binOpParseContext, operatorConstant);

        const right: Ast.TNode | undefined = nextCombine.operand;

        if (!right || !combiner.rightValidator(right)) {
            setParseStateToAfterNodeEnd(state, operatorConstant);
            combiner.rightFallback(state, parser, trace.id);
            throw new CommonError.InvariantError(`rightValidator failed and then rightFallback did not throw.`);
        }

        addAstAsChild(nodeIdMapCollection, binOpParseContext, right);
        setParseStateToAfterNodeEnd(state, right);

        // Now we create a new Ast node which will be the new `left` value.
        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;

        const newLeft: Node = {
            kind: binOpParseContext.kind,
            id: binOpParseContext.id,
            attributeIndex: 0,
            tokenRange: {
                tokenIndexStart: leftTokenRange.tokenIndexStart,
                tokenIndexEnd: rightTokenRange.tokenIndexEnd,
                positionStart: leftTokenRange.positionStart,
                positionEnd: rightTokenRange.positionEnd,
            },
            isLeaf: false,
            left,
            operatorConstant,
            right,
        } as Node;

        // Convert from ParseContext to Ast
        nodeIdMapCollection.astNodeById.set(newLeft.id, newLeft);
        MapUtils.assertDelete(nodeIdMapCollection.contextNodeById, newLeft.id);

        // Modify the operands and operatorConstants for the next iteration by:
        //  - replacing the `left` and `right` operands with the new `left` value
        //  - removing the operator
        operands = [...operands.slice(0, nextCombine.index), newLeft, ...operands.slice(nextCombine.index + 2)];
        operatorConstants = ArrayUtils.assertRemoveAtIndex(operatorConstants, nextCombine.index);

        nextCombine = operatorConstants.length
            ? combiner.getNextCombine(operatorConstants, operands, nextCombine)
            : undefined;

        left = newLeft;
    }

    state.currentContextNode = nodeIdMapCollection.contextNodeById.get(placeholderContextNodeId);

    trace.exit();

    return {
        operatorConstants,
        operands,
    };
}

function findHighestPrecedenceIndex(operators: ReadonlyArray<Ast.TBinOpExpressionConstant>): number {
    if (!operators.length) {
        return -1;
    }

    const numOperators: number = operators.length;
    let bestPrecedenceIndex: number = -1;
    let bestPrecedence: number = Number.MAX_SAFE_INTEGER;

    for (let index: number = 0; index < numOperators; index += 1) {
        const currentPrecedence: number = ConstantUtils.binOpExpressionOperatorPrecedence(
            operators[index].constantKind,
        );

        if (bestPrecedence > currentPrecedence) {
            bestPrecedence = currentPrecedence;
            bestPrecedenceIndex = index;
        }
    }

    Assert.isTrue(bestPrecedenceIndex !== -1, `operators is non-zero length and minPrecedenceIndex !== -1 failed`);

    return bestPrecedenceIndex;
}

function isTIsExpressionOrLogicalAndExpression(node: Ast.TNode): node is Ast.TLogicalExpression {
    return (
        AstUtils.isTIsExpression(node) ||
        (AstUtils.isNodeKind<Ast.LogicalExpression>(node, Ast.NodeKind.LogicalExpression) &&
            node.operatorConstant.constantKind === Constant.LogicalOperator.And)
    );
}

function placeParseContextUnderPlaceholderContext(
    state: ParseState,
    parseContext: ParseContext.TNode,
    placeholderContextNodeId: number,
): void {
    state.currentContextNode = parseContext;

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    nodeIdMapCollection.childIdsById.set(placeholderContextNodeId, [parseContext.id]);
    nodeIdMapCollection.parentIdById.set(parseContext.id, placeholderContextNodeId);
}

function setParseStateToNodeStart(state: ParseState, node: Ast.TNode): void {
    setParseStateToTokenIndex(state, node.tokenRange.tokenIndexStart);
}

function setParseStateToAfterNodeEnd(state: ParseState, node: Ast.TNode): void {
    setParseStateToTokenIndex(state, node.tokenRange.tokenIndexEnd + 1);
}

function setParseStateToTokenIndex(state: ParseState, tokenIndex: number): void {
    const token: Token.Token | undefined = state.lexerSnapshot.tokens[tokenIndex];

    state.currentToken = token;
    state.currentTokenKind = token?.kind;
    state.tokenIndex = tokenIndex;
}
