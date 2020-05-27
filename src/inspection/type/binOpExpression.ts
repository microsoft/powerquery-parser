import { Ast } from "../../language";
import { Type } from "../../type";

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
