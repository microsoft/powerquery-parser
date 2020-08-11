// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { ArrayUtils, Assert, MapUtils } from "../../common";

export function equalType(left: Type.TType, right: Type.TType): boolean {
    if (left === right) {
        return true;
    } else if (
        left.kind !== right.kind ||
        left.maybeExtendedKind !== right.maybeExtendedKind ||
        left.isNullable !== right.isNullable
    ) {
        return false;
    } else if (left.maybeExtendedKind !== undefined && right.maybeExtendedKind !== undefined) {
        return equalExtendedTypes(left, right);
    } else {
        return true;
    }
}

export function equalTypes(leftTypes: ReadonlyArray<Type.TType>, rightTypes: ReadonlyArray<Type.TType>): boolean {
    if (leftTypes === rightTypes) {
        return true;
    } else if (leftTypes.length !== rightTypes.length) {
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

export function equalExtendedTypes<T extends Type.TType>(left: Type.TExtendedType, right: Type.TExtendedType): boolean {
    if (left === right) {
        return true;
    } else if (left.maybeExtendedKind !== right.maybeExtendedKind) {
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
            return equalDefinedType(left, right as Type.DefinedType<T>);

        case Type.ExtendedTypeKind.GenericList:
            return equalPartiallyDefinedList(left, right as Type.GenericList);

        case Type.ExtendedTypeKind.ListType:
            return equalListType(left, right as Type.ListType);

        case Type.ExtendedTypeKind.PrimaryExpressionTable:
            return equalPrimaryExpressionTable(left, right as Type.PrimaryExpressionTable);

        default:
            throw Assert.isNever(left);
    }
}

export function equalAnyUnion(left: Type.AnyUnion, right: Type.AnyUnion): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable && equalTypes(left.unionedTypePairs, right.unionedTypePairs))
    );
}

export function equalDefinedFunction(left: Type.DefinedFunction, right: Type.DefinedFunction): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable &&
            equalType(left.returnType, right.returnType) &&
            equalDefinedFunctionParameters(left.parameters, right.parameters))
    );
}

export function equalDefinedFunctionParameters(
    left: ReadonlyArray<Type.FunctionParameter>,
    right: ReadonlyArray<Type.FunctionParameter>,
): boolean {
    if (left === right) {
        return true;
    } else if (left.length !== right.length) {
        return false;
    }

    const numParameters: number = left.length;
    for (let index: number = 0; index < numParameters; index += 1) {
        const nthLeft: Type.FunctionParameter = left[index];
        const nthRight: Type.FunctionParameter = right[index];
        if (
            nthLeft.isNullable !== nthRight.isNullable ||
            nthLeft.isOptional !== nthRight.isOptional ||
            nthLeft.maybeType !== nthRight.maybeType
        ) {
            return false;
        }
    }

    return true;
}

export function equalDefinedList(left: Type.DefinedList, right: Type.DefinedList): boolean {
    if (left === right) {
        return true;
    } else if (left.elements.length !== right.elements.length || left.isNullable !== right.isNullable) {
        return false;
    }

    const rightElements: ReadonlyArray<Type.TType> = right.elements;
    return ArrayUtils.all(
        left.elements.map((leftType: Type.TType, index: number) => equalType(leftType, rightElements[index])),
    );
}

export function equalDefinedRecord(left: Type.DefinedRecord, right: Type.DefinedRecord): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable &&
            MapUtils.equalMaps<string, Type.TType>(left.fields, right.fields, equalType))
    );
}

export function equalDefinedTable(left: Type.DefinedTable, right: Type.DefinedTable): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable &&
            MapUtils.equalMaps<string, Type.TType>(left.fields, right.fields, equalType))
    );
}

export function equalDefinedType<T extends Type.TType>(left: Type.DefinedType<T>, right: Type.DefinedType<T>): boolean {
    return left === right || (left.isNullable === right.isNullable && equalType(left.primaryType, right.primaryType));
}

export function equalListType(left: Type.ListType, right: Type.ListType): boolean {
    return left === right || (left.isNullable === right.isNullable && equalType(left.itemType, right.itemType));
}

export function equalPartiallyDefinedList(left: Type.GenericList, right: Type.GenericList): boolean {
    return left === right || (left.isNullable === right.isNullable && equalType(left.typeAllowed, right.typeAllowed));
}

export function equalPrimaryExpressionTable(
    left: Type.PrimaryExpressionTable,
    right: Type.PrimaryExpressionTable,
): boolean {
    return left === right || equalType(left.type, right.type);
}
