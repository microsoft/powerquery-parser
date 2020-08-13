// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, MapUtils } from "../../../common";
import { isEqualDefinedList, isEqualFunctionSignature, isEqualType } from "./isEqualType";
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
    } else if (left.kind === Type.TypeKind.Null && right.kind === Type.TypeKind.AnyNonNull) {
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
            return isCompatibleOfAny(left, right);

        case Type.TypeKind.AnyNonNull:
            return left.kind !== Type.TypeKind.Null;

        case Type.TypeKind.Function:
            return isCompatibleOfFunction(left, right);

        case Type.TypeKind.List:
            return isCompatibleOfList(left, right);

        case Type.TypeKind.Record:
            return isCompatibleOfRecord(left, right);

        case Type.TypeKind.Table:
            return isCompatibleOfTable(left, right);

        case Type.TypeKind.Type:
            return isCompatibleOfType(left, right);

        case Type.TypeKind.None:
            return false;

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleOfAny(left: Type.TType, right: Type.Any | Type.AnyUnion): boolean {
    if (left.kind !== Type.TypeKind.Any || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.AnyUnion:
            const anyChecks: ReadonlyArray<boolean | undefined> = right.unionedTypePairs.map((subtype: Type.TType) =>
                isCompatible(left, subtype),
            );
            return anyChecks.includes(true);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleOfDefinedList(left: Type.TType, right: Type.DefinedList): boolean {
    if (left.kind !== Type.TypeKind.List || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedList:
            return isEqualDefinedList(left, right);

        default:
            throw Assert.isNever(left);
    }
}

export function isCompatibleOfDefinedRecord(left: Type.TType, right: Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isCompatibleOfFieldSpecificationList(left, right);

        default:
            throw Assert.isNever(left);
    }
}

export function isCompatibleOfDefinedTable(left: Type.TType, right: Type.DefinedTable): boolean {
    if (left.kind !== Type.TypeKind.Table || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedTable: {
            return isCompatibleOfFieldSpecificationList(left, right);
        }

        default:
            throw Assert.isNever(left);
    }
}

export function isCompatibleOfFunction(left: Type.TType, right: Type.Function | Type.DefinedFunction): boolean {
    if (left.kind !== Type.TypeKind.Function || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedFunction:
            return isCompatibleOfFunctionSignature(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleOfList(left: Type.TType, right: Type.List | Type.DefinedList): boolean {
    if (left.kind !== Type.TypeKind.List || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedList:
            return isCompatibleOfDefinedList(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleOfListType(left: Type.TType, right: Type.ListType): boolean {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

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

export function isCompatibleOfTableType(left: Type.TType, right: Type.TableType): boolean {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.TableType:
            return isCompatibleOfFieldSpecificationList(left, right);

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

export function isCompatibleOfTableTypePrimaryExpression(
    left: Type.TType,
    right: Type.TableTypePrimaryExpression,
): boolean | undefined {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return isCompatible(left.primaryExpression, right.primaryExpression);

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

export function isCompatibleOfPrimaryPrimitiveType(left: Type.TType, right: Type.PrimaryPrimitiveType): boolean {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return left.primitiveType === right.primitiveType;

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

export function isCompatibleOfRecordType(left: Type.TType, right: Type.RecordType): boolean {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.RecordType:
            return isCompatibleOfFieldSpecificationList(left, right);

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

export function isCompatibleOfRecord(left: Type.TType, right: Type.Record | Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isCompatibleOfDefinedRecord(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleOfTable(left: Type.TType, right: Type.Table | Type.DefinedTable): boolean {
    if (left.kind !== Type.TypeKind.Table || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedTable:
            return isCompatibleOfDefinedTable(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isCompatibleOfType(
    left: Type.TType,
    right:
        | Type.Type
        | Type.FunctionType
        | Type.ListType
        | Type.PrimaryPrimitiveType
        | Type.RecordType
        | Type.TableType
        | Type.TableTypePrimaryExpression,
): boolean | undefined {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.FunctionType:
            return isCompatibleOfFunctionSignature(left, right);

        case Type.ExtendedTypeKind.ListType:
            return isCompatibleOfListType(left, right);

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return isCompatibleOfPrimaryPrimitiveType(left, right);

        case Type.ExtendedTypeKind.RecordType:
            return isCompatibleOfRecordType(left, right);

        case Type.ExtendedTypeKind.TableType:
            return isCompatibleOfTableType(left, right);

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return isCompatibleOfTableTypePrimaryExpression(left, right);

        default:
            throw Assert.isNever(right);
    }
}

// TODO: decide what a compatible FieldSpecificationList should look like
function isCompatibleOfFieldSpecificationList(
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

// TODO: decide what a compatible FieldSpecificationList should look like
function isCompatibleOfFunctionSignature(left: Type.TType, right: Type.TType & Type.FunctionSignature): boolean {
    if ((left.isNullable === true && right.isNullable === false) || !isFunctionSignature(left)) {
        return false;
    }

    return isEqualFunctionSignature(left, right);
}
