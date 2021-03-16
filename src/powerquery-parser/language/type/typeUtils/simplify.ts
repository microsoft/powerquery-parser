// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { ImmutableSet } from "../../../common";
import {
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

export function simplify(types: ReadonlyArray<Type.PqType>): ReadonlyArray<Type.PqType> {
    const categorized: CategorizedPqTypes = categorize(types);

    // If an `any` exists then that's as simplified as we can make it.
    const maybeAny: Type.Any | undefined = maybeFindAny(categorized);
    if (maybeAny) {
        return [maybeAny];
    }

    return [
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

        ...maybeSimplifyFunction(categorized.maybeFunction),
        ...maybeSimplifyList(categorized.maybeList),
        ...maybeSimplifyNumber(categorized.maybeNumber),
        ...maybeSimplifyRecord(categorized.maybeRecord),
        ...maybeSimplifyTable(categorized.maybeTable),
        ...maybeSimplifyText(categorized.maybeText),
        ...maybeSimplifyType(categorized.maybeType),
    ];
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

function maybeFindAny(categorized: CategorizedPqTypes): Type.Any | undefined {
    const maybeAnySet: ImmutableSet<Type.Any> | undefined = categorized.maybeAny?.primitives;
    if (maybeAnySet === undefined) {
        return undefined;
    }

    return firstNullableElseFirst(maybeAnySet);
}

function maybeSimplifyFunction(maybeCategory: FunctionCategory | undefined): ReadonlyArray<Type.TFunction> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedFunctions) : [];
}

function maybeSimplifyList(maybeCategory: ListCategory | undefined): ReadonlyArray<Type.TList> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedLists) : [];
}

function maybeSimplifyNumber(maybeCategory: NumberCategory | undefined): ReadonlyArray<Type.TNumber> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.literals) : [];
}

function maybeSimplifyRecord(maybeCategory: RecordCategory | undefined): ReadonlyArray<Type.TRecord> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedRecords) : [];
}

function maybeSimplifyTable(maybeCategory: TableCategory | undefined): ReadonlyArray<Type.TTable> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedTables) : [];
}

function maybeSimplifyText(maybeCategory: TextCategory | undefined): ReadonlyArray<Type.TText> {
    return maybeCategory ? simplifyExtendedType(maybeCategory.primitives, maybeCategory.literals) : [];
}

function maybeSimplifyType(maybeCategory: TypeCategory | undefined): ReadonlyArray<Type.PqType> {
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
