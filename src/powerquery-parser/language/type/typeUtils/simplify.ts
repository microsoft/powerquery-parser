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
import { ArrayUtils, ImmutableSet } from "../../../common";
import { isEqualType } from "./isEqualType";
import { Type } from "..";

export function simplify(types: ReadonlyArray<Type.TPowerQueryType>): ReadonlyArray<Type.TPowerQueryType> {
    const categorized: CategorizedPowerQueryTypes = categorize(types);

    // If an `any` exists then that's as simplified as we can make it.
    const maybeAny: Type.Any | undefined = maybeFindAnyPrimitive(categorized);
    if (maybeAny) {
        return [maybeAny];
    }

    const partial: Type.TPowerQueryType[] = [
        ...(categorized.maybeAction?.primitives.values() ?? []),
        ...(categorized.maybeAnyNonNull?.primitives.values() ?? []),
        ...(categorized.maybeBinary?.primitives.values() ?? []),
        ...(categorized.maybeDate?.primitives.values() ?? []),
        ...(categorized.maybeDateTime?.primitives.values() ?? []),
        ...(categorized.maybeDateTimeZone?.primitives.values() ?? []),
        ...(categorized.maybeDuration?.primitives.values() ?? []),
        ...(categorized.maybeNone?.primitives.values() ?? []),
        ...(categorized.maybeNotApplicable?.primitives.values() ?? []),
        ...(categorized.maybeNull?.primitives.values() ?? []),
        ...(categorized.maybeTime?.primitives.values() ?? []),
        ...(categorized.maybeUnknown?.primitives.values() ?? []),

        ...simplifyFunctionCategory(categorized.maybeFunction),
        ...simplifyListCategory(categorized.maybeList),
        ...simplifyLogicalCategory(categorized.maybeLogical),
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
function firstNullableElseFirst<T extends Type.TPowerQueryType>(immutableSet: ImmutableSet<T>): T | undefined {
    const setValues: ReadonlyArray<T> = [...immutableSet.values()];

    for (const item of setValues) {
        if (item.isNullable) {
            return item;
        }
    }

    return setValues[0];
}

function maybeFindAnyPrimitive(categorized: CategorizedPowerQueryTypes): Type.Any | undefined {
    const maybeAnySet: ImmutableSet<Type.Any> | undefined = categorized.maybeAny?.primitives;
    if (maybeAnySet === undefined) {
        return undefined;
    }

    return firstNullableElseFirst(maybeAnySet);
}

function simplifyAnyCategory(maybeCategory: AnyCategory | undefined): ReadonlyArray<Type.TPowerQueryType> {
    if (!maybeCategory?.flattenedAnyUnions) {
        return [];
    } else {
        const flattnedAnyUnions: ImmutableSet<Type.TPowerQueryType> = maybeCategory?.flattenedAnyUnions;
        return [...flattnedAnyUnions.values()];
    }
}

function simplifyFunctionCategory(maybeCategory: FunctionCategory | undefined): ReadonlyArray<Type.TFunction> {
    if (maybeCategory === undefined) {
        return [];
    }

    return simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedFunctions);
}

function simplifyListCategory(maybeCategory: ListCategory | undefined): ReadonlyArray<Type.TList> {
    if (maybeCategory === undefined) {
        return [];
    }

    return simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedLists);
}

function simplifyLogicalCategory(maybeCategory: LogicalCategory | undefined): ReadonlyArray<Type.TLogical> {
    if (maybeCategory === undefined) {
        return [];
    } else if (
        (maybeCategory.hasFalsyNullableLiteral || maybeCategory.hasFalsyNonNullableLiteral) &&
        (maybeCategory.hasTruthyNullableLiteral || maybeCategory.hasTruthyNonNullableLiteral)
    ) {
        return maybeCategory.hasFalsyNullableLiteral || maybeCategory.hasTruthyNullableLiteral
            ? [Type.NullableLogicalInstance]
            : [Type.LogicalInstance];
    } else {
        const maybeType: Type.Logical | undefined = firstNullableElseFirst(maybeCategory.primitives);
        return maybeType ? [maybeType] : [];
    }
}

function simplifyNumberCategory(maybeCategory: NumberCategory | undefined): ReadonlyArray<Type.TNumber> {
    if (maybeCategory === undefined) {
        return [];
    }

    return simplifyExtendedType(maybeCategory.primitives, maybeCategory.literals);
}

function simplifyRecordCategory(maybeCategory: RecordCategory | undefined): ReadonlyArray<Type.TRecord> {
    if (maybeCategory === undefined) {
        return [];
    }

    return simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedRecords);
}

function simplifyTableCategory(maybeCategory: TableCategory | undefined): ReadonlyArray<Type.TTable> {
    if (maybeCategory === undefined) {
        return [];
    }

    return simplifyExtendedType(maybeCategory.primitives, maybeCategory.definedTables);
}

function simplifyTextCategory(maybeCategory: TextCategory | undefined): ReadonlyArray<Type.TText> {
    if (maybeCategory === undefined) {
        return [];
    }

    return simplifyExtendedType(maybeCategory.primitives, maybeCategory.literals);
}

function simplifyTypeCategory(maybeCategory: TypeCategory | undefined): ReadonlyArray<Type.TPowerQueryType> {
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

function simplifyExtendedType<T extends Type.TPowerQueryType, L extends Type.TPowerQueryType>(
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
