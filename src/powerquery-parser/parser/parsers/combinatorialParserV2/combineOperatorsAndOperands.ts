// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils } from "../../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../../language";
import { CombinatorialParserV2TraceConstant, OperatorsAndOperands, TOperand } from "./commonTypes";
import { NodeIdMap, ParseContext, ParseContextUtils } from "../..";
import { NaiveParseSteps } from "..";
import { Parser } from "../../parser";
import { ParseState } from "../../parseState";
import { Trace } from "../../../common/trace";

// Takes N operators and N+1 operands.
// Continually combines the highest precedence operators the operands they're adjacent to,
// thus reducing the number of operators and operands by 1 per iteration.
// Ends with 0 operators and 1 operand.
export function combineOperatorsAndOperands(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operatorsAndOperands: OperatorsAndOperands,
    correlationId: number,
): TOperand {
    let { operatorConstants, operands }: OperatorsAndOperands = operatorsAndOperands;

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

    // Sorts operator by precedence where the highest precedence operators are first.
    const sortedOperatorConstants: ReadonlyArray<PrecedenceSortableOperatorConstant> =
        sortByPrecedence(operatorConstants);

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const numOperators: number = sortedOperatorConstants.length;

    for (const [precedenceSortableOperatorConstant, index] of ArrayUtils.enumerate(sortedOperatorConstants)) {
        const { leftOperandIndex, operatorConstant }: PrecedenceSortableOperatorConstant =
            precedenceSortableOperatorConstant;

        const nodeKind: Ast.TBinOpExpressionNodeKind = AstUtils.nodeKindFromTBinOpExpressionOperator(
            operatorConstant.constantKind,
        );

        const left: TOperand = ArrayUtils.assertGet(operands, leftOperandIndex);
        const right: TOperand = ArrayUtils.assertGet(operands, leftOperandIndex + 1);

        const binOpParseContext: ParseContext.TNode = ParseContextUtils.startContext(
            state.contextState,
            nodeKind,
            left.tokenRange.tokenIndexStart,
            state.lexerSnapshot.tokens[left.tokenRange.tokenIndexStart],
            undefined,
        );

        placeParseContextUnderPlaceholderContext(state, binOpParseContext, placeholderContextNodeId);

        const validator: TValidator = MapUtils.assertGet(
            ValidatorsByTBinOpExpressionOperator,
            operatorConstant.constantKind,
        );

        if (!validator.validateLeftOperand(left)) {
            setParseStateToNodeStart(state, left);
            validator.fallbackLeftOperand(state, parser, trace.id);
            throw new CommonError.InvariantError(
                `validateLeftOperand failed and then fallbackLeftOperand did not throw.`,
            );
        }

        addAstAsChild(nodeIdMapCollection, binOpParseContext, left);
        addAstAsChild(nodeIdMapCollection, binOpParseContext, operatorConstant);

        if (!validator.validateRightOperand(right)) {
            setParseStateToAfterNodeEnd(state, operatorConstant);
            validator.fallbackRightOperand(state, parser, trace.id);
            throw new CommonError.InvariantError(
                `validateRightOperand failed and then fallbackRightOperand did not throw.`,
            );
        }

        addAstAsChild(nodeIdMapCollection, binOpParseContext, right);
        setParseStateToAfterNodeEnd(state, right);

        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;

        // We started with an operatorConstant belonging under TBinOpExpression["operatorConstant"].
        // Working backwards, we derived the nodeKind for some TBinOpExpression `T` and validators
        // which should validate left is `T["left"]` and right is `T["right"]`.
        // Therefore, we should be able to cast it as a TBinOpExpression.
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
        operands = [...operands.slice(0, leftOperandIndex), binOp, ...operands.slice(leftOperandIndex + 2)];
        operatorConstants = ArrayUtils.assertRemoveAtIndex(operatorConstants, leftOperandIndex);

        // Since we've mutated the list of operands we need to update the leftOperandIndex.
        // for all operators to the right of the one we just processed.
        for (let unvisitedIndex: number = index + 1; unvisitedIndex < numOperators; unvisitedIndex += 1) {
            const unvisitedOperator: PrecedenceSortableOperatorConstant = ArrayUtils.assertGet(
                sortedOperatorConstants,
                unvisitedIndex,
            );

            if (unvisitedOperator.leftOperandIndex > leftOperandIndex) {
                unvisitedOperator.leftOperandIndex -= 1;
            }
        }
    }

    const result: TOperand = ArrayUtils.assertGet(operands, 0);

    Assert.isTrue(
        AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result),
        `AstUtils.isTBinOpExpression(result) || AstUtils.isTUnaryExpression(result) failed`,
        { resultNodeKind: result.kind },
    );

    trace.exit();

    return result;
}

type TEqualityExpressionAndBelow = Ast.ArithmeticExpression | Ast.EqualityExpression | Ast.RelationalExpression;

type TValidator =
    | Validator<Ast.AsExpression>
    | Validator<Ast.IsExpression>
    | Validator<Ast.LogicalExpression>
    | Validator<Ast.MetadataExpression>
    | Validator<Ast.NullCoalescingExpression>
    | Validator<TEqualityExpressionAndBelow>;

interface PrecedenceSortableOperatorConstant {
    leftOperandIndex: number;
    readonly precedence: number;
    readonly operatorConstant: Ast.TBinOpExpressionConstant;
}

interface Validator<Node extends Ast.TBinOpExpression> {
    // The tag has zero functional use.
    // It's only exists because I'm lazy while debugging.
    readonly tag:
        | "AsExpression"
        | "EqualityExpression"
        | "IsExpression"
        | "LogicalAndExpression"
        | "LogicalOrExpression"
        | "MetadataExpression"
        | "NullCoalescingExpression";
    // Checks if the left/right operand is of the correct type
    readonly validateLeftOperand: (node: Ast.TNode) => node is Node["left"];
    readonly validateRightOperand: (node: Ast.TNode) => node is Node["right"];
    // If left/right operand is the wrong type, then it should fallback to a call to NaiveParseStep,
    // which in turn should throw some sort of exception.
    readonly fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) => void;
    readonly fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) => void;
}

const ValidatorForAsExpression: Validator<Ast.AsExpression> = {
    tag: "AsExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TEqualityExpression => AstUtils.isTAsExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullablePrimitiveType =>
        AstUtils.isTNullablePrimitiveType(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readEqualityExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const ValidatorForEqualityExpressionAndBelow: Validator<TEqualityExpressionAndBelow> = {
    tag: "EqualityExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TMetadataExpression => AstUtils.isTEqualityExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TMetadataExpression => AstUtils.isTEqualityExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readMetadataExpression(state, parser, correlationId),
};

const ValidatorForIsExpression: Validator<Ast.IsExpression> = {
    tag: "IsExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTIsExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullablePrimitiveType =>
        AstUtils.isTNullablePrimitiveType(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readNullablePrimitiveType(state, parser, correlationId),
};

const ValidatorForLogicalAndExpression: Validator<Ast.LogicalExpression> = {
    tag: "LogicalAndExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TIsExpression => AstUtils.isTIsExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readIsExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readIsExpression(state, parser, correlationId),
};

const ValidatorForLogicalOrExpression: Validator<Ast.LogicalExpression> = {
    tag: "LogicalOrExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: isTIsExpressionOrLogicalAndExpression,
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const ValidatorForNullCoalescingExpression: Validator<Ast.NullCoalescingExpression> = {
    tag: "NullCoalescingExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TLogicalExpression => AstUtils.isTLogicalExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TNullCoalescingExpression =>
        AstUtils.isTNullCoalescingExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readLogicalExpression(state, parser, correlationId),
};

const ValidatorForMetadataExpression: Validator<Ast.MetadataExpression> = {
    tag: "MetadataExpression",
    validateLeftOperand: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    validateRightOperand: (node: Ast.TNode): node is Ast.TUnaryExpression => AstUtils.isTUnaryExpression(node),
    fallbackLeftOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
    fallbackRightOperand: (state: ParseState, parser: Parser, correlationId: number) =>
        NaiveParseSteps.readUnaryExpression(state, parser, correlationId),
};

const ValidatorsByTBinOpExpressionOperator: Map<Constant.TBinOpExpressionOperator, TValidator> = new Map<
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

// Returns an array that iterates over the operators in order of precedence,
// with tie breakers being the order they were given (which should also be the order they appear in the document)
function sortByPrecedence(
    operators: ReadonlyArray<Ast.TBinOpExpressionConstant>,
): ReadonlyArray<PrecedenceSortableOperatorConstant> {
    const sortableOperatorConstant: PrecedenceSortableOperatorConstant[] = operators.map(
        (operatorConstant: Ast.TBinOpExpressionConstant, index: number) => ({
            leftOperandIndex: index,
            operatorConstant,
            precedence: ConstantUtils.binOpExpressionOperatorPrecedence(operatorConstant.constantKind),
        }),
    );

    return sortableOperatorConstant.sort(
        (left: PrecedenceSortableOperatorConstant, right: PrecedenceSortableOperatorConstant) => {
            const precedenceDelta: number = right.precedence - left.precedence;

            return precedenceDelta === 0 ? left.leftOperandIndex - right.leftOperandIndex : precedenceDelta;
        },
    );
}
