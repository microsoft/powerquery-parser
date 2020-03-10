// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type, TypeUtils } from ".";
import { CommonError, isNever } from "../../common";
import { Ast, AstUtils, NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../parser";

type EvaluationCache = Map<number, Type.TType>;

export function evaluate(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    cache: EvaluationCache,
): Type.TType {
    const maybeCached: Type.TType | undefined = cache.get(xorNode.node.id);
    if (maybeCached !== undefined) {
        return maybeCached;
    }

    let result: Type.TType;
    switch (xorNode.node.kind) {
        case Ast.NodeKind.LiteralExpression: {
            switch (xorNode.kind) {
                case XorNodeKind.Ast:
                    // We already checked it's a Ast Literal Expression.
                    const literalKind: Ast.LiteralKind = (xorNode.node as Ast.LiteralExpression).literalKind;
                    const typeKind: Exclude<Type.TypeKind, Type.TCustomTypeKind> = TypeUtils.extendedTypeKindFrom(
                        literalKind,
                    );
                    result = genericFactory(typeKind);
                    break;

                case XorNodeKind.Context:
                    result = unknownFactory();
                    break;

                default:
                    throw isNever(xorNode);
            }
            break;
        }

        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = evaluateBinOpExpression(nodeIdMapCollection, xorNode, cache);
            break;

        default:
            result = unknownFactory();
    }

    cache.set(xorNode.node.id, result);
    return result;
}

function genericFactory(typeKind: Exclude<Type.TypeKind, Type.TCustomTypeKind>): Type.TType {
    return { kind: typeKind };
}

function unknownFactory(): Type.TType {
    return { kind: Type.TypeKind.Unknown };
}

function errorFactory(): Type.TType {
    return { kind: Type.TypeKind.Error };
}

function evaluateBinOpExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: TXorNode,
    cache: EvaluationCache,
): Type.TType {
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
        return unknownFactory();
    }

    const left: TXorNode = children[0];
    const operatorKind: Ast.TBinOpExpressionOperator = (children[1].node as Ast.IConstant<Ast.TBinOpExpressionOperator>)
        .constantKind;
    const right: TXorNode = children[2];

    const leftType: Type.TType = evaluate(nodeIdMapCollection, left, cache);
    const rightType: Type.TType = evaluate(nodeIdMapCollection, right, cache);

    const key: string = binOpExpressionLookupKey(leftType.kind, operatorKind, rightType.kind);
    const maybeResultTypeKind: undefined | Type.TypeKind = BinOpExpressionLookup.get(key);
    if (maybeResultTypeKind === undefined) {
        return errorFactory();
    }
    const resultTypeKind: Type.TypeKind = maybeResultTypeKind;

    if (isCustomTypeKind(resultTypeKind)) {
        if (!isCustomType(leftType) || !isCustomType(rightType)) {
            const details: {} = {
                resultTypeKind,
                leftTypeKind: leftType.kind,
                rightTypeKind: rightType.kind,
            };
            throw new CommonError.InvariantError(
                "resultTypeKind should only be a custom TypeKind if both left and right are custom TypeKind",
                details,
            );
        } else if (leftType.kind !== rightType.kind) {
            const details: {} = {
                leftTypeKind: leftType.kind,
                rightTypeKind: rightType.kind,
            };
            throw new CommonError.InvariantError(
                "left and right should only be either two records or two tables",
                details,
            );
        } else {
            return evaluateBinOpExpressionForCustomType(leftType, rightType);
        }
    } else {
        return { kind: resultTypeKind };
    }
}

const BinOpExpressionLookup: Map<string, Type.TypeKind> = new Map([
    ...createLookupsForRelational(Type.TypeKind.Null),
    ...createLookupsForEquality(Type.TypeKind.Null),

    ...createLookupsForRelational(Type.TypeKind.Logical),
    ...createLookupsForEquality(Type.TypeKind.Logical),
    ...createLookupsForLogical(Type.TypeKind.Logical),

    ...createLookupsForRelational(Type.TypeKind.Numeric),
    ...createLookupsForEquality(Type.TypeKind.Numeric),
    ...createLookupsForArithmetic(Type.TypeKind.Numeric),

    ...createLookupsForRelational(Type.TypeKind.Time),
    ...createLookupsForEquality(Type.TypeKind.Time),
    ...createLookupsForClockKind(Type.TypeKind.Time),
    [
        binOpExpressionLookupKey(Type.TypeKind.Date, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Time),
        Type.TypeKind.DateTime,
    ],

    ...createLookupsForRelational(Type.TypeKind.Date),
    ...createLookupsForEquality(Type.TypeKind.Date),
    ...createLookupsForClockKind(Type.TypeKind.Date),
    [
        binOpExpressionLookupKey(Type.TypeKind.Date, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Time),
        Type.TypeKind.DateTime,
    ],

    ...createLookupsForRelational(Type.TypeKind.DateTime),
    ...createLookupsForEquality(Type.TypeKind.DateTime),
    ...createLookupsForClockKind(Type.TypeKind.DateTime),

    ...createLookupsForRelational(Type.TypeKind.DateTimeZone),
    ...createLookupsForEquality(Type.TypeKind.DateTimeZone),
    ...createLookupsForClockKind(Type.TypeKind.DateTimeZone),

    ...createLookupsForRelational(Type.TypeKind.Duration),
    ...createLookupsForEquality(Type.TypeKind.Duration),
    [
        binOpExpressionLookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(
            Type.TypeKind.Duration,
            Ast.ArithmeticOperatorKind.Subtraction,
            Type.TypeKind.Duration,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(
            Type.TypeKind.Duration,
            Ast.ArithmeticOperatorKind.Multiplication,
            Type.TypeKind.Numeric,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(
            Type.TypeKind.Numeric,
            Ast.ArithmeticOperatorKind.Multiplication,
            Type.TypeKind.Duration,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Division, Type.TypeKind.Numeric),
        Type.TypeKind.Duration,
    ],

    ...createLookupsForRelational(Type.TypeKind.Text),
    ...createLookupsForEquality(Type.TypeKind.Text),
    [
        binOpExpressionLookupKey(Type.TypeKind.Text, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Text),
        Type.TypeKind.Text,
    ],

    ...createLookupsForRelational(Type.TypeKind.Binary),
    ...createLookupsForEquality(Type.TypeKind.Binary),

    ...createLookupsForEquality(Type.TypeKind.List),
    [
        binOpExpressionLookupKey(Type.TypeKind.List, Ast.ArithmeticOperatorKind.And, Type.TypeKind.List),
        Type.TypeKind.List,
    ],

    ...createLookupsForEquality(Type.TypeKind.Record),
    [
        binOpExpressionLookupKey(Type.TypeKind.Record, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Record),
        Type.TypeKind.Record,
    ],

    ...createLookupsForEquality(Type.TypeKind.Table),
    [
        binOpExpressionLookupKey(Type.TypeKind.Table, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Table),
        Type.TypeKind.Table,
    ],
]);

const UnaryExpressionLookup: Map<string, Type.TypeKind> = new Map([
    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Not, Type.TypeKind.Logical), Type.TypeKind.Logical],

    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Negative, Type.TypeKind.Numeric), Type.TypeKind.Numeric],
    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Positive, Type.TypeKind.Numeric), Type.TypeKind.Numeric],
]);

function binOpExpressionLookupKey(
    leftTypeKind: Type.TypeKind,
    operatorKind: Ast.TBinOpExpressionOperator,
    rightTypeKind: Type.TypeKind,
): string {
    return `${leftTypeKind},${operatorKind},${rightTypeKind}`;
}

function unaryOpExpressionLookupKey(operatorKind: Ast.UnaryOperatorKind, typeKind: Type.TypeKind): string {
    return `${operatorKind},${typeKind}`;
}

function createLookupsForRelational(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThan, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThanEqualTo, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThan, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.RelationalOperatorKind.LessThanEqualTo, typeKind), typeKind],
    ];
}

function createLookupsForEquality(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.EqualTo, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.EqualityOperatorKind.NotEqualTo, typeKind), typeKind],
    ];
}

// Note: does not include the "and" operator.
function createLookupsForArithmetic(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Division, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Multiplication, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), typeKind],
    ];
}

function createLookupsForLogical(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.LogicalOperatorKind.And, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.LogicalOperatorKind.Or, typeKind), typeKind],
    ];
}

function createLookupsForClockKind(
    typeKind: Type.TypeKind.Date | Type.TypeKind.DateTime | Type.TypeKind.DateTimeZone | Type.TypeKind.Time,
): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, Type.TypeKind.Duration), typeKind],
        [binOpExpressionLookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, Type.TypeKind.Duration), typeKind],
        [binOpExpressionLookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), Type.TypeKind.Duration],
    ];
}

function evaluateBinOpExpressionForCustomType(
    leftType: Type.TTableType | Type.TRecordType,
    rightType: Type.TTableType | Type.TRecordType,
): Type.TTableType | Type.TRecordType {
    if (leftType.kind !== rightType.kind) {
        const details: {} = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };
        throw new CommonError.InvariantError("left and right should only be either two records or two tables", details);
    } else if (!leftType.isCustom && !rightType.isCustom) {
        return {
            kind: leftType.kind,
            isCustom: false,
        };
    }

    throw new Error();
}

function isCustomType(pqType: Type.TType): pqType is Type.TRecordType | Type.TTableType {
    return isCustomTypeKind(pqType.kind);
}

function isCustomTypeKind(typeKind: Type.TypeKind): typeKind is Type.TypeKind.Record | Type.TypeKind.Table {
    return typeKind === Type.TypeKind.Record || typeKind === Type.TypeKind.Table;
}
