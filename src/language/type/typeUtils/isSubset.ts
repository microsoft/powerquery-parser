// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, MapUtils } from "../../../common";
import { isEqualDefinedList, isEqualFunctionSignature, isEqualType } from "./isEqualType";
import { isFieldSpecificationList, isFunctionSignature } from "./typeUtils";

// Returns `${left} is a subset of ${right}. Eg.
// `Type.TextInstance is a subset of Type.AnyInstance` -> true
// `Type.AnyInstance is a subset of Type.TextInstance` -> false
// `Type.NullInstance is a subset of Type.AnyNonNull` -> false
// `Type.TextInstance is a subset of Type.AnyUnion([Type.TextInstance, Type.NumberInstance])` -> true
export function isSubset(left: Type.TType, right: Type.TType): boolean | undefined {
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
            return isSubsetOfAny(left, right);

        case Type.TypeKind.AnyNonNull:
            return left.kind !== Type.TypeKind.Null;

        case Type.TypeKind.Function:
            return isSubsetOfFunction(left, right);

        case Type.TypeKind.List:
            return isSubsetOfList(left, right);

        case Type.TypeKind.Record:
            return isSubsetOfRecord(left, right);

        case Type.TypeKind.Table:
            return isSubsetOfTable(left, right);

        case Type.TypeKind.Type:
            return isSubsetOfType(left, right);

        case Type.TypeKind.None:
            return false;

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfAny(left: Type.TType, right: Type.Any | Type.AnyUnion): boolean {
    if (left.kind !== Type.TypeKind.Any || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.AnyUnion:
            const anyChecks: ReadonlyArray<boolean | undefined> = right.unionedTypePairs.map((subtype: Type.TType) =>
                isSubset(left, subtype),
            );
            return anyChecks.includes(true);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfDefinedList(left: Type.TType, right: Type.DefinedList): boolean {
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

export function isSubsetOfDefinedRecord(left: Type.TType, right: Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isSubsetOfFieldSpecificationList(left, right);

        default:
            throw Assert.isNever(left);
    }
}

export function isSubsetOfDefinedTable(left: Type.TType, right: Type.DefinedTable): boolean {
    if (left.kind !== Type.TypeKind.Table || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedTable: {
            return isSubsetOfFieldSpecificationList(left, right);
        }

        default:
            throw Assert.isNever(left);
    }
}

export function isSubsetOfFunction(left: Type.TType, right: Type.Function | Type.DefinedFunction): boolean {
    if (left.kind !== Type.TypeKind.Function || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedFunction:
            return isSubsetOfFunctionSignature(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfList(left: Type.TType, right: Type.List | Type.DefinedList): boolean {
    if (left.kind !== Type.TypeKind.List || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedList:
            return isSubsetOfDefinedList(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfListType(left: Type.TType, right: Type.ListType): boolean {
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

export function isSubsetOfTableType(left: Type.TType, right: Type.TableType): boolean {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.TableType:
            return isSubsetOfFieldSpecificationList(left, right);

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

export function isSubsetOfTableTypePrimaryExpression(
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
            return isSubset(left.primaryExpression, right.primaryExpression);

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

export function isSubsetOfPrimaryPrimitiveType(left: Type.TType, right: Type.PrimaryPrimitiveType): boolean {
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

export function isSubsetOfRecordType(left: Type.TType, right: Type.RecordType): boolean {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.RecordType:
            return isSubsetOfFieldSpecificationList(left, right);

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

export function isSubsetOfRecord(left: Type.TType, right: Type.Record | Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedRecord:
            return isSubsetOfDefinedRecord(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfTable(left: Type.TType, right: Type.Table | Type.DefinedTable): boolean {
    if (left.kind !== Type.TypeKind.Table || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return left.maybeExtendedKind === undefined;

        case Type.ExtendedTypeKind.DefinedTable:
            return isSubsetOfDefinedTable(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfType(
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
            return isSubsetOfFunctionSignature(left, right);

        case Type.ExtendedTypeKind.ListType:
            return isSubsetOfListType(left, right);

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            return isSubsetOfPrimaryPrimitiveType(left, right);

        case Type.ExtendedTypeKind.RecordType:
            return isSubsetOfRecordType(left, right);

        case Type.ExtendedTypeKind.TableType:
            return isSubsetOfTableType(left, right);

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            return isSubsetOfTableTypePrimaryExpression(left, right);

        default:
            throw Assert.isNever(right);
    }
}

// TODO: decide what a subset of this should be
function isSubsetOfFieldSpecificationList(left: Type.TType, right: Type.TType & Type.FieldSpecificationList): boolean {
    if ((left.isNullable === true && right.isNullable === false) || !isFieldSpecificationList(left)) {
        return false;
    }

    return MapUtils.isSubsetMap(left.fields, right.fields, (leftValue: Type.TType, rightValue: Type.TType) =>
        isEqualType(leftValue, rightValue),
    );
}

// TODO: decide what a subset of return type looks like
function isSubsetOfFunctionSignature(left: Type.TType, right: Type.TType & Type.FunctionSignature): boolean {
    if ((left.isNullable === true && right.isNullable === false) || !isFunctionSignature(left)) {
        return false;
    }

    return isEqualFunctionSignature(left, right);
}
