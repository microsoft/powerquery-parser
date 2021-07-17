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
            return left.kind !== right.kind;

        case Type.TypeKind.Function:
            return isCompatibleWithFunction(left, right);

        case Type.TypeKind.List:
            return isCompatibleWithList(left, right);

        case Type.TypeKind.Logical:
            return isCompatibleWitLogical(left, right);

        case Type.TypeKind.Number:
            return isCompatibleWithNumber(left, right);

        case Type.TypeKind.Null:
            return left.kind === Type.TypeKind.Null;

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
    } else if (right.maybeType) {
        return left.kind === right.maybeType;
    } else {
        return true;
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
            if (left.elements.length !== right.elements.length) {
                return false;
            }

            const numElements: number = left.elements.length;
            for (let index: number = 0; index < numElements; index += 1) {
                if (!isCompatible(left.elements[index], right.elements[index])) {
                    return false;
                }
            }

            return true;
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
        (leftValue: Type.TPowerQueryType, rightValue: Type.TPowerQueryType) => isEqualType(leftValue, rightValue),
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

function isCompatibleWithPrimaryPrimitiveType(left: Type.TPowerQueryType, right: Type.PrimaryPrimitiveType): boolean {
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

function isCompatibleWitLogical(left: Type.TPowerQueryType, right: Type.TLogical): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.LogicalLiteral:
            return isCompatibleWithLogicalLiteral(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithLogicalLiteral(left: Type.TPowerQueryType, right: Type.LogicalLiteral): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.LogicalLiteral:
            return isEqualType(left, right);

        default:
            throw Assert.isNever(left);
    }
}

function isCompatibleWithNumber(left: Type.TPowerQueryType, right: Type.TNumber): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.NumberLiteral:
            return isCompatibleWithNumberLiteral(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithNumberLiteral(left: Type.TPowerQueryType, right: Type.NumberLiteral): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (left.maybeExtendedKind) {
        case undefined:
            return false;

        case Type.ExtendedTypeKind.NumberLiteral:
            return left.normalizedLiteral === right.normalizedLiteral;

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

function isCompatibleWithText(left: Type.TPowerQueryType, right: Type.TText): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    switch (right.maybeExtendedKind) {
        case undefined:
            return true;

        case Type.ExtendedTypeKind.TextLiteral:
            return isCompatibleWithTextLiteral(left, right);

        default:
            throw Assert.isNever(right);
    }
}

function isCompatibleWithTextLiteral(left: Type.TPowerQueryType, right: Type.TextLiteral): boolean {
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
    // !itemTypeCompatabilities.includes(undefined) && !itemTypeCompatabilities.includes(false);
    return itemTypeCompatabilities.find(value => value === undefined || value === false) !== undefined;
}
