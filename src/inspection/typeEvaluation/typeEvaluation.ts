// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TypesUtils } from ".";
import { CommonError } from "../../common";
import { Ast, AstUtils, NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../parser";
import { TypeKind } from "./types";

type EvaluationCache = Map<number, TypeKind>;

export function evaluate(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    cache: EvaluationCache,
): TypeKind {
    const maybeCached: TypeKind | undefined = cache.get(xorNode.node.id);
    if (maybeCached !== undefined) {
        return maybeCached;
    }

    let result: TypeKind;
    switch (xorNode.node.kind) {
        case Ast.NodeKind.LiteralExpression:
            result =
                xorNode.kind === XorNodeKind.Ast
                    ? TypesUtils.extendedTypeKindFrom((xorNode.node as Ast.LiteralExpression).literalKind)
                    : TypeKind.Unknown;
            break;

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = evaluateBinOpExpression(nodeIdMapCollection, xorNode, cache);
            break;

        default:
            result = TypeKind.Unknown;
    }

    cache.set(xorNode.node.id, result);
    return result;
}

function evaluateBinOpExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    cache: EvaluationCache,
): TypeKind {
    if (!AstUtils.isTBinOpExpressionKind(xorNode.node.kind)) {
        const details: {} = {
            nodeId: xorNode.node.id,
            nodeKind: xorNode.node.kind,
        };
        throw new CommonError.InvariantError("expected xorNode to be TBinOpExpression", details);
    }

    const parentId: number = xorNode.node.id;
    const children: ReadonlyArray<TXorNode> = NodeIdMapUtils.expectXorChildren(nodeIdMapCollection, parentId);

    if (children.length < 3) {
        return TypeKind.Unknown;
    }

    const left: TXorNode = children[0];
    const operatorKind: Ast.TBinOpExpressionOperator = (children[1].node as Ast.IConstant<Ast.TBinOpExpressionOperator>)
        .constantKind;
    const right: TXorNode = children[2];

    const leftTypeKind: TypeKind = evaluate(nodeIdMapCollection, left, cache);
    const rightTypeKind: TypeKind = evaluate(nodeIdMapCollection, right, cache);

    const key: string = binOpExpressionLookupKey(leftTypeKind, operatorKind, rightTypeKind);
    return BinOpExpressionLookup.get(key) || TypeKind.Error;
}

const BinOpExpressionLookup: Map<string, TypeKind> = new Map([
    ...createLookupsForRelational(TypeKind.Null),
    ...createLookupsForEquality(TypeKind.Null),

    ...createLookupsForRelational(TypeKind.Logical),
    ...createLookupsForEquality(TypeKind.Logical),
    ...createLookupsForLogical(TypeKind.Logical),

    ...createLookupsForRelational(TypeKind.Numeric),
    ...createLookupsForEquality(TypeKind.Numeric),
    ...createLookupsForArithmetic(TypeKind.Numeric),

    ...createLookupsForRelational(TypeKind.Time),
    ...createLookupsForEquality(TypeKind.Time),
    ...createLookupsForClockKind(TypeKind.Time),
    [binOpExpressionLookupKey(TypeKind.Date, Ast.ArithmeticOperatorKind.And, TypeKind.Time), TypeKind.DateTime],

    ...createLookupsForRelational(TypeKind.Date),
    ...createLookupsForEquality(TypeKind.Date),
    ...createLookupsForClockKind(TypeKind.Date),
    [binOpExpressionLookupKey(TypeKind.Date, Ast.ArithmeticOperatorKind.And, TypeKind.Time), TypeKind.DateTime],

    ...createLookupsForRelational(TypeKind.DateTime),
    ...createLookupsForEquality(TypeKind.DateTime),
    ...createLookupsForClockKind(TypeKind.DateTime),

    ...createLookupsForRelational(TypeKind.DateTimeZone),
    ...createLookupsForEquality(TypeKind.DateTimeZone),
    ...createLookupsForClockKind(TypeKind.DateTimeZone),

    ...createLookupsForRelational(TypeKind.Duration),
    ...createLookupsForEquality(TypeKind.Duration),
    [
        binOpExpressionLookupKey(TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, TypeKind.Duration),
        TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(TypeKind.Duration, Ast.ArithmeticOperatorKind.Subtraction, TypeKind.Duration),
        TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(TypeKind.Duration, Ast.ArithmeticOperatorKind.Multiplication, TypeKind.Numeric),
        TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(TypeKind.Numeric, Ast.ArithmeticOperatorKind.Multiplication, TypeKind.Duration),
        TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(TypeKind.Duration, Ast.ArithmeticOperatorKind.Division, TypeKind.Numeric),
        TypeKind.Duration,
    ],

    ...createLookupsForRelational(TypeKind.Text),
    ...createLookupsForEquality(TypeKind.Text),
    [binOpExpressionLookupKey(TypeKind.Text, Ast.ArithmeticOperatorKind.And, TypeKind.Text), TypeKind.Text],

    ...createLookupsForRelational(TypeKind.Binary),
    ...createLookupsForEquality(TypeKind.Binary),

    ...createLookupsForEquality(TypeKind.List),
    [binOpExpressionLookupKey(TypeKind.List, Ast.ArithmeticOperatorKind.And, TypeKind.List), TypeKind.List],

    ...createLookupsForEquality(TypeKind.Record),
    [binOpExpressionLookupKey(TypeKind.Record, Ast.ArithmeticOperatorKind.And, TypeKind.Record), TypeKind.Record],

    ...createLookupsForEquality(TypeKind.Table),
    [binOpExpressionLookupKey(TypeKind.Table, Ast.ArithmeticOperatorKind.And, TypeKind.Table), TypeKind.Table],
]);

const UnaryExpressionLookup: Map<string, TypeKind> = new Map([
    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Not, TypeKind.Logical), TypeKind.Logical],

    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Negative, TypeKind.Numeric), TypeKind.Numeric],
    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Positive, TypeKind.Numeric), TypeKind.Numeric],
]);

function binOpExpressionLookupKey(
    leftTypeKind: TypeKind,
    operatorKind: Ast.TBinOpExpressionOperator,
    rightTypeKind: TypeKind,
): string {
    return `${leftTypeKind},${operatorKind},${rightTypeKind}`;
}

function unaryOpExpressionLookupKey(operatorKind: Ast.UnaryOperatorKind, typeKind: TypeKind): string {
    return `${operatorKind},${typeKind}`;
}

function createLookupsForRelational(typeKind: TypeKind): ReadonlyArray<[string, TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThan, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThanEqualTo, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThan, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThanEqualTo, typeKind), typeKind],
    ];
}

function createLookupsForEquality(typeKind: TypeKind): ReadonlyArray<[string, TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.EqualTo, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.NotEqualTo, typeKind), typeKind],
    ];
}

// Note: does not include the "and" operator.
function createLookupsForArithmetic(typeKind: TypeKind): ReadonlyArray<[string, TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Division, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Multiplication, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), typeKind],
    ];
}

function createLookupsForLogical(typeKind: TypeKind): ReadonlyArray<[string, TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.LogicalOperatorKind.And, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.LogicalOperatorKind.Or, typeKind), typeKind],
    ];
}

function createLookupsForClockKind(
    typeKind: TypeKind.Date | TypeKind.DateTime | TypeKind.DateTimeZone | TypeKind.Time,
): ReadonlyArray<[string, TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, TypeKind.Duration), typeKind],
        [binOpExpressionLookupKey(TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, TypeKind.Duration), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), TypeKind.Duration],
    ];
}
