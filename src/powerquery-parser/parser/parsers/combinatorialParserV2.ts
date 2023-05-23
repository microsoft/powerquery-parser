// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils } from "../../common";
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

type TNextDuoRead = NextDuoReadLogicalExpression | NextDuoReadNullablePrimitiveType | NextDuoReadUnaryExpression;

const enum DuoReadKind {
    LogicalExpression = Ast.NodeKind.LogicalExpression,
    NullablePrimitiveType = Ast.NodeKind.NullablePrimitiveType,
    UnaryExpression = Ast.NodeKind.UnaryExpression,
}

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

const NodeKindByOperatorConstantKind: Map<Constant.TBinOpExpressionOperator, Ast.TBinOpExpressionNodeKind> = new Map<
    Constant.TBinOpExpressionOperator,
    Ast.TBinOpExpressionNodeKind
>([
    [Constant.ArithmeticOperator.Multiplication, Ast.NodeKind.ArithmeticExpression],
    [Constant.ArithmeticOperator.Division, Ast.NodeKind.ArithmeticExpression],
    [Constant.ArithmeticOperator.Addition, Ast.NodeKind.ArithmeticExpression],
    [Constant.ArithmeticOperator.Subtraction, Ast.NodeKind.ArithmeticExpression],
    [Constant.ArithmeticOperator.And, Ast.NodeKind.ArithmeticExpression],
    [Constant.EqualityOperator.EqualTo, Ast.NodeKind.EqualityExpression],
    [Constant.EqualityOperator.NotEqualTo, Ast.NodeKind.EqualityExpression],
    [Constant.LogicalOperator.And, Ast.NodeKind.LogicalExpression],
    [Constant.LogicalOperator.Or, Ast.NodeKind.LogicalExpression],
    [Constant.RelationalOperator.LessThan, Ast.NodeKind.RelationalExpression],
    [Constant.RelationalOperator.LessThanEqualTo, Ast.NodeKind.RelationalExpression],
    [Constant.RelationalOperator.GreaterThan, Ast.NodeKind.RelationalExpression],
    [Constant.RelationalOperator.GreaterThanEqualTo, Ast.NodeKind.RelationalExpression],
    [Constant.KeywordConstant.As, Ast.NodeKind.AsExpression],
    [Constant.KeywordConstant.Is, Ast.NodeKind.IsExpression],
    [Constant.KeywordConstant.Meta, Ast.NodeKind.MetadataExpression],
    [Constant.MiscConstant.NullCoalescingOperator, Ast.NodeKind.NullCoalescingExpression],
]);

interface ReadAttempt {
    readonly operatorConstants: ReadonlyArray<Ast.IConstant<Constant.TBinOpExpressionOperator>>;
    readonly operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>;
}

function assertIsBinOpExprConstantKind<T extends Constant.TBinOpExpressionOperator>(
    operatorConstant: Ast.TConstant,
    expectedConstantKind: T,
): asserts operatorConstant is Ast.IConstant<T> {
    if (!isBinOpExprConstantKind<T>(operatorConstant, expectedConstantKind)) {
        throw new CommonError.InvariantError(`found unexpected constantKind`, {
            operatorConstantKind: operatorConstant.kind,
            expectedConstantKind,
        });
    }
}

function combineAsExpression(
    state: ParseState,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.IConstant<Constant.TBinOpExpressionOperator>>,
    index: number,
): ReadAttempt {
    return combineAsExpressionOrIsExpression<Ast.AsExpression>(
        state,
        operands,
        operatorConstants,
        index,
        Ast.NodeKind.AsExpression,
        Constant.KeywordConstant.As,
        AstUtils.isTUnaryExpression,
    );
}

function combineIsExpression(
    state: ParseState,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.IConstant<Constant.TBinOpExpressionOperator>>,
    index: number,
): ReadAttempt {
    return combineAsExpressionOrIsExpression<Ast.IsExpression>(
        state,
        operands,
        operatorConstants,
        index,
        Ast.NodeKind.IsExpression,
        Constant.KeywordConstant.Is,
        AstUtils.isTUnaryExpression,
    );
}

function combineAsExpressionOrIsExpression<Node extends Ast.AsExpression | Ast.IsExpression>(
    state: ParseState,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.IConstant<Constant.TBinOpExpressionOperator>>,
    index: number,
    nodeKind: Node["kind"],
    expectedOperatorConstant: Node["operatorConstant"]["constantKind"],
    rightValidator: (node: Ast.TNode) => node is Node["right"],
): ReadAttempt {
    const newBinOpExpressionId: number = ParseContextUtils.nextId(state.contextState);

    let left: Ast.TBinOpExpression["left"] = ArrayUtils.assertGet(operands, index) as Ast.TBinOpExpression["left"];
    let operatorConstant: Ast.TConstant = ArrayUtils.assertGet(operatorConstants, index);

    assertIsBinOpExprConstantKind<Node["operatorConstant"]["constantKind"]>(operatorConstant, expectedOperatorConstant);

    while (
        isBinOpExprConstantKind<Node["operatorConstant"]["constantKind"]>(operatorConstant, expectedOperatorConstant)
    ) {
        const right: Ast.TNode = ArrayUtils.assertGet(operands, index + 1);

        if (!rightValidator(right)) {
            // TODO error handling
            throw new Error(`not yet implemented`);
        }

        const leftTokenRange: Token.TokenRange = left.tokenRange;
        const rightTokenRange: Token.TokenRange = right.tokenRange;

        left = {
            kind: nodeKind,
            id: newBinOpExpressionId,
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

        updateBinOpInNodeIdMapCollection(state, left);

        operatorConstants = ArrayUtils.assertRemoveAtIndex(operatorConstants, index);
        operands = [...operands.slice(0, index), left, ...operands.slice(index + 2)];

        operatorConstant = ArrayUtils.assertGet(operatorConstants, index);
    }

    return {
        operatorConstants,
        operands,
    };
}

function combineOperatorsAndOperands(
    state: ParseState,
    operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>,
    operatorConstants: ReadonlyArray<Ast.IConstant<Constant.TBinOpExpressionOperator>>,
): Ast.TBinOpExpression {
    Assert.isTrue(operatorConstants.length === operands.length + 1, `operators.length !== operands.length + 1`, {
        operandsLength: operands.length,
        operatorsLength: operatorConstants.length,
    });

    while (operatorConstants.length) {
        const minOperatorPrecedenceIndex: number = findMinOperatorPrecedenceIndex(operatorConstants);

        const minOperator: Ast.IConstant<Constant.TBinOpExpressionOperator> = ArrayUtils.assertGet(
            operatorConstants,
            minOperatorPrecedenceIndex,
        );

        const nodeKind: Ast.TBinOpExpressionNodeKind = MapUtils.assertGet(
            NodeKindByOperatorConstantKind,
            minOperator.constantKind,
        );

        switch (nodeKind) {
            case Ast.NodeKind.ArithmeticExpression:
            case Ast.NodeKind.EqualityExpression:
            case Ast.NodeKind.LogicalExpression:
            case Ast.NodeKind.RelationalExpression:
                throw new Error(`Not Implemented`);

            case Ast.NodeKind.AsExpression: {
                const readAttempt = combineAsExpression(state, operands, operatorConstants, minOperatorPrecedenceIndex);
                operatorConstants = readAttempt.operatorConstants;
                operands = readAttempt.operands;
                break;
            }

            case Ast.NodeKind.IsExpression: {
                const readAttempt = combineIsExpression(state, operands, operatorConstants, minOperatorPrecedenceIndex);
                operatorConstants = readAttempt.operatorConstants;
                operands = readAttempt.operands;
                break;
            }

            case Ast.NodeKind.MetadataExpression:
                throw new Error(`Not Implemented`);

            case Ast.NodeKind.NullCoalescingExpression:
                throw new Error(`Not Implemented`);

            default:
                throw Assert.isNever(nodeKind);
        }
    }

    throw new Error(`Not Implemented`);
}

function findMinOperatorPrecedenceIndex(
    operators: ReadonlyArray<Ast.IConstant<Constant.TBinOpExpressionOperator>>,
): number {
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

function isBinOpExprConstantKind<T extends Constant.TBinOpExpressionOperator>(
    operatorConstant: Ast.TConstant,
    expectedConstantKind: T,
): operatorConstant is Ast.IConstant<T> {
    return operatorConstant.constantKind === expectedConstantKind;
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

    const placeholderContext: ParseContext.TNode = ParseStateUtils.startContext(state, nodeKind);
    const initialUnaryExpression: Ast.TUnaryExpression = await parser.readUnaryExpression(state, parser, trace.id);
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;

    const operators: Ast.IConstant<Constant.TBinOpExpressionOperator>[] = [];
    const operands: (Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType)[] = [];
    let nextDuoRead: TNextDuoRead | undefined = NextDuoReadByTokenKind.get(state.currentTokenKind);

    while (nextDuoRead) {
        const iterativeParseContext: ParseContext.Node<Ast.TNode> = ParseStateUtils.startContext(
            state,
            nextDuoRead.nodeKind,
        );

        iterativeParseContext.attributeCounter = 1;

        const operatorConstant: Ast.IConstant<Constant.TBinOpExpressionOperator> =
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

        operators.push(operatorConstant);
        operands.push(operand);

        for (const nodeId of [operand.id, operatorConstant.id, iterativeParseContext.id]) {
            nodeIdMapCollection.astNodeById.delete(nodeId);
            nodeIdMapCollection.parentIdById.delete(nodeId);
            nodeIdMapCollection.childIdsById.delete(nodeId);
        }

        nextDuoRead = NextDuoReadByTokenKind.get(state.currentTokenKind);
    }

    Assert.isTrue(
        state.currentContextNode?.id === placeholderContext.id,
        `state.currentContextNode.id !== placeholderContext.id`,
        {
            currentContextNodeId: state.currentContextNode?.id,
            placeholderContextId: placeholderContext.id,
        },
    );

    Assert.isTrue(operators.length === operands.length, `operators.length !== operands.length`, {
        operatorsLength: operators.length,
        operandsLength: operands.length,
    });

    let result: Ast.TNode;

    if (!operators.length) {
        ParseStateUtils.deleteContext(state, placeholderContext.id);

        result = initialUnaryExpression;
    } else {
        result = combineOperatorsAndOperands(state, [initialUnaryExpression, ...operands], operators);
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

function updateBinOpInNodeIdMapCollection(state: ParseState, binOpNode: Ast.TBinOpExpression): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.contextState.nodeIdMapCollection;

    const left: Ast.TBinOpExpression["left"] = binOpNode.left;
    const operatorConstant: Ast.TBinOpExpression["operatorConstant"] = binOpNode.operatorConstant;
    const right: Ast.TBinOpExpression["right"] = binOpNode.right;

    nodeIdMapCollection.astNodeById.set(binOpNode.id, binOpNode);
    nodeIdMapCollection.astNodeById.set(left.id, left);
    nodeIdMapCollection.astNodeById.set(operatorConstant.id, operatorConstant);
    nodeIdMapCollection.astNodeById.set(right.id, right);

    const childIds: ReadonlyArray<number> = [left.id, operatorConstant.id, right.id];

    for (const childId of childIds) {
        nodeIdMapCollection.parentIdById.set(childId, binOpNode.id);
    }

    nodeIdMapCollection.childIdsById.set(binOpNode.id, childIds);
}
