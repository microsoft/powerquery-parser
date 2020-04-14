// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Result, ResultUtils } from "../common";
import { Ast, AstUtils } from "../language";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeKind } from "../parser";
import { CommonSettings } from "../settings";
import { Type, TypeUtils } from "../type";
import { ScopeItemByKey, ScopeItemKind, TScopeItem } from "./scope";

export type ScopeTypeMap = Map<string, Type.TType>;

export type TriedScopeType = Result<ScopeTypeMap, CommonError.CommonError>;

export function tryScopeType(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    inspectedScope: ScopeItemByKey,
): TriedScopeType {
    return ResultUtils.ensureResult(settings.localizationTemplates, () =>
        inspectScopeType(nodeIdMapCollection, inspectedScope),
    );
}

type ScopeTypeCacheMap = Map<number, Type.TType>;

function inspectScopeType(nodeIdMapCollection: NodeIdMap.Collection, inspectedScope: ScopeItemByKey): ScopeTypeMap {
    // The return object. Only stores [scope key, TType] pairs.
    const scopeTypeMap: ScopeTypeMap = new Map();
    // A temporary working set. Stores all [nodeId, TType] pairs evaluated.
    const scopeTypeCacheMap: ScopeTypeCacheMap = new Map();

    for (const [key, node] of [...inspectedScope.entries()]) {
        scopeTypeMap.set(key, translateScopeItem(nodeIdMapCollection, node, scopeTypeCacheMap));
    }

    return scopeTypeMap;
}

function translateScopeItem(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeItem: TScopeItem,
    scopeTypeMap: ScopeTypeCacheMap,
): Type.TType {
    switch (scopeItem.kind) {
        case ScopeItemKind.Each:
            return translateXorNode(nodeIdMapCollection, scopeTypeMap, scopeItem.eachExpression);

        case ScopeItemKind.KeyValuePair:
            return scopeItem.maybeValue === undefined
                ? anyFactory()
                : translateXorNode(nodeIdMapCollection, scopeTypeMap, scopeItem.maybeValue);

        case ScopeItemKind.Parameter:
            return scopeItem.maybeType === undefined
                ? anyFactory()
                : {
                      kind: TypeUtils.typeKindFromPrimitiveTypeConstantKind(scopeItem.maybeType),
                      maybeExtendedKind: undefined,
                      isNullable: scopeItem.isNullable,
                  };

        case ScopeItemKind.SectionMember:
            return scopeItem.maybeValue === undefined
                ? anyFactory()
                : translateXorNode(nodeIdMapCollection, scopeTypeMap, scopeItem.maybeValue);

        case ScopeItemKind.Undefined:
            return unknownFactory();

        default:
            throw isNever(scopeItem);
    }
}

function translateXorNode(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeTypeMap: ScopeTypeCacheMap,
    xorNode: TXorNode,
): Type.TType {
    const maybeCached: Type.TType | undefined = scopeTypeMap.get(xorNode.node.id);
    if (maybeCached !== undefined) {
        return maybeCached;
    }

    let result: Type.TType;
    switch (xorNode.node.kind) {
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            result = translateBinOpExpression(nodeIdMapCollection, scopeTypeMap, xorNode);
            break;

        case Ast.NodeKind.AsExpression: {
            result = translateFromChildAttributeIndex(nodeIdMapCollection, scopeTypeMap, xorNode, 2);
            break;
        }

        case Ast.NodeKind.AsNullablePrimitiveType:
            result = translateFromChildAttributeIndex(nodeIdMapCollection, scopeTypeMap, xorNode, 1);
            break;

        case Ast.NodeKind.Constant:
            result = translateConstant(xorNode);
            break;

        case Ast.NodeKind.Csv:
            result = translateFromChildAttributeIndex(nodeIdMapCollection, scopeTypeMap, xorNode, 1);
            break;

        case Ast.NodeKind.EachExpression:
            result = translateFromChildAttributeIndex(nodeIdMapCollection, scopeTypeMap, xorNode, 1);
            break;

        case Ast.NodeKind.ListExpression:
            result = genericFactory(Type.TypeKind.List, false);
            break;

        case Ast.NodeKind.LiteralExpression:
            result = translateLiteralExpression(xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
            result = genericFactory(Type.TypeKind.Record, false);
            break;

        case Ast.NodeKind.UnaryExpression:
            result = translateUnaryExpression(nodeIdMapCollection, scopeTypeMap, xorNode);
            break;

        default:
            result = unknownFactory();
    }

    scopeTypeMap.set(xorNode.node.id, result);
    return result;
}

function genericFactory(typeKind: Type.TypeKind, isNullable: boolean): Type.TType {
    return {
        kind: typeKind,
        maybeExtendedKind: undefined,
        isNullable,
    };
}

function anyFactory(): Type.TType {
    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: undefined,
        isNullable: true,
    };
}

function anyUnionFactory(unionedTypePairs: ReadonlyArray<Type.TType>): Type.AnyUnion {
    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: unionedTypePairs.find((ttype: Type.TType) => ttype.isNullable === true) !== undefined,
        unionedTypePairs,
    };
}

function unknownFactory(): Type.TType {
    return {
        kind: Type.TypeKind.Unknown,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

function noneFactory(): Type.TType {
    return {
        kind: Type.TypeKind.None,
        maybeExtendedKind: undefined,
        isNullable: false,
    };
}

function translateFromChildAttributeIndex(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeTypeMap: ScopeTypeCacheMap,
    parentXorNode: TXorNode,
    attributeIndex: number,
): Type.TType {
    const maybeXorNode: TXorNode = NodeIdMapUtils.expectXorChildByAttributeIndex(
        nodeIdMapCollection,
        parentXorNode.node.id,
        attributeIndex,
        undefined,
    );
    return maybeXorNode !== undefined
        ? translateXorNode(nodeIdMapCollection, scopeTypeMap, maybeXorNode)
        : unknownFactory();
}

function translateBinOpExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeTypeMap: ScopeTypeCacheMap,
    xorNode: TXorNode,
): Type.TType {
    if (!AstUtils.isTBinOpExpressionKind(xorNode.node.kind)) {
        const details: {} = {
            nodeId: xorNode.node.id,
            nodeKind: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(`xorNode isn't a TBinOpExpression`, details);
    }

    const parentId: number = xorNode.node.id;
    const children: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectXorChildren(nodeIdMapCollection, parentId);

    const maybeLeft: undefined | TXorNode = children[0];
    const maybeOperatorKind: undefined | Ast.TBinOpExpressionOperator =
        children[1] === undefined || children[1].kind === XorNodeKind.Context
            ? undefined
            : (children[1].node as Ast.IConstant<Ast.TBinOpExpressionOperator>).constantKind;
    const maybeRight: undefined | TXorNode = children[2];

    // ''
    if (maybeLeft === undefined) {
        return unknownFactory();
    }
    // '1'
    else if (maybeOperatorKind === undefined) {
        return translateXorNode(nodeIdMapCollection, scopeTypeMap, maybeLeft);
    }
    // '1 +'
    else if (maybeRight === undefined || maybeRight.kind === XorNodeKind.Context) {
        const leftType: Type.TType = translateXorNode(nodeIdMapCollection, scopeTypeMap, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;

        const partialLookupKey: string = binOpExpressionPartialLookupKey(leftType.kind, operatorKind);
        const maybeAllowedTypeKinds: undefined | ReadonlyArray<Type.TypeKind> = BinOpExpressionPartialLookup.get(
            partialLookupKey,
        );
        if (maybeAllowedTypeKinds === undefined) {
            return noneFactory();
        } else if (maybeAllowedTypeKinds.length === 1) {
            return genericFactory(maybeAllowedTypeKinds[0], leftType.isNullable);
        } else {
            const unionedTypePairs: ReadonlyArray<Type.TType> = maybeAllowedTypeKinds.map((kind: Type.TypeKind) => {
                return {
                    kind,
                    maybeExtendedKind: undefined,
                    isNullable: true,
                };
            });
            return anyUnionFactory(unionedTypePairs);
        }
    }
    // '1 + 1'
    else {
        const leftType: Type.TType = translateXorNode(nodeIdMapCollection, scopeTypeMap, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;
        const rightType: Type.TType = translateXorNode(nodeIdMapCollection, scopeTypeMap, maybeRight);

        const key: string = binOpExpressionLookupKey(leftType.kind, operatorKind, rightType.kind);
        const maybeResultTypeKind: undefined | Type.TypeKind = BinOpExpressionLookup.get(key);
        if (maybeResultTypeKind === undefined) {
            return noneFactory();
        }
        const resultTypeKind: Type.TypeKind = maybeResultTypeKind;

        // '[foo = 1] & [bar = 2]'
        if (
            operatorKind === Ast.ArithmeticOperatorKind.And &&
            (resultTypeKind === Type.TypeKind.Record || resultTypeKind === Type.TypeKind.Table)
        ) {
            return translateTableOrRecordUnion(leftType, rightType);
        } else {
            return genericFactory(resultTypeKind, leftType.isNullable || rightType.isNullable);
        }
    }
}

function translateConstant(xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.Constant,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    } else if (xorNode.kind === XorNodeKind.Context) {
        return unknownFactory();
    }

    const constant: Ast.TConstant = xorNode.node as Ast.TConstant;
    switch (constant.constantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return genericFactory(Type.TypeKind.Action, false);
        case Ast.PrimitiveTypeConstantKind.Any:
            return genericFactory(Type.TypeKind.Any, true);
        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return genericFactory(Type.TypeKind.AnyNonNull, false);
        case Ast.PrimitiveTypeConstantKind.Binary:
            return genericFactory(Type.TypeKind.Binary, false);
        case Ast.PrimitiveTypeConstantKind.Date:
            return genericFactory(Type.TypeKind.Date, false);
        case Ast.PrimitiveTypeConstantKind.DateTime:
            return genericFactory(Type.TypeKind.DateTime, false);
        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return genericFactory(Type.TypeKind.DateTimeZone, false);
        case Ast.PrimitiveTypeConstantKind.Duration:
            return genericFactory(Type.TypeKind.Duration, false);
        case Ast.PrimitiveTypeConstantKind.Function:
            return genericFactory(Type.TypeKind.Function, false);
        case Ast.PrimitiveTypeConstantKind.List:
            return genericFactory(Type.TypeKind.List, false);
        case Ast.PrimitiveTypeConstantKind.Logical:
            return genericFactory(Type.TypeKind.Logical, false);
        case Ast.PrimitiveTypeConstantKind.None:
            return genericFactory(Type.TypeKind.None, false);
        case Ast.PrimitiveTypeConstantKind.Null:
            return genericFactory(Type.TypeKind.Null, true);
        case Ast.PrimitiveTypeConstantKind.Number:
            return genericFactory(Type.TypeKind.Number, false);
        case Ast.PrimitiveTypeConstantKind.Record:
            return genericFactory(Type.TypeKind.Record, false);
        case Ast.PrimitiveTypeConstantKind.Table:
            return genericFactory(Type.TypeKind.Table, false);
        case Ast.PrimitiveTypeConstantKind.Text:
            return genericFactory(Type.TypeKind.Text, false);
        case Ast.PrimitiveTypeConstantKind.Time:
            return genericFactory(Type.TypeKind.Time, false);
        case Ast.PrimitiveTypeConstantKind.Type:
            return genericFactory(Type.TypeKind.Type, false);

        default:
            return unknownFactory();
    }
}

function translateLiteralExpression(xorNode: TXorNode): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.LiteralExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            // We already checked it's a Ast Literal Expression.
            const literalKind: Ast.LiteralKind = (xorNode.node as Ast.LiteralExpression).literalKind;
            const typeKind: Exclude<Type.TypeKind, Type.TExtendedTypeKind> = TypeUtils.typeKindFromLiteralKind(
                literalKind,
            );
            return genericFactory(typeKind, literalKind === Ast.LiteralKind.Null);

        case XorNodeKind.Context:
            return unknownFactory();

        default:
            throw isNever(xorNode);
    }
}

function translateUnaryExpression(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeTypeMap: ScopeTypeCacheMap,
    xorNode: TXorNode,
): Type.TType {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        xorNode,
        Ast.NodeKind.UnaryExpression,
    );
    if (maybeErr !== undefined) {
        throw maybeErr;
    }

    const maybeOperatorsWrapper:
        | undefined
        | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 0, [
        Ast.NodeKind.ArrayWrapper,
    ]);
    if (maybeOperatorsWrapper === undefined) {
        return unknownFactory();
    }

    const maybeExpression: undefined | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeExpression === undefined) {
        return unknownFactory();
    }

    // Only certain operators are allowed depending on the type.
    // Unlike BinOpExpression, it's easier to implement the check without a lookup table.
    let expectedUnaryOperatorKinds: ReadonlyArray<Ast.UnaryOperatorKind>;
    const expressionType: Type.TType = translateXorNode(nodeIdMapCollection, scopeTypeMap, maybeExpression);
    if (expressionType.kind === Type.TypeKind.Number) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Positive, Ast.UnaryOperatorKind.Negative];
    } else if (expressionType.kind === Type.TypeKind.Logical) {
        expectedUnaryOperatorKinds = [Ast.UnaryOperatorKind.Not];
    } else {
        return noneFactory();
    }

    const operators: ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>> = NodeIdMapIterator.maybeAstChildren(
        nodeIdMapCollection,
        maybeOperatorsWrapper.node.id,
    ) as ReadonlyArray<Ast.IConstant<Ast.UnaryOperatorKind>>;
    for (const operator of operators) {
        if (expectedUnaryOperatorKinds.indexOf(operator.constantKind) === -1) {
            return noneFactory();
        }
    }

    return expressionType;
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

// Creates a lookup of what types are accepted in a BinOpExpression which hasn't parsed its second operand.
// Eg. '1 + ' and 'true and '
//
// Created by processing BinOpExpressionLookup's keys, which are in the form of:
// <first operand> , <operator> , <second operand>
// The partial lookup key is the first two components (first operand, operator),
// and the value is the set of (second operand).
const BinOpExpressionPartialLookup: ReadonlyMap<string, ReadonlyArray<Type.TypeKind>> = new Map(
    // Grab the keys
    [...BinOpExpressionLookup.keys()]
        .reduce(
            (
                binaryExpressionPartialLookup: Map<string, ReadonlyArray<Type.TypeKind>>,
                key: string,
                _currentIndex,
                _array,
            ): Map<string, ReadonlyArray<Type.TypeKind>> => {
                const lastDeliminatorIndex: number = key.lastIndexOf(",");
                // Grab '<first operand> , <operator>'.
                const partialKey: string = key.slice(0, lastDeliminatorIndex);
                // Grab '<second operand>'.
                const potentialNewValue: Type.TypeKind = key.slice(lastDeliminatorIndex + 1) as Type.TypeKind;

                // Add the potentialNewValue if it's a new type.
                const maybeValues: undefined | ReadonlyArray<Type.TypeKind> = binaryExpressionPartialLookup.get(
                    partialKey,
                );
                if (maybeValues === undefined) {
                    binaryExpressionPartialLookup.set(partialKey, [potentialNewValue]);
                } else if (maybeValues.indexOf(potentialNewValue) !== -1) {
                    binaryExpressionPartialLookup.set(partialKey, [...maybeValues, potentialNewValue]);
                }

                return binaryExpressionPartialLookup;
            },
            new Map(),
        )
        .entries(),
);

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

function translateTableOrRecordUnion(leftType: Type.TType, rightType: Type.TType): Type.TType {
    if (leftType.kind !== rightType.kind) {
        const details: {} = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };
        throw new CommonError.InvariantError(`leftType.kind !== rightType.kind`, details);
    }
    // '[] & []'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind === undefined) {
        return genericFactory(leftType.kind, leftType.isNullable || rightType.isNullable);
    }
    // '[key=value] & []'
    else if (leftType.maybeExtendedKind !== undefined && rightType.maybeExtendedKind === undefined) {
        return leftType;
    }
    // '[] & [key=value]'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind !== undefined) {
        return rightType;
    } else {
        throw new Error("TODO");
    }
}
