// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils, SetUtils } from "../../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../../language";
import { CombinatorialParserV2TraceConstant, ReadAttempt } from "./commonTypes";
import { NodeIdMap, ParseContext, ParseContextUtils } from "../..";
import { EqualityExpressionAndBelowOperatorConstantKinds } from "./caches";
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
    Assert.isTrue(operatorConstants.length === operands.length + 1, `operators.length !== operands.length + 1`, {
        operandsLength: operands.length,
        operatorsLength: operatorConstants.length,
    });

    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        combineOperatorsAndOperands.name,
        correlationId,
    );

    while (operatorConstants.length) {
        const index: number = findMinOperatorPrecedenceIndex(operatorConstants);
        const minOperator: Ast.TBinOpExpressionConstant = ArrayUtils.assertGet(operatorConstants, index);
        const minOperatorConstantKind: Constant.TBinOpExpressionOperator = minOperator.constantKind;

        switch (minOperatorConstantKind) {
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
                    const readAttempt: ReadAttempt = combineEqualityExpressionAndBelow(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operands,
                        operatorConstants,
                        trace.id,
                    );

                    operatorConstants = readAttempt.operatorConstants;
                    operands = readAttempt.operands;

                    Assert.isTrue(operatorConstants.length === 0, `operatorConstants.length === 0 failed`, {
                        operatorConstantsLength: operatorConstants.length,
                    });

                    Assert.isTrue(operands.length === 0, `operands.length === 0 failed`, {
                        operandsLength: operands.length,
                    });
                }

                break;

            case Constant.LogicalOperator.And:
                // eslint-disable-next-line no-lone-blocks
                {
                    const readAttempt: ReadAttempt = combineLogicalAndExpression(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operands,
                        operatorConstants,
                        index,
                        trace.id,
                    );

                    operatorConstants = readAttempt.operatorConstants;
                    operands = readAttempt.operands;
                }

                break;

            case Constant.LogicalOperator.Or:
                // eslint-disable-next-line no-lone-blocks
                {
                    const readAttempt: ReadAttempt = combineLogicalOrExpression(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operands,
                        operatorConstants,
                        index,
                        trace.id,
                    );

                    operatorConstants = readAttempt.operatorConstants;
                    operands = readAttempt.operands;
                }

                break;

            case Constant.KeywordConstant.As:
                // eslint-disable-next-line no-lone-blocks
                {
                    const readAttempt: ReadAttempt = combineAsExpression(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operands,
                        operatorConstants,
                        index,
                        trace.id,
                    );

                    operatorConstants = readAttempt.operatorConstants;
                    operands = readAttempt.operands;
                }

                break;

            case Constant.KeywordConstant.Is:
                // eslint-disable-next-line no-lone-blocks
                {
                    const readAttempt: ReadAttempt = combineIsExpression(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operands,
                        operatorConstants,
                        index,
                        trace.id,
                    );

                    operatorConstants = readAttempt.operatorConstants;
                    operands = readAttempt.operands;
                }

                break;

            case Constant.KeywordConstant.Meta:
                // eslint-disable-next-line no-lone-blocks
                {
                    const readAttempt: ReadAttempt = combineMetadataExpression(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operands,
                        operatorConstants,
                        index,
                        trace.id,
                    );

                    operatorConstants = readAttempt.operatorConstants;
                    operands = readAttempt.operands;
                }

                break;

            case Constant.MiscConstant.NullCoalescingOperator:
                // eslint-disable-next-line no-lone-blocks
                {
                    const readAttempt: ReadAttempt = combineNullCoalescingExpression(
                        state,
                        parser,
                        placeholderContextNodeId,
                        operands,
                        operatorConstants,
                        index,
                        trace.id,
                    );

                    operatorConstants = readAttempt.operatorConstants;
                    operands = readAttempt.operands;
                }

                break;

            default:
                Assert.isNever(minOperatorConstantKind);
        }
    }

    Assert.isTrue(operands.length === 1, `operands.length === 1`, {
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
        `AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result)`,
        { resultNodeKind: result.kind },
    );

    return result;
}

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

function combineEqualityExpressionAndBelow(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    correlationId: number,
): ReadAttempt {
    return combineWhile<Ast.ArithmeticExpression | Ast.EqualityExpression | Ast.RelationalExpression>(
        state,
        placeholderContextNodeId,
        operands,
        operatorConstants,
        Ast.NodeKind.EqualityExpression,
        findMinOperatorPrecedenceIndex,
        (
            remainingOperatorConstant: Ast.TBinOpExpressionConstant,
        ): remainingOperatorConstant is Ast.IConstant<
            Constant.ArithmeticOperator | Constant.EqualityOperator | Constant.RelationalOperator
        > => EqualityExpressionAndBelowOperatorConstantKinds.has(remainingOperatorConstant.constantKind),
        AstUtils.isTMetadataExpression,
        () => NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
        AstUtils.isTMetadataExpression,
        () => NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
        correlationId,
    );
}

function combineAsExpression(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    index: number,
    correlationId: number,
): ReadAttempt {
    return combineWhile<Ast.AsExpression>(
        state,
        placeholderContextNodeId,
        operands,
        operatorConstants,
        Ast.NodeKind.AsExpression,
        (_: ReadonlyArray<Ast.TBinOpExpressionConstant>) => index,
        (
            operatorConstant: Ast.TBinOpExpressionConstant,
        ): operatorConstant is Ast.IConstant<Constant.KeywordConstant.As> =>
            operatorConstant.constantKind === Constant.KeywordConstant.As,
        AstUtils.isTEqualityExpression,
        () => NaiveParseSteps.readEqualityExpression(state, parser, correlationId),
        AstUtils.isTNullablePrimitiveType,
        () => NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
        correlationId,
    );
}

function combineIsExpression(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    index: number,
    correlationId: number,
): ReadAttempt {
    return combineWhile<Ast.IsExpression>(
        state,
        placeholderContextNodeId,
        operands,
        operatorConstants,
        Ast.NodeKind.IsExpression,
        (_: ReadonlyArray<Ast.TBinOpExpressionConstant>) => index,
        (
            operatorConstant: Ast.TBinOpExpressionConstant,
        ): operatorConstant is Ast.IConstant<Constant.KeywordConstant.Is> =>
            operatorConstant.constantKind === Constant.KeywordConstant.Is,
        AstUtils.isTAsExpression,
        () => NaiveParseSteps.readAsExpression(state, parser, correlationId),
        AstUtils.isTNullablePrimitiveType,
        () => NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
        correlationId,
    );
}

function combineLogicalAndExpression(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    index: number,
    correlationId: number,
): ReadAttempt {
    return combineWhile<Ast.LogicalExpression>(
        state,
        placeholderContextNodeId,
        operands,
        operatorConstants,
        Ast.NodeKind.LogicalExpression,
        (_: ReadonlyArray<Ast.TBinOpExpressionConstant>) => index,
        (
            operatorConstant: Ast.TBinOpExpressionConstant,
        ): operatorConstant is Ast.IConstant<Constant.LogicalOperator.And> =>
            operatorConstant.constantKind === Constant.LogicalOperator.And,
        AstUtils.isTIsExpression,
        () => NaiveParseSteps.readIsExpression(state, parser, correlationId),
        AstUtils.isTIsExpression,
        () => NaiveParseSteps.readIsExpression(state, parser, correlationId),
        correlationId,
    );
}

function combineLogicalOrExpression(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    index: number,
    correlationId: number,
): ReadAttempt {
    return combineWhile<Ast.LogicalExpression>(
        state,
        placeholderContextNodeId,
        operands,
        operatorConstants,
        Ast.NodeKind.LogicalExpression,
        (_: ReadonlyArray<Ast.TBinOpExpressionConstant>) => index,
        (
            operatorConstant: Ast.TBinOpExpressionConstant,
        ): operatorConstant is Ast.IConstant<Constant.LogicalOperator.Or> =>
            operatorConstant.constantKind === Constant.LogicalOperator.Or,
        isTIsExpressionOrLogicalAndExpression,
        () => NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
        isTIsExpressionOrLogicalAndExpression,
        () => NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
        correlationId,
    );
}

function combineMetadataExpression(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    index: number,
    correlationId: number,
): ReadAttempt {
    return combineWhile<Ast.MetadataExpression>(
        state,
        placeholderContextNodeId,
        operands,
        operatorConstants,
        Ast.NodeKind.MetadataExpression,
        (_: ReadonlyArray<Ast.TBinOpExpressionConstant>) => index,
        (
            operatorConstant: Ast.TBinOpExpressionConstant,
        ): operatorConstant is Ast.IConstant<Constant.KeywordConstant.Meta> =>
            operatorConstant.constantKind === Constant.KeywordConstant.Meta,
        AstUtils.isTUnaryExpression,
        () => NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
        AstUtils.isTUnaryExpression,
        () => NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
        correlationId,
    );
}

function combineNullCoalescingExpression(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    index: number,
    correlationId: number,
): ReadAttempt {
    return combineWhile<Ast.NullCoalescingExpression>(
        state,
        placeholderContextNodeId,
        operands,
        operatorConstants,
        Ast.NodeKind.NullCoalescingExpression,
        (_: ReadonlyArray<Ast.TBinOpExpressionConstant>) => index,
        (
            operatorConstant: Ast.TBinOpExpressionConstant,
        ): operatorConstant is Ast.IConstant<Constant.MiscConstant.NullCoalescingOperator> =>
            operatorConstant.constantKind === Constant.MiscConstant.NullCoalescingOperator,
        AstUtils.isTLogicalExpression,
        () => NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
        AstUtils.isTLogicalExpression,
        () => NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
        correlationId,
    );
}

// I know this a behemoth of a function, but I can't think of a better way to do this.
// It takes a collection of N operators and N+1 operands and merges as many as it can into new Ast nodes of type Node.
//
// Different Nodes have different rules as to what can be merged. For example:
// - The LogicalOperator.Or operator combines TIsExpression | (LogicalExpression with LogicalOperator.And operator),
//   meanwhile the LogicalOperator.And combines TIsExpression.
//
// Many invocations assume it will keep reading w/o the index being altered each iteration.
// Eg. for AsExpression is read with the following pseudo code
// ```
//  while (operatorConstants[index] is AsConstant)) {
//      right = readNullablePrimitiveType(operands[index])
//  }
// ```
// However, the Arithmetic, Relational, and Equality operators do not follow this pattern.
// Instead they find the highest precedence operator and then reads from there.
// ```
//  index = highestPrecedence(remainingOperators)
//  while (operatorConstants[index] is ArithmeticConstant)) {
//      right = readSomething(operands[index])
//      index = highestPrecedence(remainingOperators)
//  }
// ```
function combineWhile<
    Node extends
        | Ast.AsExpression
        | Ast.IsExpression
        | Ast.LogicalExpression
        | Ast.MetadataExpression
        | Ast.NullCoalescingExpression
        | Ast.ArithmeticExpression
        | Ast.EqualityExpression
        | Ast.RelationalExpression,
>(
    state: ParseState,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    binOpNodeKind: Node["kind"],
    // For most contexts this returns a static number.
    // However, for Arithmetic | Equality | Relational operators this will return the highest precedence operator.
    nextOperatorIndex: (operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>) => number,
    operatorConstantValidator: (
        operatorConstant: Ast.TBinOpExpressionConstant,
    ) => operatorConstant is Node["operatorConstant"],
    leftValidator: (node: Ast.TNode) => node is Node["left"],
    // Expecting this to be a read function from NaiveParseSteps which will throw a ParseError
    leftFallback: () => void,
    rightValidator: (node: Ast.TNode) => node is Node["right"],
    // Expecting this to be a read function from NaiveParseSteps which will throw a ParseError
    rightFallback: () => void,
    correlationId: number,
): ReadAttempt {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        combineWhile.name,
        correlationId,
    );

    let index: number = nextOperatorIndex(operatorConstants);
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;

    let left: Ast.TBinOpExpression["left"] | Node = ArrayUtils.assertGet(operands, index) as
        | Ast.TBinOpExpression["left"]
        | Node;

    // Start a new ParseContext which will be combining `left <-> operator <-> right` together.
    let binOpParseContext: ParseContext.Node<Node> = ParseContextUtils.startContext(
        state.contextState,
        binOpNodeKind,
        left.tokenRange.tokenIndexStart,
        ArrayUtils.assertGet(state.lexerSnapshot.tokens, left.tokenRange.tokenIndexStart),
        undefined,
    );

    let binOpParseContextNodeId: number = binOpParseContext.id;

    placeParseContextUnderPlaceholderContext(state, binOpParseContext, placeholderContextNodeId);

    // If leftValidator fails we should run the fallback which should throw.
    if (!leftValidator(left)) {
        setParseStateToNodeStart(state, left);
        leftFallback();
        throw new CommonError.InvariantError(`leftValidator failed and then leftFallback did not throw.`);
    }

    addAstAsChild(nodeIdMapCollection, binOpParseContext, left);
    setParseStateToAfterNodeEnd(state, left);
    let operatorConstant: Ast.TBinOpExpressionConstant = ArrayUtils.assertGet(operatorConstants, index);

    // This should never happen so long as the input parameters are valid.
    if (!operatorConstantValidator(operatorConstant)) {
        throw new CommonError.InvariantError(`operatorConstantValidator failed.`);
    }

    // Continually combine `left <-> operator <-> right` until we encounter an operator we can't handle.
    while (operatorConstantValidator(operatorConstant)) {
        // It's assumed that the following state has been set:
        //  - astNodes: left
        //  - contextNodes: placeholderContextNode, binOpParseContextNode
        //  - deletedNodes: nil
        //
        //  - placeholderContextNode.children -> [binOpParseContext]
        //  - binOpParseContext.parent -> placeholderContextNode
        //  - binOpParseContext.children -> [left]
        //  - left.parent -> binOpParseContext
        //
        //  - idsByNodeKind has: placeholderContextNode, binOpParseContextNode, left

        addAstAsChild(nodeIdMapCollection, binOpParseContext, operatorConstant);
        setParseStateToAfterNodeEnd(state, operatorConstant);

        const right: Ast.TNode = ArrayUtils.assertGet(operands, index + 1);

        if (!rightValidator(right)) {
            setParseStateToNodeStart(state, right);
            rightFallback();
            throw new CommonError.InvariantError(`rightValidator failed and then rightFallback did not throw.`);
        }

        addAstAsChild(nodeIdMapCollection, binOpParseContext, right);
        setParseStateToAfterNodeEnd(state, right);

        // It's assumed that the following state has been set:
        //  - astNodes: left, operatorConstant, right
        //  - contextNodes: placeholderContextNode, binOpParseContextNode
        //  - deletedNodes: nil
        //
        //  - placeholderContextNode.children -> [binOpParseContext]
        //  - binOpParseContext.parent -> placeholderContextNode
        //  - binOpParseContext.children -> [left, operatorConstant, right]
        //  - left.parent -> binOpParseContext
        //  - operatorConstant.parent -> binOpParseContext
        //  - right.parent -> binOpParseContext
        //
        //  - idsByNodeKind has: placeholderContextNode, binOpParseContextNode, left, operatorConstant, right

        // Now we create a new Ast node which will be the new `left` value.
        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;

        const newLeft: Node = (left = {
            kind: binOpNodeKind,
            id: binOpParseContextNodeId,
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
        } as Node);

        // Convert from ParseContext to Ast
        nodeIdMapCollection.astNodeById.set(newLeft.id, newLeft);
        MapUtils.assertDelete(nodeIdMapCollection.contextNodeById, newLeft.id);

        // Start a new ParseContext with the new `left` Ast as its own `left` value
        const newBinOpParseContext: ParseContext.Node<Node> = ParseContextUtils.startContext(
            state.contextState,
            binOpNodeKind,
            binOpParseContext.tokenIndexStart,
            binOpParseContext.tokenStart,
            undefined,
        );

        const newBinOpParseContextNodeId: number = newBinOpParseContext.id;
        placeParseContextUnderPlaceholderContext(state, newBinOpParseContext, placeholderContextNodeId);

        // Link the new `left` value to being under the new ParseContext
        nodeIdMapCollection.parentIdById.set(newLeft.id, newBinOpParseContextNodeId);
        nodeIdMapCollection.childIdsById.set(newBinOpParseContextNodeId, [newLeft.id]);
        removeNodeKindFromCollection(state, binOpNodeKind, binOpParseContextNodeId);

        // It's assumed that the following state has been set:
        //  - astNodes: newLeft, left, operatorConstant, right
        //  - contextNodes: placeholderContextNode, newBinOpParseContextNode
        //  - deletedNodes: binOpParseContextNode
        //
        //  - placeholderContextNode.children -> [newBinOpParseContext]
        //  - newBinOpParseContext.parent -> placeholderContextNode
        //  - newBinOpParseContext.children -> [newLeft]
        //  - newLeft.parent -> newBinOpParseContext
        //  - newLeft.children -> [left, operatorConstant, right]
        //  - left.parent -> newLeft
        //  - operatorConstant.parent -> newLeft
        //  - right.parent -> newLeft
        //
        //  - idsByNodeKind has: placeholderContextNode, newBinOpParseContextNode, left, operatorConstant, right

        operands = [...operands.slice(0, index), left, ...operands.slice(index + 2)];
        operatorConstants = ArrayUtils.assertRemoveAtIndex(operatorConstants, index);

        left = newLeft;
        binOpParseContext = newBinOpParseContext;
        binOpParseContextNodeId = newBinOpParseContextNodeId;

        index = nextOperatorIndex(operatorConstants);
        operatorConstant = ArrayUtils.assertGet(operatorConstants, index);
    }

    trace.exit();

    return {
        operatorConstants,
        operands,
    };
}

function findMinOperatorPrecedenceIndex(operators: ReadonlyArray<Ast.TBinOpExpressionConstant>): number {
    const numOperators: number = operators.length;
    let minPrecedenceIndex: number = -1;
    let minPrecedence: number = Number.MAX_SAFE_INTEGER;

    for (let index: number = 0; index < numOperators; index += 1) {
        const currentPrecedence: number = ConstantUtils.binOpExpressionOperatorPrecedence(
            operators[index].constantKind,
        );

        if (minPrecedence > currentPrecedence) {
            minPrecedence = currentPrecedence;
            minPrecedenceIndex = index;
        }
    }

    Assert.isTrue(minPrecedenceIndex !== -1, `minPrecedenceIndex !== -1`);

    return minPrecedenceIndex;
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
    const token: Token.Token = ArrayUtils.assertGet(state.lexerSnapshot.tokens, tokenIndex);

    state.currentToken = token;
    state.currentTokenKind = token.kind;
    state.tokenIndex = tokenIndex;
}

function removeNodeKindFromCollection(state: ParseState, nodeKind: Ast.NodeKind, nodeId: number): void {
    const idsByNodeKind: Map<Ast.NodeKind, Set<number>> = state.contextState.nodeIdMapCollection.idsByNodeKind;

    const collection: Set<number> = MapUtils.assertGet(idsByNodeKind, nodeKind);
    SetUtils.assertDelete(collection, nodeId);

    if (collection.size === 0) {
        idsByNodeKind.delete(nodeKind);
    }
}
