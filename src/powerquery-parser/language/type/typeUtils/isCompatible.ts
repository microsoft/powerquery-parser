// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, MapUtils } from "../../../common";
import { isEqualFunctionSignature, isEqualType } from "./isEqualType";
import { isFieldSpecificationList, isFunctionSignature } from "./isType";
import { Trace, TraceManager } from "../../../common/trace";
import { Type } from "..";
import { TypeUtilsTraceConstant } from "./typeTraceConstant";

// Returns `${left} is compatible with ${right}. Eg.
// `Type.TextInstance is compatible with Type.AnyInstance` -> true
// `Type.AnyInstance is compatible with Type.TextInstance` -> false
// `Type.NullInstance is compatible with Type.AnyNonNull` -> false
// `Type.TextInstance is compatible with Type.AnyUnion([Type.TextInstance, Type.NumberInstance])` -> true
export function isCompatible(
    left: Type.TPowerQueryType,
    right: Type.TPowerQueryType,
    traceManager: TraceManager,
    maybeCorrelationId: number | undefined,
): boolean | undefined {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.IsCompatible, isCompatible.name, maybeCorrelationId);

    let result: boolean | undefined;

    if (
        left.kind === Type.TypeKind.NotApplicable ||
        left.kind === Type.TypeKind.Unknown ||
        right.kind === Type.TypeKind.NotApplicable ||
        right.kind === Type.TypeKind.Unknown
    ) {
        result = undefined;
    } else if (
        left.kind === Type.TypeKind.None ||
        right.kind === Type.TypeKind.None ||
        (left.isNullable && !right.isNullable)
    ) {
        result = false;
    } else if (left.kind === Type.TypeKind.Null && right.isNullable) {
        result = true;
    } else {
        switch (right.kind) {
            case Type.TypeKind.Action:
            case Type.TypeKind.Binary:
            case Type.TypeKind.Date:
            case Type.TypeKind.DateTime:
            case Type.TypeKind.DateTimeZone:
            case Type.TypeKind.Duration:
            case Type.TypeKind.Time:
                result = isEqualType(left, right);
                break;

            case Type.TypeKind.Any:
                result = isCompatibleWithAny(left, right, traceManager, trace.id);
                break;

            case Type.TypeKind.AnyNonNull:
                result = left.kind !== Type.TypeKind.Null && !left.isNullable;
                break;

            case Type.TypeKind.Function:
                result = isCompatibleWithFunction(left, right);
                break;

            case Type.TypeKind.List:
                result = isCompatibleWithList(left, right, traceManager, trace.id);
                break;

            case Type.TypeKind.Logical:
                result = isCompatibleWithPrimitiveOrLiteral(left, right);
                break;

            case Type.TypeKind.Number:
                result = isCompatibleWithPrimitiveOrLiteral(left, right);
                break;

            case Type.TypeKind.Null:
                result = left.kind === Type.TypeKind.Null;
                break;

            case Type.TypeKind.Record:
                result = isCompatibleWithRecord(left, right, traceManager, trace.id);
                break;

            case Type.TypeKind.Table:
                result = isCompatibleWithTable(left, right, traceManager, trace.id);
                break;

            case Type.TypeKind.Text:
                result = isCompatibleWithPrimitiveOrLiteral(left, right);
                break;

            case Type.TypeKind.Type:
                result = isCompatibleWithType(left, right, traceManager, trace.id);
                break;

            default:
                throw Assert.isNever(right);
        }
    }

    trace.exit();

    return result;
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
        return (
            !right.maybeType ||
            right.maybeType === Type.TypeKind.Any ||
            left.kind === Type.TypeKind.Any ||
            (left.kind === Type.TypeKind.Null && right.isNullable) ||
            left.kind === right.maybeType
        );
    }
}

function isCompatibleWithAny(
    left: Type.TPowerQueryType,
    right: Type.TAny,
    traceManager: TraceManager,
    correlationId: number,
): boolean | undefined {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithAny.name,
        correlationId,
    );

    let result: boolean | undefined;

    switch (right.maybeExtendedKind) {
        case undefined:
            result = true;
            break;

        case Type.ExtendedTypeKind.AnyUnion:
            result = isCompatibleWithAnyUnion(left, right, traceManager, trace.id);
            break;

        default:
            throw Assert.isNever(right);
    }

    trace.exit();

    return result;
}

function isCompatibleWithAnyUnion(
    left: Type.TPowerQueryType,
    right: Type.AnyUnion,
    traceManager: TraceManager,
    correlationId: number,
): boolean | undefined {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithAnyUnion.name,
        correlationId,
    );

    for (const subtype of right.unionedTypePairs) {
        if (isCompatible(left, subtype, traceManager, trace.id)) {
            trace.exit();

            return true;
        }
    }

    trace.exit();

    return false;
}

function isCompatibleWithDefinedList(
    left: Type.TPowerQueryType,
    right: Type.DefinedList,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithDefinedList.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case undefined:
                result = false;
                break;

            case Type.ExtendedTypeKind.DefinedList: {
                result = isCompatibleDefinedListOrDefinedListType(left, right, traceManager, trace.id);
                break;
            }

            default:
                throw Assert.isNever(left);
        }
    }

    trace.exit();

    return result;
}

function isCompatibleWithDefinedListType(
    left: Type.TPowerQueryType,
    right: Type.DefinedListType,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithDefinedListType.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case Type.ExtendedTypeKind.DefinedListType:
                result = isCompatibleDefinedListOrDefinedListType(left, right, traceManager, trace.id);
                break;

            case Type.ExtendedTypeKind.ListType:
                result = isDefinedListTypeCompatibleWithListType(right, left, traceManager, trace.id);
                break;

            case undefined:
            case Type.ExtendedTypeKind.FunctionType:
            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            case Type.ExtendedTypeKind.RecordType:
            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            case Type.ExtendedTypeKind.TableType:
                result = false;
                break;

            default:
                throw Assert.isNever(left);
        }
    }

    trace.exit();

    return result;
}

function isCompatibleWithDefinedRecord(
    left: Type.TPowerQueryType,
    right: Type.DefinedRecord,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithDefinedRecord.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case undefined:
                result = false;
                break;

            case Type.ExtendedTypeKind.DefinedRecord:
                result = isCompatibleWithFieldSpecificationList(left, right, traceManager, trace.id);
                break;

            default:
                throw Assert.isNever(left);
        }
    }

    trace.exit();

    return result;
}

function isCompatibleWithDefinedTable(
    left: Type.TPowerQueryType,
    right: Type.DefinedTable,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithDefinedTable.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case undefined:
                result = false;
                break;

            case Type.ExtendedTypeKind.DefinedTable: {
                result = isCompatibleWithFieldSpecificationList(left, right, traceManager, trace.id);
                break;
            }

            default:
                throw Assert.isNever(left);
        }
    }

    trace.exit();

    return result;
}

// TODO: decide what a compatible FieldSpecificationList should look like
function isCompatibleWithFieldSpecificationList(
    left: Type.TPowerQueryType,
    right: Type.TPowerQueryType & Type.TFieldSpecificationList,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithFieldSpecificationList.name,
        correlationId,
    );

    let result: boolean;

    if (!isFieldSpecificationList(left)) {
        result = false;
    } else {
        result = MapUtils.isSubsetMap(
            left.fields,
            right.fields,
            (leftValue: Type.TPowerQueryType, rightValue: Type.TPowerQueryType) => {
                const subsetResult: boolean | undefined = isCompatible(leftValue, rightValue, traceManager, trace.id);

                return subsetResult !== undefined && subsetResult;
            },
        );
    }

    trace.exit();

    return result;
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

function isCompatibleWithList(
    left: Type.TPowerQueryType,
    right: Type.TList,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithList.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (right.maybeExtendedKind) {
            case undefined:
                result = left.maybeExtendedKind === undefined;
                break;

            case Type.ExtendedTypeKind.DefinedList:
                result = isCompatibleWithDefinedList(left, right, traceManager, trace.id);
                break;

            default:
                throw Assert.isNever(right);
        }
    }

    trace.exit();

    return result;
}

function isCompatibleWithListType(
    left: Type.TPowerQueryType,
    right: Type.ListType,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithListType.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case Type.ExtendedTypeKind.DefinedListType:
                result = isDefinedListTypeCompatibleWithListType(left, right, traceManager, trace.id);
                break;

            case Type.ExtendedTypeKind.ListType:
                result = isEqualType(left.itemType, right.itemType);
                break;

            case undefined:
            case Type.ExtendedTypeKind.FunctionType:
            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            case Type.ExtendedTypeKind.RecordType:
            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            case Type.ExtendedTypeKind.TableType:
                result = false;
                break;

            default:
                throw Assert.isNever(left);
        }
    }

    trace.exit();

    return result;
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

function isCompatibleWithRecord(
    left: Type.TPowerQueryType,
    right: Type.TRecord,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithRecord.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (right.maybeExtendedKind) {
            case undefined:
                result = true;
                break;

            case Type.ExtendedTypeKind.DefinedRecord:
                result = isCompatibleWithDefinedRecord(left, right, traceManager, trace.id);
                break;

            default:
                throw Assert.isNever(right);
        }
    }

    trace.exit();

    return result;
}

function isCompatibleWithRecordType(
    left: Type.TPowerQueryType,
    right: Type.RecordType,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithRecordType.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case Type.ExtendedTypeKind.RecordType:
                result = isCompatibleWithFieldSpecificationList(left, right, traceManager, trace.id);
                break;

            case undefined:
            case Type.ExtendedTypeKind.DefinedListType:
            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            case Type.ExtendedTypeKind.ListType:
            case Type.ExtendedTypeKind.FunctionType:
            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            case Type.ExtendedTypeKind.TableType:
                result = false;
                break;

            default:
                throw Assert.isNever(left);
        }
    }

    trace.exit();

    return result;
}

function isCompatibleWithTable(
    left: Type.TPowerQueryType,
    right: Type.TTable,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithTable.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (right.maybeExtendedKind) {
            case undefined:
                result = true;
                break;

            case Type.ExtendedTypeKind.DefinedTable:
                result = isCompatibleWithDefinedTable(left, right, traceManager, trace.id);
                break;

            default:
                throw Assert.isNever(right);
        }
    }

    trace.exit();

    return result;
}

function isCompatibleWithTableType(
    left: Type.TPowerQueryType,
    right: Type.TableType,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithTableType.name,
        correlationId,
    );

    let result: boolean;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case undefined:
                result = false;
                break;

            case Type.ExtendedTypeKind.TableType:
                result = isCompatibleWithFieldSpecificationList(left, right, traceManager, trace.id);
                break;

            case Type.ExtendedTypeKind.DefinedListType:
            case Type.ExtendedTypeKind.ListType:
            case Type.ExtendedTypeKind.FunctionType:
            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            case Type.ExtendedTypeKind.RecordType:
            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
                result = false;
                break;

            default:
                throw Assert.isNever(left);
        }
    }

    return result;
}

function isCompatibleWithTableTypePrimaryExpression(
    left: Type.TPowerQueryType,
    right: Type.TableTypePrimaryExpression,
    traceManager: TraceManager,
    correlationId: number,
): boolean | undefined {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithTableTypePrimaryExpression.name,
        correlationId,
    );

    let result: boolean | undefined;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (left.maybeExtendedKind) {
            case undefined:
                result = false;
                break;

            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
                result = isCompatible(left.primaryExpression, right.primaryExpression, traceManager, correlationId);
                break;

            case Type.ExtendedTypeKind.DefinedListType:
            case Type.ExtendedTypeKind.ListType:
            case Type.ExtendedTypeKind.FunctionType:
            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            case Type.ExtendedTypeKind.RecordType:
            case Type.ExtendedTypeKind.TableType:
                result = false;
                break;

            default:
                throw Assert.isNever(left);
        }
    }

    trace.exit();

    return result;
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
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleDefinedListOrDefinedListType.name,
        correlationId,
    );

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
        trace.exit();

        return false;
    }

    const numElements: number = leftElements.length;

    for (let index: number = 0; index < numElements; index += 1) {
        if (!isCompatible(leftElements[index], rightElements[index], traceManager, trace.id)) {
            trace.exit();

            return false;
        }
    }

    trace.exit();

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
    traceManager: TraceManager,
    correlationId: number,
): boolean | undefined {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isCompatibleWithType.name,
        correlationId,
    );

    let result: boolean | undefined;

    if (left.kind !== right.kind) {
        result = false;
    } else {
        switch (right.maybeExtendedKind) {
            case undefined:
                result = true;
                break;

            case Type.ExtendedTypeKind.FunctionType:
                result = isCompatibleWithFunctionSignature(left, right);
                break;

            case Type.ExtendedTypeKind.ListType:
                result = isCompatibleWithListType(left, right, traceManager, trace.id);
                break;

            case Type.ExtendedTypeKind.DefinedListType:
                result = isCompatibleWithDefinedListType(left, right, traceManager, trace.id);
                break;

            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
                result = isCompatibleWithPrimaryPrimitiveType(left, right);
                break;

            case Type.ExtendedTypeKind.RecordType:
                result = isCompatibleWithRecordType(left, right, traceManager, trace.id);
                break;

            case Type.ExtendedTypeKind.TableType:
                result = isCompatibleWithTableType(left, right, traceManager, trace.id);
                break;

            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
                result = isCompatibleWithTableTypePrimaryExpression(left, right, traceManager, trace.id);
                break;

            default:
                throw Assert.isNever(right);
        }
    }

    trace.exit();

    return result;
}

function isDefinedListTypeCompatibleWithListType(
    definedList: Type.DefinedListType,
    listType: Type.ListType,
    traceManager: TraceManager,
    correlationId: number,
): boolean {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.IsCompatible,
        isDefinedListTypeCompatibleWithListType.name,
        correlationId,
    );

    const itemTypeCompatabilities: ReadonlyArray<boolean | undefined> = definedList.itemTypes.map(
        (itemType: Type.TPowerQueryType) => isCompatible(itemType, listType.itemType, traceManager, trace.id),
    );

    const result: boolean = Boolean(
        itemTypeCompatabilities.find((value: boolean | undefined) => value === undefined || value === false),
    );

    trace.exit();

    return result;
}
