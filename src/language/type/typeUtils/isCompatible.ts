// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, MapUtils } from "../../../common";
import { isEqualFunctionSignature, isEqualType } from "./isEqualType";
import { isFieldSpecificationList, isFunctionSignature } from "./typeUtils";

// Returns `${left} is compatible with ${right}. Eg.
// `Type.TextInstance is compatible with Type.AnyInstance` -> true
// `Type.AnyInstance is compatible with Type.TextInstance` -> false
// `Type.NullInstance is compatible with Type.AnyNonNull` -> false
// `Type.TextInstance is compatible with Type.AnyUnion([Type.TextInstance, Type.NumberInstance])` -> true
export function isCompatible(left: Type.TType, right: Type.TType): boolean | undefined {
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
        case Type.TypeKind.Number:
        case Type.TypeKind.Null:
        case Type.TypeKind.Text:
        case Type.TypeKind.Time:
            return (right.isNullable === true && left.kind === Type.TypeKind.Null) || isEqualType(left, right);

        case Type.TypeKind.Any:
            return isCompatibleWithAny(left, right);

        case Type.TypeKind.AnyNonNull:
            return left.kind !== Type.TypeKind.Null;

        case Type.TypeKind.Function:
            return isCompatibleWithFunction(left, right);

        case Type.TypeKind.List:
            return isCompatibleWithList(left, right);

        case Type.TypeKind.Record:
            return isCompatibleWithRecord(left, right);

        case Type.TypeKind.Table:
            return isCompatibleWithTable(left, right);

        case Type.TypeKind.Type:
            return isCompatibleWithType(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleWithFunctionSignature(
    left: Type.TType,
    right: Type.TType & Type.FunctionSignature,
): boolean {
    if ((left.isNullable === true && right.isNullable === false) || !isFunctionSignature(left)) {
        return false;
    }

    return isEqualFunctionSignature(left, right);
}

export function isCompatibleWithFunctionParameter(
    left: Type.FunctionParameter,
    right: Type.FunctionParameter,
): boolean {
    return (
        left.isNullable === right.isNullable &&
        left.isOptional === right.isOptional &&
        (right.maybeType === undefined || left.maybeType === right.maybeType)
    );
}

function isCompatibleWithAny(left: Type.TType, right: Type.Any | Type.AnyUnion): boolean | undefined {
    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.AnyUnion:
            const anyChecks: ReadonlyArray<boolean | undefined> = right.unionedTypePairs.map((subtype: Type.TType) =>
                isCompatible(left, subtype),
            );
            return anyChecks.includes(true);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithDefinedList(left: Type.TType, right: Type.DefinedList): boolean {
    if (left.kind !== Type.TypeKind.List) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedList:
            return isEqualType(left, right);

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithDefinedRecord(left: Type.TType, right: Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isCompatibleWithFieldSpecificationList(left, right);

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithDefinedTable(left: Type.TType, right: Type.DefinedTable): boolean {
    if (left.kind !== Type.TypeKind.Table) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedTable: {
            return isCompatibleWithFieldSpecificationList(left, right);
        }

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithFunction(left: Type.TType, right: Type.Function | Type.DefinedFunction): boolean {
    if (left.kind !== Type.TypeKind.Function) {
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

function isCompatibleWithList(left: Type.TType, right: Type.List | Type.DefinedList): boolean {
    if (left.kind !== Type.TypeKind.List) {
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

function isCompatibleWithListType(left: Type.TType, right: Type.ListType): boolean {
    if (left.kind !== Type.TypeKind.Type) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

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

function isCompatibleWithDefinedListType(left: Type.TType, right: Type.DefinedListType): boolean {
    if (left.kind !== Type.TypeKind.Type) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

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

function isCompatibleWithTableType(left: Type.TType, right: Type.TableType): boolean {
    if (left.kind !== Type.TypeKind.Type) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

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
    left: Type.TType,
    right: Type.TableTypePrimaryExpression,
): boolean | undefined {
    if (left.kind !== Type.TypeKind.Type) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

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

function isCompatibleWithPrimaryPrimitiveType(left: Type.TType, right: Type.PrimaryPrimitiveType): boolean {
    if (left.kind !== Type.TypeKind.Type) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

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

function isCompatibleWithRecordType(left: Type.TType, right: Type.RecordType): boolean {
    if (left.kind !== Type.TypeKind.Type) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

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

function isCompatibleWithRecord(left: Type.TType, right: Type.Record | Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isCompatibleWithDefinedRecord(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithTable(left: Type.TType, right: Type.Table | Type.DefinedTable): boolean {
    if (left.kind !== Type.TypeKind.Table) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedTable:
            return isCompatibleWithDefinedTable(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithType(
    left: Type.TType,
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
    if (left.kind !== Type.TypeKind.Type) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

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

// TODO: decide what a compatible FieldSpecificationList should look like
function isCompatibleWithFieldSpecificationList(
    left: Type.TType,
    right: Type.TType & Type.FieldSpecificationList,
): boolean {
    if ((left.isNullable === true && right.isNullable === false) || !isFieldSpecificationList(left)) {
        return false;
    }

    return MapUtils.isSubsetMap(left.fields, right.fields, (leftValue: Type.TType, rightValue: Type.TType) =>
        isEqualType(leftValue, rightValue),
    );
}

function isDefinedListTypeCompatibleWithListType(definedList: Type.DefinedListType, listType: Type.ListType): boolean {
    const itemTypeCompatabilities: ReadonlyArray<boolean | undefined> = definedList.itemTypes.map(itemType =>
        isCompatible(itemType, listType.itemType),
    );
    // !itemTypeCompatabilities.includes(undefined) && !itemTypeCompatabilities.includes(false);
    return itemTypeCompatabilities.find(value => value === undefined || value === false) !== undefined;
}
