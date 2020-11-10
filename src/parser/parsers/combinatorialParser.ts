// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { NodeIdMap, ParseContextUtils } from "..";
import { ArrayUtils, Assert, TypeScriptUtils } from "../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../language";
import { Disambiguation, DisambiguationUtils } from "../disambiguation";
import { IParser, IParserStateCheckpoint, IParserUtils } from "../IParser";
import { IParserState, IParserStateUtils } from "../IParserState";

// If the Naive parser were to parse the expression '1' it would need to recurse down a dozen or so constructs,
// which at each step would create a new context node, parse LiteralExpression, then traverse back up while
// cleaning the no-op context nodes along the way. Two key optimizations are used to prevent that.
//
// 1)
// The reading of binary expressions (expressions linked by TBinOpExpressionOperator) has been flattened.
// A TUnaryExpression read first, then while a TBinOpExpressionOperator is next it will read the operator
// constant and then the right hand of the TBinOpExpression. All expressions read will be placed in a flat list.
// Once no more expressions can be read the flat list will be shaped into a proper Ast.
// This eliminates several no-op functions calls on the call stack when reading a bare TUnaryExpression (eg. `1`).
//
// 2)
// readUnaryExpression uses limited look ahead to eliminate several function calls on the call stack.
export const CombinatorialParser: IParser<IParserState> = {
    ...NaiveParseSteps,
    createCheckpoint: (state: IParserState) => IParserUtils.stateCheckpointFactory(state),
    restoreFromCheckpoint: (state: IParserState, checkpoint: IParserStateCheckpoint) =>
        IParserUtils.restoreStateCheckpoint(state, checkpoint),

    // 12.2.3.2 Logical expressions
    readLogicalExpression: (state: IParserState, parser: IParser<IParserState>) =>
        (readBinOpExpression(state, parser, Ast.NodeKind.LogicalExpression) as unknown) as Ast.LogicalExpression,

    // 12.2.3.3 Is expression
    readIsExpression: (state: IParserState, parser: IParser<IParserState>) =>
        (readBinOpExpression(state, parser, Ast.NodeKind.IsExpression) as unknown) as Ast.IsExpression,

    // 12.2.3.4 As expression
    readAsExpression: (state: IParserState, parser: IParser<IParserState>) =>
        (readBinOpExpression(state, parser, Ast.NodeKind.AsExpression) as unknown) as Ast.AsExpression,

    // 12.2.3.5 Equality expression
    readEqualityExpression: (state: IParserState, parser: IParser<IParserState>) =>
        (readBinOpExpression(state, parser, Ast.NodeKind.EqualityExpression) as unknown) as Ast.EqualityExpression,

    // 12.2.3.6 Relational expression
    readRelationalExpression: (state: IParserState, parser: IParser<IParserState>) =>
        (readBinOpExpression(state, parser, Ast.NodeKind.RelationalExpression) as unknown) as Ast.RelationalExpression,

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: (state: IParserState, parser: IParser<IParserState>) =>
        (readBinOpExpression(state, parser, Ast.NodeKind.ArithmeticExpression) as unknown) as Ast.ArithmeticExpression,

    // 12.2.3.8 Metadata expression
    readMetadataExpression: (state: IParserState, parser: IParser<IParserState>) =>
        (readBinOpExpression(state, parser, Ast.NodeKind.MetadataExpression) as unknown) as Ast.MetadataExpression,

    // 12.2.3.9 Unary expression
    readUnaryExpression,
};

function readBinOpExpression<S extends IParserState = IParserState>(
    state: S,
    parser: IParser<S>,
    nodeKind: Ast.NodeKind,
): Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType {
    state.maybeCancellationToken?.throwIfCancelled();
    IParserStateUtils.startContext(state, nodeKind);
    const placeholderContextId: number = state.maybeCurrentContextNode!.id;

    // operators/operatorConstants are of length N
    // expressions are of length N + 1
    let operators: Constant.TBinOpExpressionOperator[] = [];
    let operatorConstants: Ast.IConstant<Constant.TBinOpExpressionOperator>[] = [];
    let expressions: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [
        parser.readUnaryExpression(state, parser),
    ];

    let maybeOperator:
        | Constant.TBinOpExpressionOperator
        | undefined = ConstantUtils.maybeBinOpExpressionOperatorKindFrom(state.maybeCurrentTokenKind);
    while (maybeOperator !== undefined) {
        const operator: Constant.TBinOpExpressionOperator = maybeOperator;
        operators.push(operator);
        operatorConstants.push(
            NaiveParseSteps.readTokenKindAsConstant<S, Constant.TBinOpExpressionOperator>(
                state,
                state.maybeCurrentTokenKind!,
                maybeOperator,
            ),
        );

        switch (operator) {
            case Constant.KeywordConstantKind.As:
            case Constant.KeywordConstantKind.Is:
                expressions.push(parser.readNullablePrimitiveType(state, parser));
                break;

            default:
                expressions.push(parser.readUnaryExpression(state, parser));
        }

        maybeOperator = ConstantUtils.maybeBinOpExpressionOperatorKindFrom(state.maybeCurrentTokenKind);
    }

    // There was a single TUnaryExpression, not a TBinOpExpression.
    if (expressions.length === 1) {
        IParserStateUtils.deleteContext(state, placeholderContextId);
        return expressions[0];
    }

    // Build up the Ast by using the lowest precedence operator and the two adjacent expressions,
    // which might be previously built TBinOpExpression nodes.
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const newNodeThreshold: number = state.contextState.idCounter;
    let placeholderContextChildren: ReadonlyArray<number> = nodeIdMapCollection.childIdsById.get(placeholderContextId)!;
    while (operators.length) {
        let minPrecedenceIndex: number = -1;
        let minPrecedence: number = Number.MAX_SAFE_INTEGER;

        for (let index: number = 0; index < operators.length; index += 1) {
            const currentPrecedence: number = ConstantUtils.binOpExpressionOperatorPrecedence(operators[index]);
            if (minPrecedence > currentPrecedence) {
                minPrecedence = currentPrecedence;
                minPrecedenceIndex = index;
            }
        }

        const newBinOpExpressionId: number = ParseContextUtils.nextId(state.contextState);
        const left: TypeScriptUtils.StripReadonly<
            Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType
        > = expressions[minPrecedenceIndex];
        const operator: Constant.TBinOpExpressionOperator = operators[minPrecedenceIndex];
        const operatorConstant: TypeScriptUtils.StripReadonly<Ast.IConstant<Constant.TBinOpExpressionOperator>> =
            operatorConstants[minPrecedenceIndex];
        const right: TypeScriptUtils.StripReadonly<
            Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType
        > = expressions[minPrecedenceIndex + 1];

        left.maybeAttributeIndex = 0;
        operatorConstant.maybeAttributeIndex = 1;
        right.maybeAttributeIndex = 2;

        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;
        const newBinOpExpression: Ast.TBinOpExpression = {
            kind: binOpExpressionNodeKindFrom(operator),
            id: newBinOpExpressionId,
            // maybeAttributeIndex is fixed after all TBinOpExpressions have been created.
            maybeAttributeIndex: 0,
            tokenRange: {
                tokenIndexStart: leftTokenRange.tokenIndexStart,
                tokenIndexEnd: rightTokenRange.tokenIndexEnd,
                positionStart: leftTokenRange.positionStart,
                positionEnd: rightTokenRange.positionEnd,
            },
            isLeaf: false,
            left: left as Ast.TBinOpExpression,
            operator,
            operatorConstant,
            right,
        } as Ast.TBinOpExpression;

        operators = ArrayUtils.removeAtIndex(operators, minPrecedenceIndex);
        operatorConstants = ArrayUtils.removeAtIndex(operatorConstants, minPrecedenceIndex);
        expressions = expressions = [
            ...expressions.slice(0, minPrecedenceIndex),
            newBinOpExpression,
            ...expressions.slice(minPrecedenceIndex + 2),
        ];

        // Correct the parentIds for the nodes combined into newBinOpExpression.
        nodeIdMapCollection.parentIdById.set(left.id, newBinOpExpressionId);
        nodeIdMapCollection.parentIdById.set(operatorConstant.id, newBinOpExpressionId);
        nodeIdMapCollection.parentIdById.set(right.id, newBinOpExpressionId);

        // Assign the nodeIdMap values for newBinOpExpression.
        nodeIdMapCollection.childIdsById.set(newBinOpExpressionId, [left.id, operatorConstant.id, right.id]);
        nodeIdMapCollection.astNodeById.set(newBinOpExpressionId, newBinOpExpression);

        // All TUnaryExpression and operatorConstants start by being placed under the context node.
        // They need to be removed for deleteContext(placeholderContextId) to succeed.
        placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, operatorConstant.id);
        if (left.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, left.id);
        }
        if (right.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, right.id);
        }
        nodeIdMapCollection.childIdsById.set(placeholderContextId, placeholderContextChildren);
    }

    const lastExpression: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType = expressions[0];
    Assert.isTrue(AstUtils.isTBinOpExpression(lastExpression), `lastExpression should be a TBinOpExpression`, {
        lastExpressionId: lastExpression.id,
        lastExpressionKind: lastExpression.kind,
    });
    nodeIdMapCollection.childIdsById.set(placeholderContextId, [lastExpression.id]);
    nodeIdMapCollection.parentIdById.set(lastExpression.id, placeholderContextId);

    IParserStateUtils.deleteContext(state, placeholderContextId);
    return lastExpression;
}

function binOpExpressionNodeKindFrom(operator: Constant.TBinOpExpressionOperator): Ast.TBinOpExpressionNodeKind {
    switch (operator) {
        case Constant.KeywordConstantKind.Meta:
            return Ast.NodeKind.MetadataExpression;

        case Constant.ArithmeticOperatorKind.Multiplication:
        case Constant.ArithmeticOperatorKind.Division:
        case Constant.ArithmeticOperatorKind.Addition:
        case Constant.ArithmeticOperatorKind.Subtraction:
        case Constant.ArithmeticOperatorKind.And:
            return Ast.NodeKind.ArithmeticExpression;

        case Constant.RelationalOperatorKind.GreaterThan:
        case Constant.RelationalOperatorKind.GreaterThanEqualTo:
        case Constant.RelationalOperatorKind.LessThan:
        case Constant.RelationalOperatorKind.LessThanEqualTo:
            return Ast.NodeKind.RelationalExpression;

        case Constant.EqualityOperatorKind.EqualTo:
        case Constant.EqualityOperatorKind.NotEqualTo:
            return Ast.NodeKind.EqualityExpression;

        case Constant.KeywordConstantKind.As:
            return Ast.NodeKind.AsExpression;

        case Constant.KeywordConstantKind.Is:
            return Ast.NodeKind.IsExpression;

        case Constant.LogicalOperatorKind.And:
        case Constant.LogicalOperatorKind.Or:
            return Ast.NodeKind.LogicalExpression;

        case Constant.MiscConstantKind.NullCoalescingOperator:
            return Ast.NodeKind.NullCoalescingExpression;

        default:
            throw Assert.isNever(operator);
    }
}

function readUnaryExpression(state: IParserState, parser: IParser<IParserState>): Ast.TUnaryExpression {
    state.maybeCancellationToken?.throwIfCancelled();

    let maybePrimaryExpression: Ast.TPrimaryExpression | undefined;
    // LL(1)
    switch (state.maybeCurrentTokenKind) {
        // PrimaryExpression
        case Token.TokenKind.AtSign:
        case Token.TokenKind.Identifier:
            maybePrimaryExpression = NaiveParseSteps.readIdentifierExpression(state, parser);
            break;

        case Token.TokenKind.LeftParenthesis:
            maybePrimaryExpression = NaiveParseSteps.readParenthesizedExpression(state, parser);
            break;

        case Token.TokenKind.LeftBracket:
            maybePrimaryExpression = DisambiguationUtils.readAmbiguousBracket(state, parser, [
                Disambiguation.BracketDisambiguation.FieldProjection,
                Disambiguation.BracketDisambiguation.FieldSelection,
                Disambiguation.BracketDisambiguation.Record,
            ]);
            break;

        case Token.TokenKind.LeftBrace:
            maybePrimaryExpression = NaiveParseSteps.readListExpression(state, parser);
            break;

        case Token.TokenKind.Ellipsis:
            maybePrimaryExpression = NaiveParseSteps.readNotImplementedExpression(state, parser);
            break;

        // LiteralExpression
        case Token.TokenKind.HexLiteral:
        case Token.TokenKind.KeywordFalse:
        case Token.TokenKind.KeywordTrue:
        case Token.TokenKind.NumericLiteral:
        case Token.TokenKind.NullLiteral:
        case Token.TokenKind.TextLiteral:
            return NaiveParseSteps.readLiteralExpression(state, parser);

        // TypeExpression
        case Token.TokenKind.KeywordType:
            return NaiveParseSteps.readTypeExpression(state, parser);

        case Token.TokenKind.KeywordHashSections:
        case Token.TokenKind.KeywordHashShared:
        case Token.TokenKind.KeywordHashBinary:
        case Token.TokenKind.KeywordHashDate:
        case Token.TokenKind.KeywordHashDateTime:
        case Token.TokenKind.KeywordHashDateTimeZone:
        case Token.TokenKind.KeywordHashDuration:
        case Token.TokenKind.KeywordHashTable:
        case Token.TokenKind.KeywordHashTime:
            maybePrimaryExpression = parser.readKeyword(state, parser);
            break;

        // Let Naive throw an error.
        default:
            return NaiveParseSteps.readUnaryExpression(state, parser);
    }

    // We should only reach this code block if a primary expression was read.
    const primaryExpression: Ast.TPrimaryExpression = maybePrimaryExpression;
    if (IParserStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex)) {
        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
    } else {
        return primaryExpression;
    }
}
