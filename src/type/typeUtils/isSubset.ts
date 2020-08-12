// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, MapUtils } from "../../common";
import { isEqualType } from "./isEqualType";
import { isFieldSpecificationList } from "./typeUtils";

// Returns `${left} is a subset of ${right}. Eg.
// `Type.TextInstance is a subset of Type.AnyInstance` -> true
// `Type.AnyInstance is a subset of Type.TextInstance` -> false
// `Type.NullInstance is a subset of Type.AnyNonNull` -> false
// `Type.TextInstance is a subset of Type.AnyUnion([Type.TextInstance, Type.NumberInstance])` -> true
export function isSusbset(left: Type.TType, right: Type.TType): boolean | undefined {
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

        // TODO: How should a function be a subset of another?
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
    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.AnyUnion:
            const anyChecks: ReadonlyArray<boolean | undefined> = right.unionedTypePairs.map((subtype: Type.TType) =>
                isSusbset(left, subtype),
            );
            return anyChecks.includes(true);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfDefinedRecord(left: Type.TType, right: Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

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

export function isSubsetOfFunction(left: Type.TType, right: Type.Function | Type.DefinedFunction): boolean | undefined {
    if (left.kind !== Type.TypeKind.List || (left.isNullable === true && right.isNullable === false)) {
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
            return true;

        case Type.ExtendedTypeKind.DefinedList:
            return isEqualType(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfRecord(left: Type.TType, right: Type.Record | Type.DefinedRecord): boolean {
    if (left.kind !== Type.TypeKind.Record || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

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
            return true;

        case Type.ExtendedTypeKind.DefinedTable:
            return isSubsetOfDefinedTable(left, right);

        default:
            throw Assert.isNever(right);
    }
}

export function isSubsetOfType<T extends Type.TType>(
    left: Type.TType,
    right: Type.Type | Type.DefinedType<T> | Type.FunctionType | Type.ListType | Type.RecordType | Type.TableType,
): boolean | undefined {
    if (left.kind !== Type.TypeKind.Type || (left.isNullable === true && right.isNullable === false)) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.DefinedType:
            return;

        case Type.ExtendedTypeKind.FunctionType:
            return isSubsetOfFunctionSignature(left, right);

        case Type.ExtendedTypeKind.ListType:
            return left.maybeExtendedKind === right.maybeExtendedKind ? isEqualType(left, right) : false;

        case Type.ExtendedTypeKind.RecordType:
        case Type.ExtendedTypeKind.TableType:
            return isSubsetOfFieldSpecificationList(left, right);

        default:
            throw Assert.isNever(right);
    }
}

// TODO: decide what a subset of this should be
function isSubsetOfFieldSpecificationList(left: Type.TType, right: Type.FieldSpecificationList): boolean {
    if (!isFieldSpecificationList(left)) {
        return false;
    }

    return MapUtils.isSubsetMap(left.fields, right.fields, (leftValue: Type.TType, rightValue: Type.TType) =>
        isEqualType(leftValue, rightValue),
    );
}

// TODO: decide what a subset of return type looks like
function isSubsetOfFunctionSignature(_left: Type.TType, _right: Type.FunctionSignature): undefined {
    return undefined;
}
