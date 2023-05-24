// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils, SetUtils } from "../../common";
import { Ast, AstUtils, Constant, ConstantUtils, Token } from "../../language";
import { Disambiguation, DisambiguationUtils } from "../disambiguation";
import { NodeIdMap, ParseContext, ParseContextUtils } from "..";
import { Parser, ParserUtils } from "../parser";
import { ParseState, ParseStateUtils } from "../parseState";
import { NaiveParseSteps } from ".";
import { Trace } from "../../common/trace";
import { TokenKind } from "../../language/token";

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
export const CombinatorialParser: Parser = {
    applyState: ParseStateUtils.applyState,
    copyState: ParseStateUtils.copyState,
    checkpoint: ParserUtils.checkpoint,
    restoreCheckpoint: ParserUtils.restoreCheckpoint,

    readIdentifier: NaiveParseSteps.readIdentifier,
    readGeneralizedIdentifier: NaiveParseSteps.readGeneralizedIdentifier,
    readKeyword: NaiveParseSteps.readKeyword,

    readDocument: NaiveParseSteps.readDocument,

    readSectionDocument: NaiveParseSteps.readSectionDocument,
    readSectionMembers: NaiveParseSteps.readSectionMembers,
    readSectionMember: NaiveParseSteps.readSectionMember,

    readNullCoalescingExpression: NaiveParseSteps.readNullCoalescingExpression,
    readExpression: NaiveParseSteps.readExpression,

    readLogicalExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.LogicalExpression,
            correlationId,
        ) as Promise<Ast.TLogicalExpression>,

    readIsExpression: NaiveParseSteps.readIsExpression,
    readNullablePrimitiveType: NaiveParseSteps.readNullablePrimitiveType,

    readAsExpression: NaiveParseSteps.readAsExpression,

    readEqualityExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.EqualityExpression,
            correlationId,
        ) as Promise<Ast.TEqualityExpression>,

    readRelationalExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.RelationalExpression,
            correlationId,
        ) as Promise<Ast.TRelationalExpression>,

    readArithmeticExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.ArithmeticExpression,
            correlationId,
        ) as Promise<Ast.TArithmeticExpression>,

    readMetadataExpression: (state: ParseState, parser: Parser, correlationId: number | undefined) =>
        readBinOpExpression(
            state,
            parser,
            Ast.NodeKind.MetadataExpression,
            correlationId,
        ) as Promise<Ast.TMetadataExpression>,

    readUnaryExpression,

    readPrimaryExpression: NaiveParseSteps.readPrimaryExpression,
    readRecursivePrimaryExpression: NaiveParseSteps.readRecursivePrimaryExpression,

    readLiteralExpression: NaiveParseSteps.readLiteralExpression,

    readIdentifierExpression: NaiveParseSteps.readIdentifierExpression,

    readParenthesizedExpression: NaiveParseSteps.readParenthesizedExpression,

    readNotImplementedExpression: NaiveParseSteps.readNotImplementedExpression,

    readInvokeExpression: NaiveParseSteps.readInvokeExpression,

    readListExpression: NaiveParseSteps.readListExpression,
    readListItem: NaiveParseSteps.readListItem,

    readRecordExpression: NaiveParseSteps.readRecordExpression,

    readItemAccessExpression: NaiveParseSteps.readItemAccessExpression,

    readFieldSelection: NaiveParseSteps.readFieldSelection,
    readFieldProjection: NaiveParseSteps.readFieldProjection,
    readFieldSelector: NaiveParseSteps.readFieldSelector,

    readFunctionExpression: NaiveParseSteps.readFunctionExpression,
    readParameterList: NaiveParseSteps.readParameterList,
    readAsType: NaiveParseSteps.readAsType,

    readEachExpression: NaiveParseSteps.readEachExpression,

    readLetExpression: NaiveParseSteps.readLetExpression,

    readIfExpression: NaiveParseSteps.readIfExpression,

    readTypeExpression: NaiveParseSteps.readTypeExpression,
    readType: NaiveParseSteps.readType,
    readPrimaryType: NaiveParseSteps.readPrimaryType,
    readRecordType: NaiveParseSteps.readRecordType,
    readTableType: NaiveParseSteps.readTableType,
    readFieldSpecificationList: NaiveParseSteps.readFieldSpecificationList,
    readListType: NaiveParseSteps.readListType,
    readFunctionType: NaiveParseSteps.readFunctionType,
    readParameterSpecificationList: NaiveParseSteps.readParameterSpecificationList,
    readNullableType: NaiveParseSteps.readNullableType,

    readErrorRaisingExpression: NaiveParseSteps.readErrorRaisingExpression,

    readErrorHandlingExpression: NaiveParseSteps.readErrorHandlingExpression,

    readRecordLiteral: NaiveParseSteps.readRecordLiteral,
    readFieldNamePairedAnyLiterals: NaiveParseSteps.readFieldNamePairedAnyLiterals,
    readListLiteral: NaiveParseSteps.readListLiteral,
    readAnyLiteral: NaiveParseSteps.readAnyLiteral,
    readPrimitiveType: NaiveParseSteps.readPrimitiveType,

    readIdentifierPairedExpressions: NaiveParseSteps.readIdentifierPairedExpressions,
    readIdentifierPairedExpression: NaiveParseSteps.readIdentifierPairedExpression,
    readGeneralizedIdentifierPairedExpressions: NaiveParseSteps.readGeneralizedIdentifierPairedExpressions,
    readGeneralizedIdentifierPairedExpression: NaiveParseSteps.readGeneralizedIdentifierPairedExpression,
};

const enum CombinatorialParserV2TraceConstant {
    CombinatorialParseV2 = "CombinatorialParseV2",
}

const enum DuoReadKind {
    LogicalExpression = Ast.NodeKind.LogicalExpression,
    NullablePrimitiveType = Ast.NodeKind.NullablePrimitiveType,
    UnaryExpression = Ast.NodeKind.UnaryExpression,
}

type TNextDuoRead = NextDuoReadLogicalExpression | NextDuoReadNullablePrimitiveType | NextDuoReadUnaryExpression;

type NextDuoReadLogicalExpression = {
    readonly duoReadKind: DuoReadKind.LogicalExpression;
    readonly nodeKind: Ast.NodeKind.NullCoalescingExpression;
    readonly operatorTokenKind: Token.TokenKind.NullCoalescingOperator;
    readonly operatorConstantKind: Constant.MiscConstant.NullCoalescingOperator;
};

type NextDuoReadNullablePrimitiveType = {
    readonly duoReadKind: DuoReadKind.NullablePrimitiveType;
} & (
    | {
          readonly nodeKind: Ast.NodeKind.AsExpression;
          readonly operatorTokenKind: TokenKind.KeywordAs;
          readonly operatorConstantKind: Constant.KeywordConstant.As;
      }
    | {
          readonly nodeKind: Ast.NodeKind.IsExpression;
          readonly operatorTokenKind: TokenKind.KeywordIs;
          readonly operatorConstantKind: Constant.KeywordConstant.Is;
      }
);

type NextDuoReadUnaryExpression = {
    readonly duoReadKind: DuoReadKind.UnaryExpression;
} & (
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: TokenKind.Asterisk;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Multiplication;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: TokenKind.Division;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Division;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: TokenKind.Plus;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Addition;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: TokenKind.Minus;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Subtraction;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: TokenKind.Ampersand;
          readonly operatorConstantKind: Constant.ArithmeticOperator.And;
      }
    | {
          readonly nodeKind: Ast.NodeKind.EqualityExpression;
          readonly operatorTokenKind: TokenKind.Equal;
          readonly operatorConstantKind: Constant.EqualityOperator.EqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.EqualityExpression;
          readonly operatorTokenKind: TokenKind.NotEqual;
          readonly operatorConstantKind: Constant.EqualityOperator.NotEqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.LogicalExpression;
          readonly operatorTokenKind: TokenKind.KeywordAnd;
          readonly operatorConstantKind: Constant.LogicalOperator.And;
      }
    | {
          readonly nodeKind: Ast.NodeKind.LogicalExpression;
          readonly operatorTokenKind: TokenKind.KeywordOr;
          readonly operatorConstantKind: Constant.LogicalOperator.Or;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: TokenKind.LessThan;
          readonly operatorConstantKind: Constant.RelationalOperator.LessThan;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: TokenKind.LessThanEqualTo;
          readonly operatorConstantKind: Constant.RelationalOperator.LessThanEqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: TokenKind.GreaterThan;
          readonly operatorConstantKind: Constant.RelationalOperator.GreaterThan;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: TokenKind.GreaterThanEqualTo;
          readonly operatorConstantKind: Constant.RelationalOperator.GreaterThanEqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.MetadataExpression;
          readonly operatorTokenKind: TokenKind.KeywordMeta;
          readonly operatorConstantKind: Constant.KeywordConstant.Meta;
      }
);

const EqualityExpressionAndBelowOperatorConstantKinds = new Set<string>([
    ...Constant.ArithmeticOperators,
    ...Constant.EqualityOperators,
    ...Constant.RelationalOperators,
]);

const NextDuoReadByTokenKind: ReadonlyMap<Token.TokenKind | undefined, TNextDuoRead> = new Map<
    Token.TokenKind | undefined,
    TNextDuoRead
>([
    [
        TokenKind.Asterisk,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: TokenKind.Asterisk,
            operatorConstantKind: Constant.ArithmeticOperator.Multiplication,
        },
    ],
    [
        TokenKind.Division,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: TokenKind.Division,
            operatorConstantKind: Constant.ArithmeticOperator.Division,
        },
    ],
    [
        TokenKind.Plus,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: TokenKind.Plus,
            operatorConstantKind: Constant.ArithmeticOperator.Addition,
        },
    ],
    [
        TokenKind.Minus,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: TokenKind.Minus,
            operatorConstantKind: Constant.ArithmeticOperator.Subtraction,
        },
    ],
    [
        TokenKind.Ampersand,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: TokenKind.Ampersand,
            operatorConstantKind: Constant.ArithmeticOperator.And,
        },
    ],
    [
        TokenKind.Equal,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.EqualityExpression,
            operatorTokenKind: TokenKind.Equal,
            operatorConstantKind: Constant.EqualityOperator.EqualTo,
        },
    ],
    [
        TokenKind.NotEqual,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.EqualityExpression,
            operatorTokenKind: TokenKind.NotEqual,
            operatorConstantKind: Constant.EqualityOperator.NotEqualTo,
        },
    ],
    [
        TokenKind.KeywordAnd,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.LogicalExpression,
            operatorTokenKind: TokenKind.KeywordAnd,
            operatorConstantKind: Constant.LogicalOperator.And,
        },
    ],
    [
        TokenKind.KeywordOr,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.LogicalExpression,
            operatorTokenKind: TokenKind.KeywordOr,
            operatorConstantKind: Constant.LogicalOperator.Or,
        },
    ],
    [
        TokenKind.LessThan,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: TokenKind.LessThan,
            operatorConstantKind: Constant.RelationalOperator.LessThan,
        },
    ],
    [
        TokenKind.LessThanEqualTo,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: TokenKind.LessThanEqualTo,
            operatorConstantKind: Constant.RelationalOperator.LessThanEqualTo,
        },
    ],
    [
        TokenKind.GreaterThan,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: TokenKind.GreaterThan,
            operatorConstantKind: Constant.RelationalOperator.GreaterThan,
        },
    ],
    [
        TokenKind.GreaterThanEqualTo,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: TokenKind.GreaterThanEqualTo,
            operatorConstantKind: Constant.RelationalOperator.GreaterThanEqualTo,
        },
    ],
    [
        TokenKind.KeywordAs,
        {
            duoReadKind: DuoReadKind.NullablePrimitiveType,
            nodeKind: Ast.NodeKind.AsExpression,
            operatorTokenKind: TokenKind.KeywordAs,
            operatorConstantKind: Constant.KeywordConstant.As,
        },
    ],
    [
        TokenKind.KeywordIs,
        {
            duoReadKind: DuoReadKind.NullablePrimitiveType,
            nodeKind: Ast.NodeKind.IsExpression,
            operatorTokenKind: TokenKind.KeywordIs,
            operatorConstantKind: Constant.KeywordConstant.Is,
        },
    ],
    [
        TokenKind.KeywordMeta,
        {
            duoReadKind: DuoReadKind.UnaryExpression,
            nodeKind: Ast.NodeKind.MetadataExpression,
            operatorTokenKind: TokenKind.KeywordMeta,
            operatorConstantKind: Constant.KeywordConstant.Meta,
        },
    ],
    [
        TokenKind.NullCoalescingOperator,
        {
            duoReadKind: DuoReadKind.LogicalExpression,
            nodeKind: Ast.NodeKind.NullCoalescingExpression,
            operatorTokenKind: TokenKind.NullCoalescingOperator,
            operatorConstantKind: Constant.MiscConstant.NullCoalescingOperator,
        },
    ],
]);

interface ReadAttempt {
    readonly operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>;
    readonly operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>;
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
        _ => index,
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
        _ => index,
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
        _ => index,
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
        _ => index,
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
        _ => index,
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
        _ => index,
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
// In short, it takes a collection of N operators and N+1 operands and merges as many as it can into new Ast nodes of type Node.
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

function combineOperatorsAndOperands(
    state: ParseState,
    parser: Parser,
    placeholderContextNodeId: number,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>,
    correlationId: number,
): Ast.TBinOpExpression {
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
                {
                    const readAttempt = combineEqualityExpressionAndBelow(
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
                {
                    const readAttempt = combineLogicalAndExpression(
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
                {
                    const readAttempt = combineLogicalOrExpression(
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
                {
                    const readAttempt = combineAsExpression(
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
                {
                    const readAttempt = combineIsExpression(
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
                {
                    const readAttempt = combineMetadataExpression(
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
                {
                    const readAttempt = combineNullCoalescingExpression(
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

    trace.exit();

    throw new Error(`Not Implemented`);
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

async function readBinOpExpression(
    state: ParseState,
    parser: Parser,
    nodeKind: Ast.NodeKind,
    correlationId: number | undefined,
): Promise<Ast.TNode> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        readBinOpExpression.name,
        correlationId,
    );

    const placeholderContextNodeId: number = ParseStateUtils.startContext(state, nodeKind).id;
    const initialUnaryExpression: Ast.TUnaryExpression = await parser.readUnaryExpression(state, parser, trace.id);
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;

    const operatorConstants: Ast.TBinOpExpressionConstant[] = [];
    const operands: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [];
    let nextDuoRead: TNextDuoRead | undefined = NextDuoReadByTokenKind.get(state.currentTokenKind);

    while (nextDuoRead) {
        const iterativeParseContext: ParseContext.Node<Ast.TNode> = ParseStateUtils.startContext(
            state,
            nextDuoRead.nodeKind,
        );

        iterativeParseContext.attributeCounter = 1;

        const operatorConstant: Ast.TBinOpExpressionConstant =
            NaiveParseSteps.readTokenKindAsConstant<Constant.TBinOpExpressionOperator>(
                state,
                nextDuoRead.operatorTokenKind,
                nextDuoRead.operatorConstantKind,
                trace.id,
            );

        let operand: Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType;

        switch (nextDuoRead.duoReadKind) {
            case DuoReadKind.UnaryExpression: {
                // eslint-disable-next-line no-await-in-loop
                operand = await parser.readUnaryExpression(state, parser, trace.id);

                break;
            }

            case DuoReadKind.NullablePrimitiveType:
                // eslint-disable-next-line no-await-in-loop
                operand = await parser.readNullablePrimitiveType(state, parser, trace.id);

                break;

            case DuoReadKind.LogicalExpression:
                // eslint-disable-next-line no-await-in-loop
                operand = await parser.readLogicalExpression(state, parser, trace.id);

                break;

            default:
                throw Assert.isNever(nextDuoRead);
        }

        operatorConstants.push(operatorConstant);
        operands.push(operand);

        for (const nodeId of [operand.id, operatorConstant.id, iterativeParseContext.id]) {
            nodeIdMapCollection.astNodeById.delete(nodeId);
            nodeIdMapCollection.parentIdById.delete(nodeId);
            nodeIdMapCollection.childIdsById.delete(nodeId);
            nodeIdMapCollection.leafIds.delete(nodeId);
        }

        MapUtils.assertGet(nodeIdMapCollection.idsByNodeKind, iterativeParseContext.kind).delete(
            iterativeParseContext.id,
        );

        MapUtils.assertGet(nodeIdMapCollection.idsByNodeKind, operand.kind).delete(operand.id);

        MapUtils.assertGet(nodeIdMapCollection.idsByNodeKind, Ast.NodeKind.Constant).delete(operatorConstant.id);

        nextDuoRead = NextDuoReadByTokenKind.get(state.currentTokenKind);
    }

    Assert.isTrue(
        state.currentContextNode?.id === placeholderContextNodeId,
        `state.currentContextNode.id !== placeholderContextNodeId`,
        {
            currentContextNodeId: state.currentContextNode?.id,
            placeholderContextId: placeholderContextNodeId,
        },
    );

    Assert.isTrue(operatorConstants.length === operands.length, `operators.length !== operands.length`, {
        operatorsLength: operatorConstants.length,
        operandsLength: operands.length,
    });

    let result: Ast.TNode;

    if (!operatorConstants.length) {
        ParseStateUtils.deleteContext(state, placeholderContextNodeId);

        result = initialUnaryExpression;
    } else {
        result = combineOperatorsAndOperands(
            state,
            parser,
            placeholderContextNodeId,
            [initialUnaryExpression, ...operands],
            operatorConstants,
            trace.id,
        );
    }

    trace.exit();

    return result;
}

async function readUnaryExpression(
    state: ParseState,
    parser: Parser,
    correlationId: number | undefined,
): Promise<Ast.TUnaryExpression> {
    const trace: Trace = state.traceManager.entry(
        CombinatorialParserV2TraceConstant.CombinatorialParseV2,
        readUnaryExpression.name,
        correlationId,
    );

    state.cancellationToken?.throwIfCancelled();

    let primaryExpression: Ast.TPrimaryExpression | undefined;

    // LL(1)
    switch (state.currentTokenKind) {
        // PrimaryExpression
        case Token.TokenKind.AtSign:
        case Token.TokenKind.Identifier:
            primaryExpression = NaiveParseSteps.readIdentifierExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.LeftParenthesis:
            primaryExpression = await NaiveParseSteps.readParenthesizedExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.LeftBracket:
            primaryExpression = await DisambiguationUtils.readAmbiguousBracket(
                state,
                parser,
                [
                    Disambiguation.BracketDisambiguation.RecordExpression,
                    Disambiguation.BracketDisambiguation.FieldSelection,
                    Disambiguation.BracketDisambiguation.FieldProjection,
                ],
                trace.id,
            );

            break;

        case Token.TokenKind.LeftBrace:
            primaryExpression = await NaiveParseSteps.readListExpression(state, parser, trace.id);
            break;

        case Token.TokenKind.Ellipsis:
            primaryExpression = NaiveParseSteps.readNotImplementedExpression(state, parser, trace.id);
            break;

        // LiteralExpression
        case Token.TokenKind.HexLiteral:
        case Token.TokenKind.KeywordFalse:
        case Token.TokenKind.KeywordTrue:
        case Token.TokenKind.NumericLiteral:
        case Token.TokenKind.NullLiteral:
        case Token.TokenKind.TextLiteral:
            trace.exit();

            return NaiveParseSteps.readLiteralExpression(state, parser, trace.id);

        // TypeExpression
        case Token.TokenKind.KeywordType:
            trace.exit();

            return NaiveParseSteps.readTypeExpression(state, parser, trace.id);

        case Token.TokenKind.KeywordHashSections:
        case Token.TokenKind.KeywordHashShared:
        case Token.TokenKind.KeywordHashBinary:
        case Token.TokenKind.KeywordHashDate:
        case Token.TokenKind.KeywordHashDateTime:
        case Token.TokenKind.KeywordHashDateTimeZone:
        case Token.TokenKind.KeywordHashDuration:
        case Token.TokenKind.KeywordHashTable:
        case Token.TokenKind.KeywordHashTime:
            primaryExpression = parser.readKeyword(state, parser, trace.id);
            break;

        // Let Naive throw an error.
        default:
            trace.exit();

            return NaiveParseSteps.readUnaryExpression(state, parser, trace.id);
    }

    if (ParseStateUtils.isRecursivePrimaryExpressionNext(state, state.tokenIndex)) {
        trace.exit();

        return parser.readRecursivePrimaryExpression(state, parser, primaryExpression, trace.id);
    } else {
        trace.exit();

        return primaryExpression;
    }
}

function removeNodeKindFromCollection(state: ParseState, nodeKind: Ast.NodeKind, nodeId: number): void {
    const idsByNodeKind: Map<Ast.NodeKind, Set<number>> = state.contextState.nodeIdMapCollection.idsByNodeKind;

    const collection: Set<number> = MapUtils.assertGet(idsByNodeKind, nodeKind);
    SetUtils.assertDelete(collection, nodeId);

    if (collection.size === 0) {
        idsByNodeKind.delete(nodeKind);
    }
}
