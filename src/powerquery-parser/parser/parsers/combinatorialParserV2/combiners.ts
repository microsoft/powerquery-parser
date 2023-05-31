// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils } from "../../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../../language";
import { NodeIdMap, ParseContext, ParseContextUtils } from "../..";
import { CombinatorialParserV2TraceConstant } from "./commonTypes";
import { NaiveParseSteps } from "..";
import { Parser } from "../../parser";
import { ParseState } from "../../parseState";
import { Trace } from "../../../common/trace";

// Takes N operators and N+1 operands.
// Continually combines the highest precedence operators with its operands,
// thus reducing both the number of operators and operands by 1 per iteration.
// Ends with 0 operator and 1 operand.

export function combineOperatorsAndOperands(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<TOperand>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    correlationId: number,
): TOperand {
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

    const sortedOperatorConstants: PrecedenceSortableOperatorConstant[] = sortByPrecedence(operatorConstants);

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    let nextOperator: PrecedenceSortableOperatorConstant | undefined = sortedOperatorConstants.pop();

    while (nextOperator) {
        const { index, operatorConstant }: PrecedenceSortableOperatorConstant = nextOperator;

        const nodeKind: Ast.TBinOpExpressionNodeKind = AstUtils.nodeKindForTBinOpExpressionOperator(
            operatorConstant.constantKind,
        );

        const left: TOperand = ArrayUtils.assertGet(operands, index);
        const right: TOperand = ArrayUtils.assertGet(operands, index + 1);

        const binOpParseContext: ParseContext.TNode = ParseContextUtils.startContext(
            state.contextState,
            nodeKind,
            operatorConstant.tokenRange.tokenIndexStart,
            state.lexerSnapshot.tokens[left.tokenRange.tokenIndexStart],
            undefined,
        );

        const validator: TValidator = MapUtils.assertGet(
            ValidatorsByBinOperatorExpressionOperator,
            operatorConstant.constantKind,
        );

        placeParseContextUnderPlaceholderContext(state, binOpParseContext, placeholderContextNodeId);

        if (!validator.validateLeftOperand(left)) {
            setParseStateToNodeStart(state, left);
            validator.fallbackLeftOperand(state, parser, trace.id);
            throw new CommonError.InvariantError(`leftValidator failed and then leftFallback did not throw.`);
        }

        addAstAsChild(nodeIdMapCollection, binOpParseContext, left);
        addAstAsChild(nodeIdMapCollection, binOpParseContext, operatorConstant);

        if (!validator.validateRightOperand(right)) {
            setParseStateToAfterNodeEnd(state, operatorConstant);
            validator.fallbackRightOperand(state, parser, trace.id);
            throw new CommonError.InvariantError(`rightValidator failed and then rightFallback did not throw.`);
        }

        addAstAsChild(nodeIdMapCollection, binOpParseContext, right);
        setParseStateToAfterNodeEnd(state, right);

        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;

        // The validators have confirmed both left and right operands.
        const binOp: Ast.TBinOpExpression = {
            kind: nodeKind,
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
        } as unknown as Ast.TBinOpExpression;

        // Promote from ParseContext into Ast
        nodeIdMapCollection.astNodeById.set(binOp.id, binOp);
        MapUtils.assertDelete(nodeIdMapCollection.contextNodeById, binOp.id);

        // Modify the operands and operatorConstants for the next iteration by:
        //  - replacing the `left` and `right` operands with the new `binOp` node
        //  - removing the operator
        operands = [...operands.slice(0, index), binOp, ...operands.slice(index + 2)];
        operatorConstants = ArrayUtils.assertRemoveAtIndex(operatorConstants, index);

        const numLeftoverOperators: number = sortedOperatorConstants.length;

        for (let leftoverIndex: number = index; index < numLeftoverOperators; leftoverIndex += 1) {
            const leftoverOperator: PrecedenceSortableOperatorConstant = ArrayUtils.assertGet(
                sortedOperatorConstants,
                leftoverIndex,
            );

            leftoverOperator.index -= 1;
        }

        nextOperator = sortedOperatorConstants.shift();
    }

    trace.exit();

    const result: TOperand = ArrayUtils.assertGet(operands, 0);

    Assert.isTrue(
        AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result),
        `AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result) failed`,
        { resultNodeKind: result.kind },
    );

    return result;
}

type TEqualityExpressionAndBelow = Ast.ArithmeticExpression | Ast.EqualityExpression | Ast.RelationalExpression;

type TOperand = Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType;

type TValidator =
    | Validator<Ast.AsExpression>
    | Validator<Ast.IsExpression>
    | Validator<Ast.LogicalExpression>
    | Validator<Ast.MetadataExpression>
    | Validator<Ast.NullCoalescingExpression>
    | Validator<TEqualityExpressionAndBelow>;

interface PrecedenceSortableOperatorConstant {
    index: number;
    readonly precedence: number;
    readonly operatorConstant: Ast.TBinOpExpressionConstant;
}

interface Validator<Node extends Ast.TBinOpExpression> {
    // The tag has zero functional use.
    // It's only exists because I'm lazy while debugging.
    readonly tag: string;
    // Checks if the left/right operand is of the correct type
    readonly validateLeftOperand: (node: Ast.TNode) => node is Node["left"];
    readonly validateRightOperand: (node: Ast.TNode) => node is Node["right"];
    // If left/right operand is the wrong type, then it should fallback to a call to NaiveParseStep,
    // which in turn should throw some sort of exception.
    readonly fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) => void;
    readonly fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) => void;
}

const ValidatorForAsExpression: Validator<Ast.AsExpression> = {
    tag: Ast.NodeKind.AsExpression,
    validateLeftOperand: (node: Ast.TNode): node is Ast.TEqualityExpression => AstUtils.isTAsExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullablePrimitiveType =>
        AstUtils.isTNullablePrimitiveType(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readEqualityExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const ValidatorForEqualityExpressionAndBelow: Validator<TEqualityExpressionAndBelow> = {
    tag: Ast.NodeKind.EqualityExpression,
    validateLeftOperand: (node: Ast.TNode): node is Ast.TMetadataExpression => AstUtils.isTEqualityExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TMetadataExpression => AstUtils.isTEqualityExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
};

const ValidatorForIsExpression: Validator<Ast.IsExpression> = {
    tag: Ast.NodeKind.IsExpression,
    validateLeftOperand: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTIsExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullablePrimitiveType =>
        AstUtils.isTNullablePrimitiveType(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const ValidatorForLogicalAndExpression: Validator<Ast.LogicalExpression> = {
    tag: `${Ast.NodeKind.LogicalExpression}:${Constant.LogicalOperator.And}`,
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTIsExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readIsExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readIsExpression(state, parser, correlationId),
};

const ValidatorForLogicalOrExpression: Validator<Ast.LogicalExpression> = {
    tag: `${Ast.NodeKind.LogicalExpression}:${Constant.LogicalOperator.Or}`,
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: isTIsExpressionOrLogicalAndExpression,
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const ValidatorForNullCoalescingExpression: Validator<Ast.NullCoalescingExpression> = {
    tag: Ast.NodeKind.NullCoalescingExpression,
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullCoalescingExpression =>
        AstUtils.isTNullCoalescingExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const ValidatorForMetadataExpression: Validator<Ast.MetadataExpression> = {
    tag: Ast.NodeKind.MetadataExpression,
    validateLeftOperand: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
};

const ValidatorsByBinOperatorExpressionOperator: Map<Constant.TBinOpExpressionOperator, TValidator> = new Map<
    Constant.TBinOpExpressionOperator,
    TValidator
>([
    [Constant.KeywordConstant.Meta, ValidatorForMetadataExpression],
    [Constant.ArithmeticOperator.Multiplication, ValidatorForEqualityExpressionAndBelow],
    [Constant.ArithmeticOperator.Division, ValidatorForEqualityExpressionAndBelow],
    [Constant.ArithmeticOperator.Addition, ValidatorForEqualityExpressionAndBelow],
    [Constant.ArithmeticOperator.Subtraction, ValidatorForEqualityExpressionAndBelow],
    [Constant.ArithmeticOperator.And, ValidatorForEqualityExpressionAndBelow],
    [Constant.RelationalOperator.LessThan, ValidatorForEqualityExpressionAndBelow],
    [Constant.RelationalOperator.LessThanEqualTo, ValidatorForEqualityExpressionAndBelow],
    [Constant.RelationalOperator.GreaterThan, ValidatorForEqualityExpressionAndBelow],
    [Constant.RelationalOperator.GreaterThanEqualTo, ValidatorForEqualityExpressionAndBelow],
    [Constant.EqualityOperator.EqualTo, ValidatorForEqualityExpressionAndBelow],
    [Constant.EqualityOperator.NotEqualTo, ValidatorForEqualityExpressionAndBelow],
    [Constant.KeywordConstant.As, ValidatorForAsExpression],
    [Constant.KeywordConstant.Is, ValidatorForIsExpression],
    [Constant.LogicalOperator.And, ValidatorForLogicalAndExpression],
    [Constant.LogicalOperator.Or, ValidatorForLogicalOrExpression],
    [Constant.MiscConstant.NullCoalescingOperator, ValidatorForNullCoalescingExpression],
]);

// Combiners

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

// Assumes operators are given in the order they appear in the source.
// Sorts them by precedence, then by their original index (ie. their order in the source).
function sortByPrecedence(
    operators: ReadonlyArray<Ast.TBinOpExpressionConstant>,
): PrecedenceSortableOperatorConstant[] {
    const sortableOperatorConstant: PrecedenceSortableOperatorConstant[] = operators.map(
        (operatorConstant: Ast.TBinOpExpressionConstant, index: number) => ({
            index,
            operatorConstant,
            precedence: ConstantUtils.binOpExpressionOperatorPrecedence(operatorConstant.constantKind),
        }),
    );

    return sortableOperatorConstant.sort(
        (left: PrecedenceSortableOperatorConstant, right: PrecedenceSortableOperatorConstant) => {
            const precedenceDiff: number = right.precedence - left.precedence;

            return precedenceDiff === 0 ? right.index - left.index : precedenceDiff;
        },
    );
}
