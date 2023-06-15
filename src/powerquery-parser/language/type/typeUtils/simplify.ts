// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    AnyCategory,
    categorize,
    CategorizedPowerQueryTypes,
    FunctionCategory,
    ListCategory,
    LogicalCategory,
    NumberCategory,
    RecordCategory,
    TableCategory,
    TextCategory,
    TypeCategory,
} from "./categorize";
import { Trace, TraceManager } from "../../../common/trace";
import { ImmutableSet } from "../../../common";
import { isEqualType } from "./isEqualType";
import { Type } from "..";
import { TypeUtilsTraceConstant } from "./typeTraceConstant";

export function simplify(
    types: ReadonlyArray<Type.TPowerQueryType>,
    traceManager: TraceManager,
    correlationId: number | undefined,
): ReadonlyArray<Type.TPowerQueryType> {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.Simplify, simplify.name, correlationId);

    const categorized: CategorizedPowerQueryTypes = categorize(types, traceManager, trace.id);

    // If an `any` exists then that's as simplified as we can make it.
    const any: Type.Any | undefined = findAnyPrimitive(categorized);

    if (any) {
        return [any];
    }

    const partial: Type.TPowerQueryType[] = [
        ...(categorized.actions?.primitives.values() ?? []),
        ...(categorized.anyNonNulls?.primitives.values() ?? []),
        ...(categorized.binaries?.primitives.values() ?? []),
        ...(categorized.dates?.primitives.values() ?? []),
        ...(categorized.dateTimes?.primitives.values() ?? []),
        ...(categorized.dateTimeZones?.primitives.values() ?? []),
        ...(categorized.durations?.primitives.values() ?? []),
        ...(categorized.nones?.primitives.values() ?? []),
        ...(categorized.notApplicables?.primitives.values() ?? []),
        ...(categorized.nulls?.primitives.values() ?? []),
        ...(categorized.times?.primitives.values() ?? []),
        ...(categorized.unknowns?.primitives.values() ?? []),

        ...simplifyFunctionCategory(categorized.functions),
        ...simplifyListCategory(categorized.lists),
        ...simplifyLogicalCategory(categorized.logicals),
        ...simplifyNumberCategory(categorized.numbers),
        ...simplifyRecordCategory(categorized.records),
        ...simplifyTableCategory(categorized.tables),
        ...simplifyTextCategory(categorized.texts),
        ...simplifyTypeCategory(categorized.types),
    ];

    for (const flattenedValue of simplifyAnyCategory(categorized.anys)) {
        if (!partial.find((item: Type.TPowerQueryType) => isEqualType(item, flattenedValue))) {
            partial.push(flattenedValue);
        }
    }

    trace.exit();

    return partial;
}

// Returns the first nullable instance if one exists,
// otherwise returns the first element in the collection.
function firstNullableElseFirst<T extends Type.TPowerQueryType>(immutableSet: ImmutableSet<T>): T | undefined {
    const setValues: ReadonlyArray<T> = [...immutableSet.values()];

    for (const item of setValues) {
        if (item.isNullable) {
            return item;
        }
    }

    return setValues[0];
}

function findAnyPrimitive(categorized: CategorizedPowerQueryTypes): Type.Any | undefined {
    const anySet: ImmutableSet<Type.Any> | undefined = categorized.anys?.primitives;

    return anySet ? firstNullableElseFirst(anySet) : undefined;
}

function simplifyAnyCategory(category: AnyCategory | undefined): ReadonlyArray<Type.TPowerQueryType> {
    if (!category?.flattenedAnyUnions) {
        return [];
    } else {
        const flattnedAnyUnions: ImmutableSet<Type.TPowerQueryType> = category?.flattenedAnyUnions;

        return [...flattnedAnyUnions.values()];
    }
}

function simplifyFunctionCategory(category: FunctionCategory | undefined): ReadonlyArray<Type.TFunction> {
    return category ? simplifyExtendedType(category.primitives, category.definedFunctions) : [];
}

function simplifyListCategory(category: ListCategory | undefined): ReadonlyArray<Type.TList> {
    return category ? simplifyExtendedType(category.primitives, category.definedLists) : [];
}

function simplifyLogicalCategory(category: LogicalCategory | undefined): ReadonlyArray<Type.TLogical> {
    if (category === undefined) {
        return [];
    } else if (
        (category.hasFalsyNullableLiteral || category.hasFalsyNonNullableLiteral) &&
        (category.hasTruthyNullableLiteral || category.hasTruthyNonNullableLiteral)
    ) {
        return category.hasFalsyNullableLiteral || category.hasTruthyNullableLiteral
            ? [Type.NullableLogicalInstance]
            : [Type.LogicalInstance];
    } else {
        const type: Type.Logical | undefined = firstNullableElseFirst(category.primitives);

        return type ? [type] : [];
    }
}

function simplifyNumberCategory(category: NumberCategory | undefined): ReadonlyArray<Type.TNumber> {
    return category ? simplifyExtendedType(category.primitives, category.literals) : [];
}

function simplifyRecordCategory(category: RecordCategory | undefined): ReadonlyArray<Type.TRecord> {
    return category ? simplifyExtendedType(category.primitives, category.definedRecords) : [];
}

function simplifyTableCategory(category: TableCategory | undefined): ReadonlyArray<Type.TTable> {
    return category ? simplifyExtendedType(category.primitives, category.definedTables) : [];
}

function simplifyTextCategory(category: TextCategory | undefined): ReadonlyArray<Type.TText> {
    return category ? simplifyExtendedType(category.primitives, category.literals) : [];
}

function simplifyTypeCategory(category: TypeCategory | undefined): ReadonlyArray<Type.TPowerQueryType> {
    if (category === undefined) {
        return [];
    } else if (category.primitives.size) {
        const typeType: Type.Type | undefined | undefined = firstNullableElseFirst(category.primitives);

        return typeType ? [typeType] : [];
    } else {
        return [
            ...category.definedListTypes.values(),
            ...category.functionTypes.values(),
            ...category.listTypes.values(),
            ...category.primaryPrimitiveTypes.values(),
            ...category.recordTypes.values(),
            ...category.tablePrimaryExpressionTypes.values(),
            ...category.tableTypes.values(),
        ];
    }
}

function simplifyExtendedType<T extends Type.TPowerQueryType, L extends Type.TPowerQueryType>(
    primitives: ImmutableSet<T>,
    literals: ImmutableSet<L>,
): ReadonlyArray<T> | ReadonlyArray<L> {
    if (primitives.size) {
        const type: T | undefined = firstNullableElseFirst(primitives);

        return type ? [type] : [];
    } else if (literals.size) {
        return [...literals.values()];
    } else {
        return [];
    }
}
