// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { ArrayUtils, Assert, MapUtils } from "../../../common";

export function isEqualType(left: Type.TType, right: Type.TType): boolean {
    if (left === right) {
        return true;
    } else if (
        left.kind !== right.kind ||
        left.maybeExtendedKind !== right.maybeExtendedKind ||
        left.isNullable !== right.isNullable
    ) {
        return false;
    } else if (left.maybeExtendedKind !== undefined && right.maybeExtendedKind !== undefined) {
        return isEqualExtendedTypes(left, right);
    } else {
        return true;
    }
}

// Does not care about ordering.
export function isEqualTypes(leftTypes: ReadonlyArray<Type.TType>, rightTypes: ReadonlyArray<Type.TType>): boolean {
    if (leftTypes === rightTypes) {
        return true;
    } else if (leftTypes.length !== rightTypes.length) {
        return false;
    }

    const numTypes: number = leftTypes.length;
    for (let index: number = 0; index < numTypes; index += 1) {
        if (!isTypeInArray(leftTypes, rightTypes[index])) {
            return false;
        }
    }

    return true;
}

export function isEqualExtendedTypes(left: Type.TExtendedType, right: Type.TExtendedType): boolean {
    if (left === right) {
        return true;
    } else if (left.maybeExtendedKind !== right.maybeExtendedKind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case Type.ExtendedTypeKind.AnyUnion:
            return isEqualAnyUnion(left, right as Type.AnyUnion);

        case Type.ExtendedTypeKind.DefinedFunction:
            return isEqualDefinedFunction(left, right as Type.DefinedFunction);

        case Type.ExtendedTypeKind.DefinedList:
            return isEqualDefinedList(left, right as Type.DefinedList);

        case Type.ExtendedTypeKind.DefinedListType:
            return isEqualDefinedListType(left, right as Type.DefinedListType);

        case Type.ExtendedTypeKind.DefinedRecord:
            return isEqualDefinedRecord(left, right as Type.DefinedRecord);

        case Type.ExtendedTypeKind.DefinedTable:
            return isEqualDefinedTable(left, right as Type.DefinedTable);

        case Type.ExtendedTypeKind.FunctionType:
            return isEqualFunctionType(left, right as Type.FunctionType);

        case Type.ExtendedTypeKind.ListType:
            return isEqualListType(left, right as Type.ListType);

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return isEqualPrimaryPrimitiveType(left, right as Type.PrimaryPrimitiveType);

        case Type.ExtendedTypeKind.RecordType:
            return isEqualRecordType(left, right as Type.RecordType);

        case Type.ExtendedTypeKind.TableType:
            return isEqualTableType(left, right as Type.TableType);

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return isEqualTableTypePrimaryExpression(left, right as Type.TableTypePrimaryExpression);

        default:
            throw Assert.isNever(left);
    }
}

export function isEqualAnyUnion(left: Type.AnyUnion, right: Type.AnyUnion): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable && isEqualTypes(left.unionedTypePairs, right.unionedTypePairs))
    );
}

export function isEqualDefinedFunction(left: Type.DefinedFunction, right: Type.DefinedFunction): boolean {
    return isEqualFunctionSignature(left, right);
}

export function isEqualDefinedFunctionParameters(
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

export function isEqualDefinedList(left: Type.DefinedList, right: Type.DefinedList): boolean {
    if (left === right) {
        return true;
    } else if (left.elements.length !== right.elements.length || left.isNullable !== right.isNullable) {
        return false;
    }

    const rightElements: ReadonlyArray<Type.TType> = right.elements;
    return ArrayUtils.all(
        left.elements.map((leftType: Type.TType, index: number) => isEqualType(leftType, rightElements[index])),
    );
}

export function isEqualDefinedListType(left: Type.DefinedListType, right: Type.DefinedListType): boolean {
    if (left === right) {
        return true;
    } else if (left.itemTypes.length !== right.itemTypes.length || left.isNullable !== right.isNullable) {
        return false;
    }

    const rightElements: ReadonlyArray<Type.TType> = right.itemTypes;
    return ArrayUtils.all(
        left.itemTypes.map((leftType: Type.TType, index: number) => isEqualType(leftType, rightElements[index])),
    );
}

export function isEqualDefinedRecord(left: Type.DefinedRecord, right: Type.DefinedRecord): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable &&
            MapUtils.isEqualMap<string, Type.TType>(left.fields, right.fields, isEqualType))
    );
}

export function isEqualDefinedTable(left: Type.DefinedTable, right: Type.DefinedTable): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable &&
            MapUtils.isEqualMap<string, Type.TType>(left.fields, right.fields, isEqualType))
    );
}

export function isEqualPrimaryPrimitiveType(
    left: Type.PrimaryPrimitiveType,
    right: Type.PrimaryPrimitiveType,
): boolean {
    return (
        left === right || (left.isNullable === right.isNullable && isEqualType(left.primitiveType, right.primitiveType))
    );
}

export function isEqualFieldSpecificationList(
    left: Type.FieldSpecificationList,
    right: Type.FieldSpecificationList,
): boolean {
    if (left === right) {
        return true;
    } else if (left.isOpen !== right.isOpen || left.fields.size !== right.fields.size) {
        return false;
    }

    for (const [key, leftValue] of left.fields.entries()) {
        const maybeRightValue: Type.TType | undefined = right.fields.get(key);
        if (maybeRightValue === undefined || !isEqualType(leftValue, maybeRightValue)) {
            return false;
        }
    }

    return true;
}

export function isEqualFunctionSignature(
    left: Type.TType & Type.FunctionSignature,
    right: Type.TType & Type.FunctionSignature,
): boolean {
    return (
        left === right ||
        (left.isNullable === right.isNullable &&
            isEqualType(left.returnType, right.returnType) &&
            isEqualDefinedFunctionParameters(left.parameters, right.parameters))
    );
}

export function isEqualFunctionType(left: Type.FunctionType, right: Type.FunctionType): boolean {
    return isEqualFunctionSignature(left, right);
}

export function isEqualListType(left: Type.ListType, right: Type.ListType): boolean {
    return left === right || (left.isNullable === right.isNullable && isEqualType(left.itemType, right.itemType));
}

export function isEqualRecordType(left: Type.RecordType, right: Type.RecordType): boolean {
    return left.isNullable === right.isNullable && isEqualFieldSpecificationList(left, right);
}

export function isEqualTableType(left: Type.TableType, right: Type.TableType): boolean {
    return left.isNullable === right.isNullable && isEqualFieldSpecificationList(left, right);
}

export function isEqualTableTypePrimaryExpression(
    left: Type.TableTypePrimaryExpression,
    right: Type.TableTypePrimaryExpression,
): boolean {
    return left === right || isEqualType(left.primaryExpression, right.primaryExpression);
}

export function isTypeInArray(collection: ReadonlyArray<Type.TType>, item: Type.TType): boolean {
    // Fast comparison then deep comparison
    return collection.includes(item) || collection.find((type: Type.TType) => isEqualType(item, type)) !== undefined;
}
