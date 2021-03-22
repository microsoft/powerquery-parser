// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { ArrayUtils, ImmutableSet } from "../../../common";
import {
    AnyCategory,
    categorize,
    CategorizedPqTypes,
    FunctionCategory,
    ListCategory,
    NumberCategory,
    RecordCategory,
    TableCategory,
    TextCategory,
    TypeCategory,
} from "./categorize";
import { isEqualType } from "./isEqualType";

export function simplify(types: ReadonlyArray<Type.PqType>): ReadonlyArray<Type.PqType> {
    const categorized: CategorizedPqTypes = categorize(types);

    // If an `any` exists then that's as simplified as we can make it.
    const maybeAny: Type.Any | undefined = maybeFindAnyPrimitive(categorized);
    if (maybeAny) {
        return [maybeAny];
    }

    const partial: Type.PqType[] = [
        ...(categorized.maybeAction?.primitives.values() ?? []),
        ...(categorized.maybeAnyNonNull?.primitives.values() ?? []),
        ...(categorized.maybeBinary?.primitives.values() ?? []),
        ...(categorized.maybeDate?.primitives.values() ?? []),
        ...(categorized.maybeDateTime?.primitives.values() ?? []),
        ...(categorized.maybeDateTimeZone?.primitives.values() ?? []),
        ...(categorized.maybeDuration?.primitives.values() ?? []),
        ...(categorized.maybeLogical?.primitives.values() ?? []),
        ...(categorized.maybeNone?.primitives.values() ?? []),
        ...(categorized.maybeNotApplicable?.primitives.values() ?? []),
        ...(categorized.maybeNull?.primitives.values() ?? []),
        ...(categorized.maybeTime?.primitives.values() ?? []),
        ...(categorized.maybeUnknown?.primitives.values() ?? []),

        ...simplifyFunctionCategory(categorized.maybeFunction),
        ...simplifyListCategory(categorized.maybeList),
        ...simplifyNumberCategory(categorized.maybeNumber),
        ...simplifyRecordCategory(categorized.maybeRecord),
        ...simplifyTableCategory(categorized.maybeTable),
        ...simplifyTextCategory(categorized.maybeText),
        ...simplifyTypeCategory(categorized.maybeType),
    ];

    for (const flattenedValue of simplifyAnyCategory(categorized.maybeAny)) {
        if (!ArrayUtils.includesUnique(partial, flattenedValue, isEqualType)) {
            partial.push(flattenedValue);
        }
    }

    return partial;
}

// Returns the first nullable instance if one exists,
// otherwise returns the first element in the collection.
function firstNullableElseFirst<T extends Type.PqType>(immutableSet: ImmutableSet<T>): T | undefined {
    const setValues: ReadonlyArray<T> = [...immutableSet.values()];

    for (const item of setValues) {
        if (item.isNullable) {
            return item;
        }
    }

    return setValues[0];
}

function maybeFindAnyPrimitive(categorized: CategorizedPqTypes): Type.Any | undefined {
    const maybeAnySet: ImmutableSet<Type.Any> | undefined = categorized.maybeAny?.primitives;
    if (maybeAnySet === undefined) {
        return undefined;
    }

    return firstNullableElseFirst(maybeAnySet);
}

function simplifyAnyCategory(maybeCategory: AnyCategory | undefined): ReadonlyArray<Type.PqType> {
    if (!maybeCategory?.flattenedAnyUnions) {
        return [];
    } else {
        return [...maybeCategory?.flattenedAnyUnions.values()];
    }
}

function simplifyFunctionCategory(maybeCategory: FunctionCategory | undefined): ReadonlyArray<Type.TFunction> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedFunctions) : [];
}

function simplifyListCategory(maybeCategory: ListCategory | undefined): ReadonlyArray<Type.TList> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedLists) : [];
}

function simplifyNumberCategory(maybeCategory: NumberCategory | undefined): ReadonlyArray<Type.TNumber> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.literals) : [];
}

function simplifyRecordCategory(maybeCategory: RecordCategory | undefined): ReadonlyArray<Type.TRecord> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedRecords) : [];
}

function simplifyTableCategory(maybeCategory: TableCategory | undefined): ReadonlyArray<Type.TTable> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedTables) : [];
}

function simplifyTextCategory(maybeCategory: TextCategory | undefined): ReadonlyArray<Type.TText> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.literals) : [];
}

function simplifyTypeCategory(maybeCategory: TypeCategory | undefined): ReadonlyArray<Type.PqType> {
    if (maybeCategory === undefined) {
        return [];
    } else if (maybeCategory.primitives.size) {
        const maybeType: Type.Type | undefined | undefined = firstNullableElseFirst(maybeCategory.primitives);
        return maybeType ? [maybeType] : [];
    } else {
        return [
            ...maybeCategory.definedListTypes.values(),
            ...maybeCategory.functionTypes.values(),
            ...maybeCategory.listTypes.values(),
            ...maybeCategory.primaryPrimitiveTypes.values(),
            ...maybeCategory.recordTypes.values(),
            ...maybeCategory.tablePrimaryExpressionTypes.values(),
            ...maybeCategory.tableTypes.values(),
        ];
    }
}

function simplifyExtendedType<T extends Type.PqType, L extends Type.PqType>(
    primitives: ImmutableSet<T>,
    literals: ImmutableSet<L>,
): ReadonlyArray<T> | ReadonlyArray<L> {
    if (primitives.size) {
        const maybeType: T | undefined = firstNullableElseFirst(primitives);
        return maybeType ? [maybeType] : [];
    } else if (literals.size) {
        return [...literals.values()];
    } else {
        return [];
    }
}
