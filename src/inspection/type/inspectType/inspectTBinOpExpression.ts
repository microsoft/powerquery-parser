// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError } from "../../../common";
import { Ast, AstUtils } from "../../../language";
import { NodeIdMapIterator, TXorNode, XorNodeKind } from "../../../parser";
import { Type, TypeUtils } from "../../../type";
import { inspectXorNode, TypeInspectionState } from "./common";

type TRecordOrTable = Type.Record | Type.Table | Type.DefinedRecord | Type.DefinedTable;

export function inspectTBinOpExpression(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    Assert.isTrue(AstUtils.isTBinOpExpressionKind(xorNode.node.kind), `xorNode isn't a TBinOpExpression`, {
        nodeId: xorNode.node.id,
        nodeKind: xorNode.node.kind,
    });

    const parentId: number = xorNode.node.id;
    const children: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectXorChildren(state.nodeIdMapCollection, parentId);

    const maybeLeft: TXorNode | undefined = children[0];
    const maybeOperatorKind: Ast.TBinOpExpressionOperator | undefined =
        children[1] === undefined || children[1].kind === XorNodeKind.Context
            ? undefined
            : (children[1].node as Ast.IConstant<Ast.TBinOpExpressionOperator>).constantKind;
    const maybeRight: TXorNode | undefined = children[2];

    // ''
    if (maybeLeft === undefined) {
        return Type.UnknownInstance;
    }
    // '1'
    else if (maybeOperatorKind === undefined) {
        return inspectXorNode(state, maybeLeft);
    }
    // '1 +'
    else if (maybeRight === undefined || maybeRight.kind === XorNodeKind.Context) {
        const leftType: Type.TType = inspectXorNode(state, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;

        const key: string = partialLookupKey(leftType.kind, operatorKind);
        const maybeAllowedTypeKinds: ReadonlySet<Type.TypeKind> | undefined = PartialLookup.get(key);
        if (maybeAllowedTypeKinds === undefined) {
            return Type.NoneInstance;
        } else if (maybeAllowedTypeKinds.size === 1) {
            return TypeUtils.primitiveTypeFactory(maybeAllowedTypeKinds.values().next().value, leftType.isNullable);
        } else {
            const unionedTypePairs: Type.TType[] = [];
            for (const kind of maybeAllowedTypeKinds.values()) {
                unionedTypePairs.push({
                    kind,
                    maybeExtendedKind: undefined,
                    isNullable: true,
                });
            }
            return TypeUtils.anyUnionFactory(unionedTypePairs);
        }
    }
    // '1 + 1'
    else {
        const leftType: Type.TType = inspectXorNode(state, maybeLeft);
        const operatorKind: Ast.TBinOpExpressionOperator = maybeOperatorKind;
        const rightType: Type.TType = inspectXorNode(state, maybeRight);

        const key: string = lookupKey(leftType.kind, operatorKind, rightType.kind);
        const maybeResultTypeKind: Type.TypeKind | undefined = Lookup.get(key);
        if (maybeResultTypeKind === undefined) {
            return Type.NoneInstance;
        }
        const resultTypeKind: Type.TypeKind = maybeResultTypeKind;

        // '[foo = 1] & [bar = 2]'
        if (
            operatorKind === Ast.ArithmeticOperatorKind.And &&
            (resultTypeKind === Type.TypeKind.Record || resultTypeKind === Type.TypeKind.Table)
        ) {
            return inspectRecordOrTableUnion(leftType as TRecordOrTable, rightType as TRecordOrTable);
        } else {
            return TypeUtils.primitiveTypeFactory(resultTypeKind, leftType.isNullable || rightType.isNullable);
        }
    }
}

function inspectRecordOrTableUnion(leftType: TRecordOrTable, rightType: TRecordOrTable): Type.TType {
    if (leftType.kind !== rightType.kind) {
        const details: {} = {
            leftTypeKind: leftType.kind,
            rightTypeKind: rightType.kind,
        };
        throw new CommonError.InvariantError(`leftType.kind !== rightType.kind`, details);
    }
    // '[] & []' or '#table() & #table()'
    else if (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind === undefined) {
        return TypeUtils.primitiveTypeFactory(leftType.kind, leftType.isNullable || rightType.isNullable);
    }
    // '[key=value] & []' or '#table(...) & #table()`
    // '[] & [key=value]' or `#table() & #table(...)`
    else if (
        (leftType.maybeExtendedKind !== undefined && rightType.maybeExtendedKind === undefined) ||
        (leftType.maybeExtendedKind === undefined && rightType.maybeExtendedKind !== undefined)
    ) {
        // The 'rightType as (...)' isn't needed, except TypeScript's checker isn't smart enough to know it.
        const extendedType: Type.DefinedRecord | Type.DefinedTable =
            leftType.maybeExtendedKind !== undefined ? leftType : (rightType as Type.DefinedRecord | Type.DefinedTable);
        return {
            ...extendedType,
            isOpen: true,
        };
    }
    // '[foo=value] & [bar=value] or #table(...) & #table(...)'
    else if (leftType?.maybeExtendedKind === rightType?.maybeExtendedKind) {
        // The cast should be safe since the first if statement tests their the same kind,
        // and the above checks if they're the same extended kind.
        return unionFields([leftType, rightType] as
            | [Type.DefinedRecord, Type.DefinedRecord]
            | [Type.DefinedTable, Type.DefinedTable]);
    } else {
        throw Assert.shouldNeverBeReachedTypescript();
    }
}

function unionFields([leftType, rightType]:
    | [Type.DefinedRecord, Type.DefinedRecord]
    | [Type.DefinedTable, Type.DefinedTable]): Type.DefinedRecord | Type.DefinedTable {
    const combinedFields: Map<string, Type.TType> = new Map(leftType.fields);
    for (const [key, value] of rightType.fields.entries()) {
        combinedFields.set(key, value);
    }

    return {
        ...leftType,
        fields: combinedFields,
        isNullable: leftType.isNullable && rightType.isNullable,
        isOpen: leftType.isOpen || rightType.isOpen,
    };
}

// Keys: <first operand> <operator> <second operand>
// Values: the resulting type of the binary operation expression.
// Eg. '1 > 3' -> Type.TypeKind.Number
export const Lookup: ReadonlyMap<string, Type.TypeKind> = new Map([
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
    [lookupKey(Type.TypeKind.Date, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Time), Type.TypeKind.DateTime],

    ...createLookupsForRelational(Type.TypeKind.Date),
    ...createLookupsForEquality(Type.TypeKind.Date),
    ...createLookupsForClockKind(Type.TypeKind.Date),
    [lookupKey(Type.TypeKind.Date, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Time), Type.TypeKind.DateTime],

    ...createLookupsForRelational(Type.TypeKind.DateTime),
    ...createLookupsForEquality(Type.TypeKind.DateTime),
    ...createLookupsForClockKind(Type.TypeKind.DateTime),

    ...createLookupsForRelational(Type.TypeKind.DateTimeZone),
    ...createLookupsForEquality(Type.TypeKind.DateTimeZone),
    ...createLookupsForClockKind(Type.TypeKind.DateTimeZone),

    ...createLookupsForRelational(Type.TypeKind.Duration),
    ...createLookupsForEquality(Type.TypeKind.Duration),
    [
        lookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Subtraction, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Multiplication, Type.TypeKind.Number),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Number, Ast.ArithmeticOperatorKind.Multiplication, Type.TypeKind.Duration),
        Type.TypeKind.Duration,
    ],
    [
        lookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Division, Type.TypeKind.Number),
        Type.TypeKind.Duration,
    ],

    ...createLookupsForRelational(Type.TypeKind.Text),
    ...createLookupsForEquality(Type.TypeKind.Text),
    [lookupKey(Type.TypeKind.Text, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Text), Type.TypeKind.Text],

    ...createLookupsForRelational(Type.TypeKind.Binary),
    ...createLookupsForEquality(Type.TypeKind.Binary),

    ...createLookupsForEquality(Type.TypeKind.List),
    [lookupKey(Type.TypeKind.List, Ast.ArithmeticOperatorKind.And, Type.TypeKind.List), Type.TypeKind.List],

    ...createLookupsForEquality(Type.TypeKind.Record),
    [lookupKey(Type.TypeKind.Record, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Record), Type.TypeKind.Record],

    ...createLookupsForEquality(Type.TypeKind.Table),
    [lookupKey(Type.TypeKind.Table, Ast.ArithmeticOperatorKind.And, Type.TypeKind.Table), Type.TypeKind.Table],
]);

// Keys: <first operand> <operator>
// Values: a set of types that are allowed for <second operand>
// Eg. '1 + ' ->
export const PartialLookup: ReadonlyMap<string, ReadonlySet<Type.TypeKind>> = new Map(
    // Grab the keys
    [...Lookup.keys()]
        .reduce(
            (
                binaryExpressionPartialLookup: Map<string, Set<Type.TypeKind>>,
                key: string,
                _currentIndex,
                _array,
            ): Map<string, Set<Type.TypeKind>> => {
                const lastDeliminatorIndex: number = key.lastIndexOf(",");
                // Grab '<first operand> , <operator>'.
                const partialKey: string = key.slice(0, lastDeliminatorIndex);
                // Grab '<second operand>'.
                const potentialNewValue: Type.TypeKind = key.slice(lastDeliminatorIndex + 1) as Type.TypeKind;

                // Add the potentialNewValue if it's a new type.
                const maybeValues: Set<Type.TypeKind> | undefined = binaryExpressionPartialLookup.get(partialKey);
                // First occurance of '<first operand> , <operator>'
                if (maybeValues === undefined) {
                    binaryExpressionPartialLookup.set(partialKey, new Set([potentialNewValue]));
                } else {
                    maybeValues.add(potentialNewValue);
                }

                return binaryExpressionPartialLookup;
            },
            new Map(),
        )
        .entries(),
);

export function lookupKey(
    leftTypeKind: Type.TypeKind,
    operatorKind: Ast.TBinOpExpressionOperator,
    rightTypeKind: Type.TypeKind,
): string {
    return `${leftTypeKind},${operatorKind},${rightTypeKind}`;
}

export function partialLookupKey(leftTypeKind: Type.TypeKind, operatorKind: Ast.TBinOpExpressionOperator): string {
    return `${leftTypeKind},${operatorKind}`;
}

function createLookupsForRelational(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThan, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Ast.RelationalOperatorKind.GreaterThanEqualTo, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Ast.RelationalOperatorKind.LessThan, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Ast.RelationalOperatorKind.LessThanEqualTo, typeKind), Type.TypeKind.Logical],
    ];
}

function createLookupsForEquality(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Ast.EqualityOperatorKind.EqualTo, typeKind), Type.TypeKind.Logical],
        [lookupKey(typeKind, Ast.EqualityOperatorKind.NotEqualTo, typeKind), Type.TypeKind.Logical],
    ];
}

// Note: does not include the and <'&'> operator.
function createLookupsForArithmetic(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [lookupKey(typeKind, Ast.ArithmeticOperatorKind.Division, typeKind), typeKind],
        [lookupKey(typeKind, Ast.ArithmeticOperatorKind.Multiplication, typeKind), typeKind],
        [lookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), typeKind],
    ];
}

function createLookupsForLogical(typeKind: Type.TypeKind): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Ast.LogicalOperatorKind.And, typeKind), typeKind],
        [lookupKey(typeKind, Ast.LogicalOperatorKind.Or, typeKind), typeKind],
    ];
}

function createLookupsForClockKind(
    typeKind: Type.TypeKind.Date | Type.TypeKind.DateTime | Type.TypeKind.DateTimeZone | Type.TypeKind.Time,
): ReadonlyArray<[string, Type.TypeKind]> {
    return [
        [lookupKey(typeKind, Ast.ArithmeticOperatorKind.Addition, Type.TypeKind.Duration), typeKind],
        [lookupKey(Type.TypeKind.Duration, Ast.ArithmeticOperatorKind.Addition, typeKind), typeKind],
        [lookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, Type.TypeKind.Duration), typeKind],
        [lookupKey(typeKind, Ast.ArithmeticOperatorKind.Subtraction, typeKind), Type.TypeKind.Duration],
    ];
}
