// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, CommonError, MapUtils } from "../../../common";
import { isEqualFunctionSignature, isEqualType } from "./isEqualType";
import { isFieldSpecificationList, isFunctionSignature } from "./isType";

// Returns `${left} is compatible with ${right}. Eg.
// `Type.TextInstance is compatible with Type.AnyInstance` -> true
// `Type.AnyInstance is compatible with Type.TextInstance` -> false
// `Type.NullInstance is compatible with Type.AnyNonNull` -> false
// `Type.TextInstance is compatible with Type.AnyUnion([Type.TextInstance, Type.NumberInstance])` -> true
export function isCompatible(left: Type.TPowerQueryType, right: Type.TPowerQueryType): boolean | undefined {
    if (
        left.kind === Type.TypeKind.NotApplicable ||
        left.kind === Type.TypeKind.Unknown ||
        right.kind === Type.TypeKind.NotApplicable ||
        right.kind === Type.TypeKind.Unknown
    ) {
        return undefined;
    } else if (
        left.kind === Type.TypeKind.None ||
        right.kind === Type.TypeKind.None ||
        (left.isNullable && !right.isNullable)
    ) {
        return false;
    } else if (left.kind === Type.TypeKind.Null && right.isNullable) {
        return true;
    }

    switch (right.kind) {
        case Type.TypeKind.Action:
        case Type.TypeKind.Binary:
        case Type.TypeKind.Date:
        case Type.TypeKind.DateTime:
        case Type.TypeKind.DateTimeZone:
        case Type.TypeKind.Duration:
        case Type.TypeKind.Time:
            return isEqualType(left, right);

        case Type.TypeKind.Any:
            return isCompatibleWithAny(left, right);

        case Type.TypeKind.AnyNonNull:
            return left.kind !== Type.TypeKind.Null && !left.isNullable;

        case Type.TypeKind.Function:
            return isCompatibleWithFunction(left, right);

        case Type.TypeKind.List:
            return isCompatibleWithList(left, right);

        case Type.TypeKind.Logical:
            return isCompatibleWithPrimitiveOrLiteral(left, right);

        case Type.TypeKind.Number:
            return isCompatibleWithPrimitiveOrLiteral(left, right);

        case Type.TypeKind.Null:
            return left.kind === Type.TypeKind.Null;

        case Type.TypeKind.Record:
            return isCompatibleWithRecord(left, right);

        case Type.TypeKind.Table:
            return isCompatibleWithTable(left, right);

        case Type.TypeKind.Text:
            return isCompatibleWithPrimitiveOrLiteral(left, right);

        case Type.TypeKind.Type:
            return isCompatibleWithType(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleWithFunctionSignature(
    left: Type.TPowerQueryType,
    right: Type.TPowerQueryType & Type.FunctionSignature,
): boolean {
    if (!isFunctionSignature(left)) {
        return false;
    }

    return isEqualFunctionSignature(left, right);
}

export function isCompatibleWithFunctionParameter(
    left: Type.TPowerQueryType | undefined,
    right: Type.FunctionParameter,
): boolean {
    if (left === undefined) {
        return right.isOptional;
    } else if (left.isNullable && !right.isNullable) {
        return false;
    } else {
        return !right.maybeType || right.maybeType === Type.TypeKind.Any || left.kind === right.maybeType;
    }
}

function isCompatibleWithAny(left: Type.TPowerQueryType, right: Type.TAny): boolean | undefined {
    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.AnyUnion:
            return isCompatibleWithAnyUnion(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithAnyUnion(left: Type.TPowerQueryType, right: Type.AnyUnion): boolean | undefined {
    for (const subtype of right.unionedTypePairs) {
        if (isCompatible(left, subtype)) {
            return true;
        }
    }

    return false;
}

function isCompatibleWithDefinedList(left: Type.TPowerQueryType, right: Type.DefinedList): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.DefinedList: {
            return isCompatibleDefinedListOrDefinedListType(left, right);
        }

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithDefinedListType(left: Type.TPowerQueryType, right: Type.DefinedListType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case Type.ExtendedTypeKind.DefinedListType:
            return isCompatibleDefinedListOrDefinedListType(left, right);

        case Type.ExtendedTypeKind.ListType:
            return isDefinedListTypeCompatibleWithListType(right, left);

        case undefined:
        case Type.ExtendedTypeKind.FunctionType:
        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
        case Type.ExtendedTypeKind.RecordType:
        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
        case Type.ExtendedTypeKind.TableType:
            return false;

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithDefinedRecord(left: Type.TPowerQueryType, right: Type.DefinedRecord): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isCompatibleWithFieldSpecificationList(left, right);

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithDefinedTable(left: Type.TPowerQueryType, right: Type.DefinedTable): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.DefinedTable: {
            return isCompatibleWithFieldSpecificationList(left, right);
        }

        default:
            throw Assert.isNever(left);
    }
}

// TODO: decide what a compatible FieldSpecificationList should look like
function isCompatibleWithFieldSpecificationList(
    left: Type.TPowerQueryType,
    right: Type.TPowerQueryType & Type.TFieldSpecificationList,
): boolean {
    if (!isFieldSpecificationList(left)) {
        return false;
    }

    return MapUtils.isSubsetMap(
        left.fields,
        right.fields,
        (leftValue: Type.TPowerQueryType, rightValue: Type.TPowerQueryType) => {
            const result: boolean | undefined = isCompatible(leftValue, rightValue);
            return result !== undefined && result;
        },
    );
}

function isCompatibleWithFunction(left: Type.TPowerQueryType, right: Type.TFunction): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedFunction:
            return isCompatibleWithFunctionSignature(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithList(left: Type.TPowerQueryType, right: Type.TList): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedList:
            return isCompatibleWithDefinedList(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithListType(left: Type.TPowerQueryType, right: Type.ListType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case Type.ExtendedTypeKind.DefinedListType:
            return isDefinedListTypeCompatibleWithListType(left, right);

        case Type.ExtendedTypeKind.ListType:
            return isEqualType(left.itemType, right.itemType);

        case undefined:
        case Type.ExtendedTypeKind.FunctionType:
        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
        case Type.ExtendedTypeKind.RecordType:
        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
        case Type.ExtendedTypeKind.TableType:
            return false;

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithPrimaryPrimitiveType(left: Type.TPowerQueryType, right: Type.PrimaryPrimitiveType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return left.primitiveType === right.primitiveType;

        case undefined:
        case Type.ExtendedTypeKind.DefinedListType:
        case Type.ExtendedTypeKind.ListType:
        case Type.ExtendedTypeKind.FunctionType:
        case Type.ExtendedTypeKind.RecordType:
        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
        case Type.ExtendedTypeKind.TableType:
            return false;

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithRecord(left: Type.TPowerQueryType, right: Type.TRecord): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isCompatibleWithDefinedRecord(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithRecordType(left: Type.TPowerQueryType, right: Type.RecordType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case Type.ExtendedTypeKind.RecordType:
            return isCompatibleWithFieldSpecificationList(left, right);

        case undefined:
        case Type.ExtendedTypeKind.DefinedListType:
        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
        case Type.ExtendedTypeKind.ListType:
        case Type.ExtendedTypeKind.FunctionType:
        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
        case Type.ExtendedTypeKind.TableType:
            return false;

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithTable(left: Type.TPowerQueryType, right: Type.TTable): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedTable:
            return isCompatibleWithDefinedTable(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithTableType(left: Type.TPowerQueryType, right: Type.TableType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.TableType:
            return isCompatibleWithFieldSpecificationList(left, right);

        case Type.ExtendedTypeKind.DefinedListType:
        case Type.ExtendedTypeKind.ListType:
        case Type.ExtendedTypeKind.FunctionType:
        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
        case Type.ExtendedTypeKind.RecordType:
        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return false;

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithTableTypePrimaryExpression(
    left: Type.TPowerQueryType,
    right: Type.TableTypePrimaryExpression,
): boolean | undefined {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return isCompatible(left.primaryExpression, right.primaryExpression);

        case Type.ExtendedTypeKind.DefinedListType:
        case Type.ExtendedTypeKind.ListType:
        case Type.ExtendedTypeKind.FunctionType:
        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
        case Type.ExtendedTypeKind.RecordType:
        case Type.ExtendedTypeKind.TableType:
            return false;

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithLiteral<T extends Type.TLiteral>(left: Type.TPowerQueryType, right: T): boolean {
    if (left.kind !== right.kind || !left.maybeExtendedKind || left.maybeExtendedKind !== right.maybeExtendedKind) {
        return false;
    } else {
        return left.normalizedLiteral === right.normalizedLiteral;
    }
}

function isCompatibleDefinedListOrDefinedListType<T extends Type.DefinedList | Type.DefinedListType>(
    left: T,
    right: T,
): boolean {
    let leftElements: ReadonlyArray<Type.TPowerQueryType>;
    let rightElements: ReadonlyArray<Type.TPowerQueryType>;

    if (
        left.maybeExtendedKind === Type.ExtendedTypeKind.DefinedList &&
        right.maybeExtendedKind === Type.ExtendedTypeKind.DefinedList
    ) {
        leftElements = left.elements;
        rightElements = right.elements;
    } else if (
        left.maybeExtendedKind === Type.ExtendedTypeKind.DefinedListType &&
        right.maybeExtendedKind === Type.ExtendedTypeKind.DefinedListType
    ) {
        leftElements = left.itemTypes;
        rightElements = right.itemTypes;
    } else {
        throw new CommonError.InvariantError(`unknown scenario for isCompatibleDefinedListOrDefinedListType`, {
            leftTypeKind: left.kind,
            rightTypeKind: right.kind,
            leftMaybeExtendedTypeKind: left.maybeExtendedKind,
            rightMaybeExtendedTypeKind: right.maybeExtendedKind,
        });
    }

    if (leftElements.length !== rightElements.length) {
        return false;
    }

    const numElements: number = leftElements.length;
    for (let index: number = 0; index < numElements; index += 1) {
        if (!isCompatible(leftElements[index], rightElements[index])) {
            return false;
        }
    }

    return true;
}

function isCompatibleWithPrimitiveOrLiteral(
    left: Type.TPowerQueryType,
    right: Type.TLogical | Type.TText | Type.TNumber,
): boolean {
    return left.kind === right.kind && (!right.maybeExtendedKind || isCompatibleWithLiteral(left, right));
}

function isCompatibleWithType(
    left: Type.TPowerQueryType,
    right:
        | Type.DefinedListType
        | Type.FunctionType
        | Type.ListType
        | Type.PrimaryPrimitiveType
        | Type.RecordType
        | Type.TableType
        | Type.TableTypePrimaryExpression
        | Type.Type,
): boolean | undefined {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.FunctionType:
            return isCompatibleWithFunctionSignature(left, right);

        case Type.ExtendedTypeKind.ListType:
            return isCompatibleWithListType(left, right);

        case Type.ExtendedTypeKind.DefinedListType:
            return isCompatibleWithDefinedListType(left, right);

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return isCompatibleWithPrimaryPrimitiveType(left, right);

        case Type.ExtendedTypeKind.RecordType:
            return isCompatibleWithRecordType(left, right);

        case Type.ExtendedTypeKind.TableType:
            return isCompatibleWithTableType(left, right);

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return isCompatibleWithTableTypePrimaryExpression(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isDefinedListTypeCompatibleWithListType(definedList: Type.DefinedListType, listType: Type.ListType): boolean {
    const itemTypeCompatabilities: ReadonlyArray<boolean | undefined> = definedList.itemTypes.map(itemType =>
        isCompatible(itemType, listType.itemType),
    );

    return itemTypeCompatabilities.find(value => value === undefined || value === false) !== undefined;
}
