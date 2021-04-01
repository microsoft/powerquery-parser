// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, MapUtils } from "../../../common";
import { isEqualFunctionSignature, isEqualType } from "./isEqualType";
import { isFieldSpecificationList, isFunctionSignature } from "./isType";

// Returns `${left} is compatible with ${right}. Eg.
// `Type.TextInstance is compatible with Type.AnyInstance` -> true
// `Type.AnyInstance is compatible with Type.TextInstance` -> false
// `Type.NullInstance is compatible with Type.AnyNonNull` -> false
// `Type.TextInstance is compatible with Type.AnyUnion([Type.TextInstance, Type.NumberInstance])` -> true
export function isCompatible(left: Type.PqType, right: Type.PqType): boolean | undefined {
    if (
        left.kind === Type.TypeKind.NotApplicable ||
        left.kind === Type.TypeKind.Unknown ||
        right.kind === Type.TypeKind.NotApplicable ||
        right.kind === Type.TypeKind.Unknown
    ) {
        return undefined;
    } else if (left.kind === Type.TypeKind.None || right.kind === Type.TypeKind.None) {
        return false;
    }

    switch (right.kind) {
        case Type.TypeKind.Action:
        case Type.TypeKind.Binary:
        case Type.TypeKind.Date:
        case Type.TypeKind.DateTime:
        case Type.TypeKind.DateTimeZone:
        case Type.TypeKind.Duration:
        case Type.TypeKind.Logical:
        case Type.TypeKind.Null:
        case Type.TypeKind.Time:
            return isCompatibleWithNullable(left, right) || isEqualType(left, right);

        case Type.TypeKind.Any:
            return isCompatibleWithAny(left, right);

        case Type.TypeKind.AnyNonNull:
            return left.kind !== right.kind;

        case Type.TypeKind.Function:
            return isCompatibleWithFunction(left, right);

        case Type.TypeKind.List:
            return isCompatibleWithList(left, right);

        case Type.TypeKind.Number:
            return isCompatibleWithNumber(left, right);

        case Type.TypeKind.Record:
            return isCompatibleWithRecord(left, right);

        case Type.TypeKind.Table:
            return isCompatibleWithTable(left, right);

        case Type.TypeKind.Text:
            return isCompatibleWithText(left, right);

        case Type.TypeKind.Type:
            return isCompatibleWithType(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleWithFunctionSignature(
    left: Type.PqType,
    right: Type.PqType & Type.FunctionSignature,
): boolean {
    if (!isCompatibleWithNullable(left, right) || !isFunctionSignature(left)) {
        return false;
    }

    return isEqualFunctionSignature(left, right);
}

export function isCompatibleWithFunctionParameter(
    left: Type.PqType | undefined,
    right: Type.FunctionParameter,
): boolean {
    if (left === undefined) {
        return right.isOptional;
    } else if (left.isNullable && !right.isNullable) {
        return false;
    } else if (right.maybeType) {
        return left.kind === right.maybeType;
    } else {
        return true;
    }
}

function isCompatibleWithAny(left: Type.PqType, right: Type.TAny): boolean | undefined {
    switch (right.maybeExtendedKind) {
        case undefined:
            return isCompatibleWithNullable(left, right);

        case Type.ExtendedTypeKind.AnyUnion:
            return isCompatibleWithAnyUnion(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithAnyUnion(left: Type.PqType, right: Type.AnyUnion): boolean | undefined {
    for (const subtype of right.unionedTypePairs) {
        if (isCompatible(left, subtype)) {
            return true;
        }
    }

    return false;
}

function isCompatibleWithDefinedList(left: Type.PqType, right: Type.DefinedList): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.DefinedList:
            return isEqualType(left, right);

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithDefinedListType(left: Type.PqType, right: Type.DefinedListType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.DefinedListType:
            return isEqualType(left, right);

        case Type.ExtendedTypeKind.ListType:
            return isDefinedListTypeCompatibleWithListType(right, left);

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

function isCompatibleWithDefinedRecord(left: Type.PqType, right: Type.DefinedRecord): boolean {
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

function isCompatibleWithDefinedTable(left: Type.PqType, right: Type.DefinedTable): boolean {
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
    left: Type.PqType,
    right: Type.PqType & Type.FieldSpecificationList,
): boolean {
    if (!isCompatibleWithNullable(left, right) || !isFieldSpecificationList(left)) {
        return false;
    }

    return MapUtils.isSubsetMap(left.fields, right.fields, (leftValue: Type.PqType, rightValue: Type.PqType) =>
        isEqualType(leftValue, rightValue),
    );
}

function isCompatibleWithFunction(left: Type.PqType, right: Type.TFunction): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return isCompatibleWithNullable(left, right);

        case Type.ExtendedTypeKind.DefinedFunction:
            return isCompatibleWithFunctionSignature(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithList(left: Type.PqType, right: Type.TList): boolean {
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

function isCompatibleWithListType(left: Type.PqType, right: Type.ListType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.DefinedListType:
            return isDefinedListTypeCompatibleWithListType(left, right);

        case Type.ExtendedTypeKind.ListType:
            return isEqualType(left.itemType, right.itemType);

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

function isCompatibleWithPrimaryPrimitiveType(left: Type.PqType, right: Type.PrimaryPrimitiveType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return left.primitiveType === right.primitiveType;

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

function isCompatibleWithNullable(left: Type.PqType, right: Type.PqType): boolean {
    return right.isNullable === true ? true : left.isNullable === false;
}

function isCompatibleWithNumber(left: Type.PqType, right: Type.TNumber): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return isCompatibleWithNullable(left, right);

        case Type.ExtendedTypeKind.NumberLiteral:
            return isCompatibleWithNumberLiteral(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithNumberLiteral(left: Type.PqType, right: Type.NumberLiteral): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.NumberLiteral:
            return isEqualType(left, right);

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithRecord(left: Type.PqType, right: Type.TRecord): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return isCompatibleWithNullable(left, right);

        case Type.ExtendedTypeKind.DefinedRecord:
            return isCompatibleWithDefinedRecord(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithRecordType(left: Type.PqType, right: Type.RecordType): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.RecordType:
            return isCompatibleWithFieldSpecificationList(left, right);

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

function isCompatibleWithTable(left: Type.PqType, right: Type.TTable): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return isCompatibleWithNullable(left, right);

        case Type.ExtendedTypeKind.DefinedTable:
            return isCompatibleWithDefinedTable(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithTableType(left: Type.PqType, right: Type.TableType): boolean {
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
    left: Type.PqType,
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

function isCompatibleWithText(left: Type.PqType, right: Type.TText): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return isCompatibleWithNullable(left, right);

        case Type.ExtendedTypeKind.TextLiteral:
            return isCompatibleWithTextLiteral(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithTextLiteral(left: Type.PqType, right: Type.TextLiteral): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.TextLiteral:
            return isEqualType(left, right);

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithType(
    left: Type.PqType,
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
            return isCompatibleWithNullable(left, right);

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
    // !itemTypeCompatabilities.includes(undefined) && !itemTypeCompatabilities.includes(false);
    return itemTypeCompatabilities.find(value => value === undefined || value === false) !== undefined;
}
