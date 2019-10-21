// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, ParserContext } from "..";
import { CommonError, isNever, Option, ArrayUtils } from "../../common";
import { TokenKind } from "../../lexer";
import { BracketDisambiguation, IParser } from "../IParser";
import { IParserState, IParserStateUtils } from "../IParserState";
import { readBracketDisambiguation, readTokenKindAsConstant } from "./common";
import * as Naive from "./naive";

export let CombinatorialParser: IParser<IParserState> = {
    // 12.1.6 Identifiers
    readIdentifier: Naive.readIdentifier,
    readGeneralizedIdentifier: Naive.readGeneralizedIdentifier,
    readKeyword: Naive.readKeyword,

    // 12.2.1 Documents
    readDocument: Naive.readDocument,

    // 12.2.2 Section Documents
    readSectionDocument: Naive.readSectionDocument,
    readSectionMembers: Naive.readSectionMembers,
    readSectionMember: Naive.readSectionMember,

    // 12.2.3.1 Expressions
    readExpression: Naive.readExpression,

    // 12.2.3.2 Logical expressions
    readLogicalExpression: Naive.readLogicalExpression,

    // 12.2.3.3 Is expression
    readIsExpression: Naive.readIsExpression,
    readNullablePrimitiveType: Naive.readNullablePrimitiveType,

    // 12.2.3.4 As expression
    readAsExpression: Naive.readAsExpression,

    // 12.2.3.5 Equality expression
    readEqualityExpression: Naive.readEqualityExpression,

    // 12.2.3.6 Relational expression
    readRelationalExpression: Naive.readRelationalExpression,

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: Naive.readArithmeticExpression,

    // 12.2.3.8 Metadata expression
    readMetadataExpression,

    // 12.2.3.9 Unary expression
    readUnaryExpression,

    // 12.2.3.10 Primary expression
    readPrimaryExpression: Naive.readPrimaryExpression,
    readRecursivePrimaryExpression: Naive.readRecursivePrimaryExpression,

    // 12.2.3.11 Literal expression
    readLiteralExpression: Naive.readLiteralExpression,

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: Naive.readIdentifierExpression,

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: Naive.readParenthesizedExpression,

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: Naive.readNotImplementedExpression,

    // 12.2.3.16 Invoke expression
    readInvokeExpression: Naive.readInvokeExpression,

    // 12.2.3.17 List expression
    readListExpression: Naive.readListExpression,
    readListItem: Naive.readListItem,

    // 12.2.3.18 Record expression
    readRecordExpression: Naive.readRecordExpression,

    // 12.2.3.19 Item access expression
    readItemAccessExpression: Naive.readItemAccessExpression,

    // 12.2.3.20 Field access expression
    readFieldSelection: Naive.readFieldSelection,
    readFieldProjection: Naive.readFieldProjection,
    readFieldSelector: Naive.readFieldSelector,

    // 12.2.3.21 Function expression
    readFunctionExpression: Naive.readFunctionExpression,
    readParameterList: Naive.readParameterList,
    readAsType: Naive.readAsType,

    // 12.2.3.22 Each expression
    readEachExpression: Naive.readEachExpression,

    // 12.2.3.23 Let expression
    readLetExpression: Naive.readLetExpression,

    // 12.2.3.24 If expression
    readIfExpression: Naive.readIfExpression,

    // 12.2.3.25 Type expression
    readTypeExpression: Naive.readTypeExpression,
    readType: Naive.readType,
    readPrimaryType: Naive.readPrimaryType,
    readRecordType: Naive.readRecordType,
    readTableType: Naive.readTableType,
    readFieldSpecificationList: Naive.readFieldSpecificationList,
    readListType: Naive.readListType,
    readFunctionType: Naive.readFunctionType,
    readParameterSpecificationList: Naive.readParameterSpecificationList,
    readNullableType: Naive.readNullableType,

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: Naive.readErrorRaisingExpression,

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: Naive.readErrorHandlingExpression,

    // 12.2.4 Literal Attributes
    readRecordLiteral: Naive.readRecordLiteral,
    readFieldNamePairedAnyLiterals: Naive.readFieldNamePairedAnyLiterals,
    readListLiteral: Naive.readListLiteral,
    readAnyLiteral: Naive.readAnyLiteral,
    readPrimitiveType: Naive.readPrimitiveType,

    // Disambiguation
    disambiguateBracket: Naive.disambiguateBracket,
    disambiguateParenthesis: Naive.disambiguateParenthesis,

    // key-value pairs
    readIdentifierPairedExpressions: Naive.readIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpressions: Naive.readGeneralizedIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpression: Naive.readGeneralizedIdentifierPairedExpression,
    readIdentifierPairedExpression: Naive.readIdentifierPairedExpression,
};

function readUnaryExpression(state: IParserState, parser: IParser<IParserState>): Ast.TUnaryExpression {
    let maybePrimaryExpression: Option<Ast.TPrimaryExpression>;

    // LL(1)
    switch (state.maybeCurrentTokenKind) {
        // PrimaryExpression
        case TokenKind.AtSign:
        case TokenKind.Identifier:
            maybePrimaryExpression = Naive.readIdentifierExpression(state, parser);
            break;

        case TokenKind.LeftParenthesis:
            maybePrimaryExpression = Naive.readParenthesizedExpression(state, parser);
            break;

        case TokenKind.LeftBracket:
            maybePrimaryExpression = readBracketDisambiguation(state, parser, [
                BracketDisambiguation.FieldProjection,
                BracketDisambiguation.FieldSelection,
                BracketDisambiguation.Record,
            ]);
            break;

        case TokenKind.LeftBrace:
            maybePrimaryExpression = Naive.readListExpression(state, parser);
            break;

        case TokenKind.Ellipsis:
            maybePrimaryExpression = Naive.readNotImplementedExpression(state, parser);
            break;

        // LiteralExpression
        case TokenKind.HexLiteral:
        case TokenKind.KeywordFalse:
        case TokenKind.KeywordTrue:
        case TokenKind.NumericLiteral:
        case TokenKind.NullLiteral:
        case TokenKind.StringLiteral:
            return Naive.readLiteralExpression(state, parser);

        // TypeExpression
        case TokenKind.KeywordType:
            return Naive.readTypeExpression(state, parser);

        case TokenKind.KeywordHashSections:
        case TokenKind.KeywordHashShared:
        case TokenKind.KeywordHashBinary:
        case TokenKind.KeywordHashDate:
        case TokenKind.KeywordHashDateTime:
        case TokenKind.KeywordHashDateTimeZone:
        case TokenKind.KeywordHashDuration:
        case TokenKind.KeywordHashTable:
        case TokenKind.KeywordHashTime:
            maybePrimaryExpression = parser.readKeyword(state, parser);
            break;

        // Let Naive throw an error.
        default:
            return Naive.readUnaryExpression(state, parser);
    }

    // We should only reach this code block if a primary expression was read.
    const primaryExpression: Ast.TPrimaryExpression = maybePrimaryExpression;
    if (IParserStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex)) {
        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression);
    } else {
        return primaryExpression;
    }
}

function readMetadataExpression(state: IParserState, parser: IParser<IParserState>): Ast.TMetadataExpression {
    return (readBinOpExpression(state, parser, Ast.NodeKind.MetadataExpression) as unknown) as Ast.TMetadataExpression;
}

function readBinOpExpression(
    state: IParserState,
    parser: IParser<IParserState>,
    nodeKind: Ast.NodeKind,
): Ast.TBinOpExpression {
    IParserStateUtils.startContext(state, nodeKind);
    const placeholderContextId: number = state.maybeCurrentContextNode!.id;

    let operators: Ast.TBinOpExpressionOperator[] = [];
    let operatorConstants: Ast.Constant[] = [];
    let expressions: (Ast.TBinOpExpression | Ast.TUnaryExpression)[] = [parser.readUnaryExpression(state, parser)];

    let maybeOperator: Option<Ast.TBinOpExpressionOperator> = Ast.binOpExpressionOperatorFrom(
        state.maybeCurrentTokenKind,
    );
    while (maybeOperator !== undefined) {
        const operator: Ast.TBinOpExpressionOperator = maybeOperator;
        operators.push(operator);
        operatorConstants.push(readTokenKindAsConstant(state, state.maybeCurrentTokenKind!));
        expressions.push(parser.readUnaryExpression(state, parser));

        maybeOperator = Ast.binOpExpressionOperatorFrom(state.maybeCurrentTokenKind);
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;
    const newNodeThreshold: number = state.contextState.idCounter;
    let placeholderContextChildren: ReadonlyArray<number> = nodeIdMapCollection.childIdsById.get(placeholderContextId)!;
    while (operators.length) {
        let minPrecedenceIndex: number = -1;
        let minPrecedence: number = Number.MAX_SAFE_INTEGER;

        for (let index: number = 0; index < operators.length; index += 1) {
            const currentPrecedence: number = Ast.binOpExpressionOperatorPrecedence(operators[index]);
            if (minPrecedence > currentPrecedence) {
                minPrecedence = currentPrecedence;
                minPrecedenceIndex = index;
            }
        }

        state.contextState.idCounter += 1;
        const newBinOpExpressionId: number = state.contextState.idCounter;

        const left: Ast.TBinOpExpression | Ast.TUnaryExpression = expressions[minPrecedenceIndex];
        const operator: Ast.TBinOpExpressionOperator = operators[minPrecedenceIndex];
        const operatorConstant: Ast.Constant = operatorConstants[minPrecedenceIndex];
        const right: Ast.TBinOpExpression | Ast.TUnaryExpression = expressions[minPrecedenceIndex + 1];

        const newBinOpExpression: Ast.TBinOpExpression = {
            kind: binOpExpressionNodeKindFrom(operator),
            id: newBinOpExpressionId,
            maybeAttributeIndex: 0,
            tokenRange: {
                tokenIndexStart: 0,
                tokenIndexEnd: 0,
                positionStart: {
                    lineCodeUnit: 0,
                    lineNumber: 0,
                    codeUnit: 0,
                },
                positionEnd: {
                    lineCodeUnit: 0,
                    lineNumber: 0,
                    codeUnit: 0,
                },
            },
            isLeaf: false,
            left: left as any,
            operator,
            operatorConstant,
            right,
        } as any;

        operators = [...operators.slice(0, minPrecedenceIndex), ...operators.slice(minPrecedenceIndex + 1)];
        operatorConstants = [
            ...operatorConstants.slice(0, minPrecedenceIndex),
            ...operatorConstants.slice(minPrecedenceIndex + 1),
        ];
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

        // All children are currently under the placeholder context node.
        // They need to be removed for deleteContext(placeholderContext) to succeed.
        // We can't assume left / right is always removable because it might be a newBinOpExpression
        // which was generated manually outside of starting a context, therefore it's not auto-assigned as
        // a child of the placeholderContext.
        placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, operatorConstant.id);
        if (left.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, left.id);
        }
        if (right.id <= newNodeThreshold) {
            placeholderContextChildren = ArrayUtils.removeFirstInstance(placeholderContextChildren, right.id);
        }
        nodeIdMapCollection.childIdsById.set(placeholderContextId, placeholderContextChildren);
    }

    const lastExpression: Ast.TBinOpExpression | Ast.TUnaryExpression = expressions[0];
    if (!Ast.isTBinOpExpression(lastExpression)) {
        const details: {} = {
            lastExpressionId: lastExpression.id,
            lastExpressionKind: lastExpression.kind,
        };
        throw new CommonError.InvariantError(`lastExpression should be a TBinOpExpression`, details);
    }
    nodeIdMapCollection.childIdsById.set(placeholderContextId, [lastExpression.id]);
    nodeIdMapCollection.parentIdById.set(lastExpression.id, placeholderContextId);

    IParserStateUtils.deleteContext(state, placeholderContextId);
    return lastExpression;
}

function binOpExpressionNodeKindFrom(operator: Ast.TBinOpExpressionOperator): Ast.TBinOpExpressionNodeKind {
    switch (operator) {
        case Ast.ArithmeticOperator.Multiplication:
        case Ast.ArithmeticOperator.Division:
        case Ast.ArithmeticOperator.Addition:
        case Ast.ArithmeticOperator.Subtraction:
        case Ast.ArithmeticOperator.And:
            return Ast.NodeKind.ArithmeticExpression;

        case Ast.RelationalOperator.GreaterThan:
        case Ast.RelationalOperator.GreaterThanEqualTo:
        case Ast.RelationalOperator.LessThan:
        case Ast.RelationalOperator.LessThanEqualTo:
            return Ast.NodeKind.RelationalExpression;

        case Ast.EqualityOperator.EqualTo:
        case Ast.EqualityOperator.NotEqualTo:
            return Ast.NodeKind.EqualityExpression;

        case Ast.ConstantKind.As:
            return Ast.NodeKind.AsExpression;

        case Ast.ConstantKind.Is:
            return Ast.NodeKind.IsExpression;

        case Ast.LogicalOperator.And:
        case Ast.LogicalOperator.Or:
            return Ast.NodeKind.LogicalExpression;

        default:
            throw isNever(operator);
    }
}
