// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from ".";
import { ArrayUtils, isNever, MapUtils } from "../common";
import { ParameterScopeItem } from "../inspection";
import { Ast } from "../language";

export function genericFactory<T extends Type.TypeKind>(typeKind: T, isNullable: boolean): Type.IPrimitiveType<T> {
    return {
        kind: typeKind,
        maybeExtendedKind: undefined,
        isNullable,
    };
}

export function anyFactory(): Type.Any {
    return AnyConstant;
}

export function anyUnionFactory(unionedTypePairs: ReadonlyArray<Type.TType>, dedupeTypes: boolean = true): Type.TType {
    const simplified: ReadonlyArray<Type.TType> = dedupe(unionedTypePairs, dedupeTypes);
    if (simplified.length === 1) {
        return simplified[0];
    }

    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: unionedTypePairs.find((ttype: Type.TType) => ttype.isNullable === true) !== undefined,
        unionedTypePairs: simplified,
    };
}

export function definedRecordFactory(
    isNullable: boolean,
    fields: Map<string, Type.TType>,
    isOpen: boolean,
): Type.DefinedRecord {
    return {
        kind: Type.TypeKind.Record,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
        isNullable,
        fields,
        isOpen,
    };
}

export function definedTableFactory(
    isNullable: boolean,
    fields: Map<string, Type.TType>,
    isOpen: boolean,
): Type.DefinedTable {
    return {
        kind: Type.TypeKind.Table,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
        isNullable,
        fields,
        isOpen,
    };
}

export function unknownFactory(): Type.Unknown {
    return UnknownConstant;
}

export function noneFactory(): Type.None {
    return NoneConstant;
}

export function parameterFactory(parameter: ParameterScopeItem): Type.TType {
    if (parameter.maybeType === undefined) {
        return unknownFactory();
    }

    return {
        kind: typeKindFromPrimitiveTypeConstantKind(parameter.maybeType),
        maybeExtendedKind: undefined,
        isNullable: parameter.isNullable,
    };
}

export function dedupe(types: ReadonlyArray<Type.TType>, combineAnys: boolean = true): ReadonlyArray<Type.TType> {
    const buckets: Map<string, Type.TType[]> = new Map();

    for (const current of types) {
        const key: string = `${current.kind},${current.maybeExtendedKind}`;
        const maybeColllection: Type.TType[] | undefined = buckets.get(key);
        // First type of TypeKind
        if (maybeColllection === undefined) {
            buckets.set(key, [current]);
        }
        // In the bucket for type.kind, check if it's the first with a deep equals comparison.
        else if (maybeColllection.find((type: Type.TType) => equalType(current, type)) === undefined) {
            maybeColllection.push(current);
        }
    }

    if (combineAnys === true) {
        const anyUnionKey: string = `${Type.TypeKind.Any},${Type.ExtendedTypeKind.AnyUnion}`;
        const maybeAnyUnions: ReadonlyArray<Type.TType> | undefined = buckets.get(anyUnionKey);
        if (maybeAnyUnions !== undefined) {
            buckets.set(anyUnionKey, [...combineAnyUnions(maybeAnyUnions as ReadonlyArray<Type.AnyUnion>)]);
        }
    }

    const result: Type.TType[] = [];
    for (types of buckets.values()) {
        result.push(...types);
    }

    return result;
}

export function combineAnyUnions(anyUnions: ReadonlyArray<Type.AnyUnion>): ReadonlyArray<Type.TType> {
    const [nullable, nonNullable]: [ReadonlyArray<Type.AnyUnion>, ReadonlyArray<Type.AnyUnion>] = ArrayUtils.split(
        anyUnions,
        (value: Type.AnyUnion) => value.isNullable === true,
    );

    const flattenedNullable: ReadonlyArray<Type.TType> = nullable
        .map((anyUnion: Type.AnyUnion) => anyUnion.unionedTypePairs)
        .reduce((flattened: Type.TType[], types: ReadonlyArray<Type.TType>, _currentIndex, _array): Type.TType[] => {
            flattened.push(...types);
            return flattened;
        }, []);
    const flattenedNonNullable: ReadonlyArray<Type.TType> = nonNullable
        .map((anyUnion: Type.AnyUnion) => anyUnion.unionedTypePairs)
        .reduce((flattened: Type.TType[], types: ReadonlyArray<Type.TType>, _currentIndex, _array): Type.TType[] => {
            flattened.push(...types);
            return flattened;
        }, []);

    const result: Type.TType[] = [];
    if (flattenedNullable.length !== 0) {
        result.push(anyUnionFactory(flattenedNullable, false));
    }
    if (flattenedNonNullable.length !== 0) {
        result.push(anyUnionFactory(flattenedNonNullable, false));
    }

    return result;
}

export function typeKindFromLiteralKind(literalKind: Ast.LiteralKind): Type.TypeKind {
    switch (literalKind) {
        case Ast.LiteralKind.List:
            return Type.TypeKind.List;

        case Ast.LiteralKind.Logical:
            return Type.TypeKind.Logical;

        case Ast.LiteralKind.Null:
            return Type.TypeKind.Null;

        case Ast.LiteralKind.Numeric:
            return Type.TypeKind.Number;

        case Ast.LiteralKind.Record:
            return Type.TypeKind.Record;

        case Ast.LiteralKind.Text:
            return Type.TypeKind.Text;

        default:
            throw isNever(literalKind);
    }
}

export function maybePrimitiveTypeConstantKindFromTypeKind(
    typeKind: Type.TypeKind,
): Ast.PrimitiveTypeConstantKind | undefined {
    switch (typeKind) {
        case Type.TypeKind.Action:
            return Ast.PrimitiveTypeConstantKind.Action;

        case Type.TypeKind.Any:
            return Ast.PrimitiveTypeConstantKind.Any;

        case Type.TypeKind.AnyNonNull:
            return Ast.PrimitiveTypeConstantKind.AnyNonNull;

        case Type.TypeKind.Binary:
            return Ast.PrimitiveTypeConstantKind.Binary;

        case Type.TypeKind.Date:
            return Ast.PrimitiveTypeConstantKind.Date;

        case Type.TypeKind.DateTime:
            return Ast.PrimitiveTypeConstantKind.DateTime;

        case Type.TypeKind.DateTimeZone:
            return Ast.PrimitiveTypeConstantKind.DateTimeZone;

        case Type.TypeKind.Duration:
            return Ast.PrimitiveTypeConstantKind.Duration;

        case Type.TypeKind.Function:
            return Ast.PrimitiveTypeConstantKind.Function;

        case Type.TypeKind.List:
            return Ast.PrimitiveTypeConstantKind.List;

        case Type.TypeKind.Logical:
            return Ast.PrimitiveTypeConstantKind.Logical;

        case Type.TypeKind.None:
            return Ast.PrimitiveTypeConstantKind.None;

        case Type.TypeKind.Null:
            return Ast.PrimitiveTypeConstantKind.Null;

        case Type.TypeKind.Number:
            return Ast.PrimitiveTypeConstantKind.Number;

        case Type.TypeKind.Record:
            return Ast.PrimitiveTypeConstantKind.Record;

        case Type.TypeKind.Table:
            return Ast.PrimitiveTypeConstantKind.Table;

        case Type.TypeKind.Text:
            return Ast.PrimitiveTypeConstantKind.Text;

        case Type.TypeKind.Time:
            return Ast.PrimitiveTypeConstantKind.Time;

        case Type.TypeKind.Type:
            return Ast.PrimitiveTypeConstantKind.Type;

        case Type.TypeKind.Unknown:
            return undefined;

        default:
            throw isNever(typeKind);
    }
}

export function typeKindFromPrimitiveTypeConstantKind(
    primitiveTypeConstantKind: Ast.PrimitiveTypeConstantKind,
): Type.TypeKind {
    switch (primitiveTypeConstantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return Type.TypeKind.Action;

        case Ast.PrimitiveTypeConstantKind.Any:
            return Type.TypeKind.Any;

        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return Type.TypeKind.AnyNonNull;

        case Ast.PrimitiveTypeConstantKind.Binary:
            return Type.TypeKind.Binary;

        case Ast.PrimitiveTypeConstantKind.Date:
            return Type.TypeKind.Date;

        case Ast.PrimitiveTypeConstantKind.DateTime:
            return Type.TypeKind.DateTime;

        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return Type.TypeKind.DateTimeZone;

        case Ast.PrimitiveTypeConstantKind.Duration:
            return Type.TypeKind.Duration;

        case Ast.PrimitiveTypeConstantKind.Function:
            return Type.TypeKind.Function;

        case Ast.PrimitiveTypeConstantKind.List:
            return Type.TypeKind.List;

        case Ast.PrimitiveTypeConstantKind.Logical:
            return Type.TypeKind.Logical;

        case Ast.PrimitiveTypeConstantKind.None:
            return Type.TypeKind.None;

        case Ast.PrimitiveTypeConstantKind.Null:
            return Type.TypeKind.Null;

        case Ast.PrimitiveTypeConstantKind.Number:
            return Type.TypeKind.Number;

        case Ast.PrimitiveTypeConstantKind.Record:
            return Type.TypeKind.Record;

        case Ast.PrimitiveTypeConstantKind.Table:
            return Type.TypeKind.Table;

        case Ast.PrimitiveTypeConstantKind.Text:
            return Type.TypeKind.Text;

        case Ast.PrimitiveTypeConstantKind.Time:
            return Type.TypeKind.Time;

        case Ast.PrimitiveTypeConstantKind.Type:
            return Type.TypeKind.Type;

        default:
            throw isNever(primitiveTypeConstantKind);
    }
}

export function simplifyNullablePrimitiveType(node: Ast.AsNullablePrimitiveType): Type.SimplifiedNullablePrimitiveType {
    let primitiveTypeConstantKind: Ast.PrimitiveTypeConstantKind;
    let isNullable: boolean;

    const nullablePrimitiveType: Ast.TNullablePrimitiveType = node.paired;
    switch (nullablePrimitiveType.kind) {
        case Ast.NodeKind.NullablePrimitiveType:
            primitiveTypeConstantKind = nullablePrimitiveType.paired.primitiveType.constantKind;
            isNullable = true;
            break;

        case Ast.NodeKind.PrimitiveType:
            primitiveTypeConstantKind = nullablePrimitiveType.primitiveType.constantKind;
            isNullable = false;
            break;

        default:
            throw isNever(nullablePrimitiveType);
    }

    return {
        typeKind: typeKindFromPrimitiveTypeConstantKind(primitiveTypeConstantKind),
        isNullable,
    };
}

export function equalType(left: Type.TType, right: Type.TType): boolean {
    if (left.kind !== right.kind) {
        return false;
    } else if (left.maybeExtendedKind !== undefined && right.maybeExtendedKind !== undefined) {
        return equalExtendedTypes(left, right);
    } else if (left.isNullable !== right.isNullable) {
        return false;
    } else {
        return true;
    }
}

export function equalTypes(leftTypes: ReadonlyArray<Type.TType>, rightTypes: ReadonlyArray<Type.TType>): boolean {
    if (leftTypes.length !== rightTypes.length) {
        return false;
    }

    const numTypes: number = leftTypes.length;
    for (let index: number = 0; index < numTypes; index += 1) {
        if (equalType(leftTypes[index], rightTypes[index]) === false) {
            return false;
        }
    }

    return true;
}

export function equalExtendedTypes(left: Type.TExtendedType, right: Type.TExtendedType): boolean {
    if (left.maybeExtendedKind !== right.maybeExtendedKind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case Type.ExtendedTypeKind.AnyUnion:
            return equalAnyUnion(left, right as Type.AnyUnion);

        case Type.ExtendedTypeKind.DefinedFunction:
            return equalDefinedFunction(left, right as Type.DefinedFunction);

        case Type.ExtendedTypeKind.DefinedList:
            return equalDefinedList(left, right as Type.DefinedList);

        case Type.ExtendedTypeKind.DefinedRecord:
            return equalDefinedRecord(left, right as Type.DefinedRecord);

        case Type.ExtendedTypeKind.DefinedTable:
            return equalDefinedTable(left, right as Type.DefinedTable);

        case Type.ExtendedTypeKind.DefinedType:
            return equalDefinedType(left, right as Type.DefinedType);

        default:
            throw isNever(left);
    }
}

export function equalAnyUnion(left: Type.AnyUnion, right: Type.AnyUnion): boolean {
    return left.isNullable === right.isNullable && equalTypes(left.unionedTypePairs, right.unionedTypePairs);
}

export function equalDefinedFunction(left: Type.DefinedFunction, right: Type.DefinedFunction): boolean {
    return (
        left.isNullable === right.isNullable &&
        equalType(left.returnType, right.returnType) &&
        equalTypes(left.parameterTypes, right.parameterTypes)
    );
}

export function equalDefinedList(left: Type.DefinedList, right: Type.DefinedList): boolean {
    return left.isNullable === right.isNullable && equalType(left.itemType, right.itemType);
}

export function equalDefinedRecord(left: Type.DefinedRecord, right: Type.DefinedRecord): boolean {
    return (
        left.isNullable === right.isNullable &&
        MapUtils.equalMaps<string, Type.TType>(left.fields, right.fields, equalType)
    );
}

export function equalDefinedTable(left: Type.DefinedTable, right: Type.DefinedTable): boolean {
    return (
        left.isNullable === right.isNullable &&
        MapUtils.equalMaps<string, Type.TType>(left.fields, right.fields, equalType)
    );
}

export function equalDefinedType(left: Type.DefinedType, right: Type.DefinedType): boolean {
    return left.isNullable === right.isNullable && equalType(left.primaryType, right.primaryType);
}

const AnyConstant: Type.Any = {
    kind: Type.TypeKind.Any,
    maybeExtendedKind: undefined,
    isNullable: true,
};

const NoneConstant: Type.None = {
    kind: Type.TypeKind.None,
    maybeExtendedKind: undefined,
    isNullable: false,
};

const UnknownConstant: Type.Unknown = {
    kind: Type.TypeKind.Unknown,
    maybeExtendedKind: undefined,
    isNullable: false,
};
