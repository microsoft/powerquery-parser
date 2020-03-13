// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever } from "../../common";
import { Ast, AstUtils, NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../parser";
import { Type, TypeUtils } from "../../type";
import { stringify } from "querystring";

export type EvaluationCache = Map<number, Type.TType>;

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
                    const typeKind: Exclude<Type.TypeKind, Type.TExtendedTypeKind> = TypeUtils.typeKindFromLiteralKind(
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

        case Ast.NodeKind.AsExpression: {
            result = evaluateByChildAttributeIndex(nodeIdMapCollection, cache, xorNode, 2);
            break;
        }

        case Ast.NodeKind.AsNullablePrimitiveType:
            result = evaluateByChildAttributeIndex(nodeIdMapCollection, cache, xorNode, 1);
            break;

        case Ast.NodeKind.Constant:
            result = evaluateConstant(xorNode);
            break;

        case Ast.NodeKind.Csv:
            result = evaluateByChildAttributeIndex(nodeIdMapCollection, cache, xorNode, 1);
            break;

        case Ast.NodeKind.EachExpression:
            result = genericEachFactory(evaluateByChildAttributeIndex(nodeIdMapCollection, cache, xorNode, 1));
            break;

        default:
            result = unknownFactory();
    }

    cache.set(xorNode.node.id, result);
    return result;
}

function genericFactory(typeKind: Exclude<Type.TypeKind, Type.TExtendedTypeKind>): Type.TType {
    return {
        kind: typeKind,
        isNullable: false,
    };
}

function genericEachFactory(subexpression: Type.TType): Type.EachFunctionExpressionType {
    return {
        kind: Type.TypeKind.Function,
        isEach: true,
        isNullable: false,
        isReturnNullable: subexpression.isNullable,
        returnType: subexpression.kind,
    };
}

function genericRecordFactory(isNullable: boolean): Type.RecordType {
    return {
        kind: Type.TypeKind.Record,
        isCustom: false,
        isNullable,
    };
}

function genericTableFactory(isNullable: boolean): Type.TableType {
    return {
        kind: Type.TypeKind.Table,
        isCustom: false,
        isNullable,
    };
}

function unknownFactory(isNullable: boolean): Type.TType {
    return {
        kind: Type.TypeKind.Unknown,
        isNullable,
    };
}

function noneFactory(isNullable: boolean): Type.TType {
    return {
        kind: Type.TypeKind.None,
        isNullable,
    };
}

function evaluateByChildAttributeIndex(
    nodeIdMapCollection: NodeIdMap.Collection,
    cache: EvaluationCache,
    parentXorNode: TXorNode,
    attributeIndex: number,
): Type.TType {
    const maybeXorNode: TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
        undefined,
    );
    return maybeXorNode !== undefined ? evaluate(nodeIdMapCollection, maybeXorNode, cache) : unknownFactory();
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

    const maybeLeft: undefined | TXorNode = children[0];
    const maybeOperatorKind: undefined | Ast.TBinOpExpressionOperator =
        children[1] === undefined || children[1].kind === XorNodeKind.Context
            ? undefined
            : (children[1].node as Ast.IConstant<Ast.TBinOpExpressionOperator>).constantKind;
    const maybeRight: undefined | TXorNode = children[2];

    // '1'
    if (maybeLeft !== undefined) {
        if (maybeOperatorKind === undefined) {
            return evaluate(nodeIdMapCollection, maybeLeft, cache);
        } else if (maybeRight === undefined || maybeRight.kind === XorNodeKind.Context) {
            const leftType: Type.TType = evaluate(nodeIdMapCollection, maybeLeft, cache);
            const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;

            const partialLookupKey: string = binOpExpressionPartialLookupKey(leftType.kind, operatorKind);
            const maybeAllowedTypeKinds: undefined | ReadonlyArray<Type.TypeKind> = BinOpExpressionPartialLookup.get(
                partialLookupKey,
            );
            if (maybeAllowedTypeKinds === undefined) {
                return unknownFactory(true);
            } else if (maybeAllowedTypeKinds.length === 1) {
                return;
            }
        }
    } else {
        return unknownFactory(true);
    }

    // '1 +'
    if (children.length === 3 && children[2].kind === XorNodeKind.Context) {
        const leftType: Type.TType = evaluate(nodeIdMapCollection, children[0], cache);
        const operatorKind: Ast.TBinOpExpressionOperator = (children[1].node as Ast.IConstant<
            Ast.TBinOpExpressionOperator
        >).constantKind;
    }

    // '1'
    if (children.length === 1) {
        return evaluateByChildAttributeIndex(nodeIdMapCollection, cache, xorNode, 0);
    }
    // '1 +'
    else if (children.length === 2) {
    }

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
        return noneFactory();
    }
    const resultTypeKind: Type.TypeKind = maybeResultTypeKind;

    if (isRecordKindOrTableKind(resultTypeKind)) {
        if (!isRecordOrTable(leftType) || !isRecordOrTable(rightType)) {
            const details: {} = {
                resultTypeKind,
                leftTypeKind: leftType.kind,
                rightTypeKind: rightType.kind,
            };
            throw new CommonError.InvariantError(
                `${evaluateBinOpExpression.name}: resultTypeKind should only be a custom TypeKind if both left and right are custom TypeKind`,
                details,
            );
        } else if (leftType.kind !== rightType.kind) {
            const details: {} = {
                leftTypeKind: leftType.kind,
                rightTypeKind: rightType.kind,
            };
            throw new CommonError.InvariantError(
                `${evaluateBinOpExpression.name}: left and right should only be either two records or two tables`,
                details,
            );
        } else {
            return evaluateBinOpExpressionForCustomType(leftType, rightType);
        }
    } else if (resultTypeKind === Type.TypeKind.Function) {
        throw new CommonError.InvariantError(`${evaluateBinOpExpression}: this should never be reached`);
    } else {
        return genericFactory(resultTypeKind);
    }
}

function evaluateConstant(xorNode: TXorNode): Type.TType {
    if (xorNode.kind === XorNodeKind.Context) {
        return unknownFactory();
    } else if (xorNode.node.kind !== Ast.NodeKind.Constant) {
        const details: {} = {
            nodeId: xorNode.node.id,
            nodeKind: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(
            `${evaluateConstant.name}: expected xorNode to be of NodeKind.Constant`,
            details,
        );
    } else {
        const constant: Ast.TConstant = xorNode.node;

        switch (constant.constantKind) {
            case Ast.PrimitiveTypeConstantKind.Action:
                return genericFactory(Type.TypeKind.Action);
            case Ast.PrimitiveTypeConstantKind.Any:
                return genericFactory(Type.TypeKind.Any);
            case Ast.PrimitiveTypeConstantKind.AnyNonNull:
                return genericFactory(Type.TypeKind.AnyNonNull);
            case Ast.PrimitiveTypeConstantKind.Binary:
                return genericFactory(Type.TypeKind.Binary);
            case Ast.PrimitiveTypeConstantKind.Date:
                return genericFactory(Type.TypeKind.Date);
            case Ast.PrimitiveTypeConstantKind.DateTime:
                return genericFactory(Type.TypeKind.DateTime);
            case Ast.PrimitiveTypeConstantKind.DateTimeZone:
                return genericFactory(Type.TypeKind.DateTimeZone);
            case Ast.PrimitiveTypeConstantKind.Duration:
                return genericFactory(Type.TypeKind.Duration);

            // case Ast.PrimitiveTypeConstantKind.Function:
            //     return genericEachFactory();

            case Ast.PrimitiveTypeConstantKind.List:
                return genericFactory(Type.TypeKind.List);
            case Ast.PrimitiveTypeConstantKind.Logical:
                return genericFactory(Type.TypeKind.Logical);
            case Ast.PrimitiveTypeConstantKind.None:
                return genericFactory(Type.TypeKind.None);
            case Ast.PrimitiveTypeConstantKind.Null:
                return genericFactory(Type.TypeKind.Null);
            case Ast.PrimitiveTypeConstantKind.Number:
                return genericFactory(Type.TypeKind.Number);
            case Ast.PrimitiveTypeConstantKind.Record:
                return genericRecordFactory();
            case Ast.PrimitiveTypeConstantKind.Table:
                return genericTableFactory();
            case Ast.PrimitiveTypeConstantKind.Text:
                return genericFactory(Type.TypeKind.Text);
            case Ast.PrimitiveTypeConstantKind.Time:
                return genericFactory(Type.TypeKind.Time);
            case Ast.PrimitiveTypeConstantKind.Type:
                return genericFactory(Type.TypeKind.Type);

            default:
                return unknownFactory();
        }
    }
}

const BinOpExpressionLookup: ReadonlyMap<string, Type.TypeKind> = new Map([
    ...createLookupsForRelational(Type.TypeKind.Null),
    ...createLookupsForEquality(Type.TypeKind.Null),

    ...createLookupsForRelational(Type.TypeKind.Logical),
    ...createLookupsForEquality(Type.TypeKind.Logical),
    ...createLookupsForLogical(Type.TypeKind.Logical),

    ...createLookupsForRelational(Type.TypeKind.Number),
    ...createLookupsForEquality(Type.TypeKind.Number),
    ...createLookupsForArithmetic(Type.TypeKind.Number),

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
            Type.TypeKind.Number,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(
            Type.TypeKind.Number,
            Ast.ArithmeticOperatorKind.Multiplication,
            Type.TypeKind.Duration,
        ),
        Type.TypeKind.Duration,
    ],
    [
        binOpExpressionLookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Division, Type.TypeKind.Number),
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

const binOpExpressionPartialLookup: Map<string, Type.TypeKind[]> = new Map();
for (const key of BinOpExpressionLookup.keys()) {
    const lastDeliminatorIndex: number = key.lastIndexOf(",");
    const partialKey: string = key.slice(0, lastDeliminatorIndex);
    const potentialNewValue: Type.TypeKind = key.slice(lastDeliminatorIndex + 1) as Type.TypeKind;
    const values: Type.TypeKind[] = binOpExpressionPartialLookup.get(partialKey) || [];

    if (values.indexOf(potentialNewValue) === -1) {
        values.push(potentialNewValue);
    }
}
const BinOpExpressionPartialLookup: ReadonlyMap<string, ReadonlyArray<Type.TypeKind>> = binOpExpressionPartialLookup;

const UnaryExpressionLookup: Map<string, Type.TypeKind> = new Map([
    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Not, Type.TypeKind.Logical), Type.TypeKind.Logical],

    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Negative, Type.TypeKind.Number), Type.TypeKind.Number],
    [unaryOpExpressionLookupKey(Ast.UnaryOperatorKind.Positive, Type.TypeKind.Number), Type.TypeKind.Number],
]);

function binOpExpressionPartialLookupKey(
    leftTypeKind: Type.TypeKind,
    operatorKind: Ast.TBinOpExpressionOperator,
): string {
    return `${leftTypeKind},${operatorKind}`;
}

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

function isCustomType(pqType: Type.TType): pqType is Type.TExtendedType {
    return isCustomTypeKind(pqType.kind);
}

function isCustomTypeKind(typeKind: Type.TypeKind): typeKind is Type.TypeKind.Record | Type.TypeKind.Table {
    return typeKind === Type.TypeKind.Record || typeKind === Type.TypeKind.Table || typeKind === Type.TypeKind.Function;
}

function isRecordOrTable(pqType: Type.TType): pqType is Type.TRecordType | Type.TTableType {
    return isRecordKindOrTableKind(pqType.kind);
}

function isRecordKindOrTableKind(typeKind: Type.TypeKind): typeKind is Type.TypeKind.Record | Type.TypeKind.Table {
    return typeKind === Type.TypeKind.Record || typeKind === Type.TypeKind.Table;
}
