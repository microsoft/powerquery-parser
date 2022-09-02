// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, ImmutableSet } from "../../../common";
import {
    isEqualAnyUnion,
    isEqualDefinedFunction,
    isEqualDefinedList,
    isEqualDefinedListType,
    isEqualDefinedRecord,
    isEqualDefinedTable,
    isEqualFunctionType,
    isEqualListType,
    isEqualNumberLiteral,
    isEqualPrimaryPrimitiveType,
    isEqualPrimitiveType,
    isEqualRecordType,
    isEqualTableType,
    isEqualTableTypePrimaryExpression,
    isEqualTextLiteral,
    isEqualType,
} from "./isEqualType";
import { Trace, TraceManager } from "../../../common/trace";
import { Type } from "..";
import { TypeUtilsTraceConstant } from "./typeTraceConstant";

export type TCategory = TExtendedCategory | NonExtendedCategory;
export type TExtendedCategory =
    | AnyCategory
    | FunctionCategory
    | ListCategory
    | LogicalCategory
    | NumberCategory
    | RecordCategory
    | TableCategory
    | TextCategory
    | TypeCategory;
export type NonExtendedCategory =
    | ActionCategory
    | AnyNonNullCategory
    | BinaryCategory
    | DateCategory
    | DateTimeCategory
    | DateTimeZoneCategory
    | DurationCategory
    | NoneCategory
    | NotApplicableCategory
    | NullCategory
    | TimeCategory
    | UnknownCategory;

export interface CategorizedPowerQueryTypes {
    readonly actions: ActionCategory | undefined;
    readonly anyNonNulls: AnyNonNullCategory | undefined;
    readonly anys: AnyCategory | undefined;
    readonly binaries: BinaryCategory | undefined;
    readonly dates: DateCategory | undefined;
    readonly dateTimes: DateTimeCategory | undefined;
    readonly dateTimeZones: DateTimeZoneCategory | undefined;
    readonly durations: DurationCategory | undefined;
    readonly functions: FunctionCategory | undefined;
    readonly lists: ListCategory | undefined;
    readonly logicals: LogicalCategory | undefined;
    readonly nones: NoneCategory | undefined;
    readonly notApplicables: NotApplicableCategory | undefined;
    readonly numbers: NumberCategory | undefined;
    readonly nulls: NullCategory | undefined;
    readonly records: RecordCategory | undefined;
    readonly tables: TableCategory | undefined;
    readonly texts: TextCategory | undefined;
    readonly times: TimeCategory | undefined;
    readonly types: TypeCategory | undefined;
    readonly unknowns: UnknownCategory | undefined;
}

export type ActionCategory = ITypeKindCategory<Type.Action>;
export type AnyNonNullCategory = ITypeKindCategory<Type.AnyNonNull>;
export type BinaryCategory = ITypeKindCategory<Type.Binary>;
export type DateCategory = ITypeKindCategory<Type.Date>;
export type DateTimeCategory = ITypeKindCategory<Type.DateTime>;
export type DateTimeZoneCategory = ITypeKindCategory<Type.DateTimeZone>;
export type DurationCategory = ITypeKindCategory<Type.Duration>;
export type NoneCategory = ITypeKindCategory<Type.None>;
export type NotApplicableCategory = ITypeKindCategory<Type.NotApplicable>;
export type NullCategory = ITypeKindCategory<Type.Null>;
export type TimeCategory = ITypeKindCategory<Type.Time>;
export type UnknownCategory = ITypeKindCategory<Type.Unknown>;

export interface AnyCategory extends ITypeKindCategory<Type.Any> {
    readonly anyUnions: ImmutableSet<Type.AnyUnion>;
    // This is a recursive flattening of `AnyUnion.unionedTypePairs`.
    readonly flattenedAnyUnions: ImmutableSet<Type.TPowerQueryType>;
}

export interface FunctionCategory extends ITypeKindCategory<Type.Function> {
    readonly definedFunctions: ImmutableSet<Type.DefinedFunction>;
}

export interface ListCategory extends ITypeKindCategory<Type.List> {
    readonly definedLists: ImmutableSet<Type.DefinedList>;
}

export interface LogicalCategory extends ITypeKindCategory<Type.Logical> {
    readonly hasFalsyNonNullableLiteral: boolean;
    readonly hasFalsyNullableLiteral: boolean;
    readonly hasTruthyNonNullableLiteral: boolean;
    readonly hasTruthyNullableLiteral: boolean;
}

export interface NumberCategory extends ITypeKindCategory<Type.Number> {
    readonly literals: ImmutableSet<Type.NumberLiteral>;
}

export interface RecordCategory extends ITypeKindCategory<Type.Record> {
    readonly definedRecords: ImmutableSet<Type.DefinedRecord>;
}

export interface TableCategory extends ITypeKindCategory<Type.Table> {
    readonly definedTables: ImmutableSet<Type.DefinedTable>;
}

export interface TextCategory extends ITypeKindCategory<Type.Text> {
    readonly literals: ImmutableSet<Type.TextLiteral>;
}

export interface TypeCategory extends ITypeKindCategory<Type.Type> {
    readonly definedListTypes: ImmutableSet<Type.DefinedListType>;
    readonly functionTypes: ImmutableSet<Type.FunctionType>;
    readonly listTypes: ImmutableSet<Type.ListType>;
    readonly primaryPrimitiveTypes: ImmutableSet<Type.PrimaryPrimitiveType>;
    readonly recordTypes: ImmutableSet<Type.RecordType>;
    readonly tableTypes: ImmutableSet<Type.TableType>;
    readonly tablePrimaryExpressionTypes: ImmutableSet<Type.TableTypePrimaryExpression>;
}

// Takes a collection of PowerQueryType and breaks them down into buckets based on their TypeKind,
// then again on their ExtendedTypeKind.
export function categorize(
    types: ReadonlyArray<Type.TPowerQueryType>,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CategorizedPowerQueryTypes {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.Categorize, categorize.name, correlationId);

    const categoryByKind: Map<Type.TypeKind, TCategory> = new Map();

    for (const type of types) {
        const category: TCategory | undefined = categoryByKind.get(type.kind);

        if (category === undefined) {
            categoryByKind.set(type.kind, createCategory(type, traceManager, trace.id));
        } else {
            categoryByKind.set(type.kind, addToCategory(category, type, traceManager, trace.id));
        }
    }

    const result: CategorizedPowerQueryTypes = {
        actions: categoryByKind.get(Type.TypeKind.Action) as ActionCategory,
        anys: categoryByKind.get(Type.TypeKind.Any) as AnyCategory,
        anyNonNulls: categoryByKind.get(Type.TypeKind.AnyNonNull) as AnyNonNullCategory,
        binaries: categoryByKind.get(Type.TypeKind.Binary) as BinaryCategory,
        dates: categoryByKind.get(Type.TypeKind.Date) as DateCategory,
        dateTimes: categoryByKind.get(Type.TypeKind.DateTime) as DateTimeCategory,
        dateTimeZones: categoryByKind.get(Type.TypeKind.DateTimeZone) as DateTimeZoneCategory,
        durations: categoryByKind.get(Type.TypeKind.Duration) as DurationCategory,
        functions: categoryByKind.get(Type.TypeKind.Function) as FunctionCategory,
        lists: categoryByKind.get(Type.TypeKind.List) as ListCategory,
        logicals: categoryByKind.get(Type.TypeKind.Logical) as LogicalCategory,
        nones: categoryByKind.get(Type.TypeKind.None) as NoneCategory,
        notApplicables: categoryByKind.get(Type.TypeKind.NotApplicable) as NotApplicableCategory,
        nulls: categoryByKind.get(Type.TypeKind.Null) as NullCategory,
        numbers: categoryByKind.get(Type.TypeKind.Number) as NumberCategory,
        records: categoryByKind.get(Type.TypeKind.Record) as RecordCategory,
        tables: categoryByKind.get(Type.TypeKind.Table) as TableCategory,
        texts: categoryByKind.get(Type.TypeKind.Text) as TextCategory,
        times: categoryByKind.get(Type.TypeKind.Time) as TimeCategory,
        types: categoryByKind.get(Type.TypeKind.Type) as TypeCategory,
        unknowns: categoryByKind.get(Type.TypeKind.Unknown) as UnknownCategory,
    };

    trace.exit();

    return result;
}

interface ITypeKindCategory<T extends Type.TPowerQueryType> {
    readonly kind: T["kind"];
    readonly primitives: ImmutableSet<T>;
}

function addToCategory(
    category: TCategory,
    type: Type.TPowerQueryType,
    traceManager: TraceManager,
    correlationId: number,
): TCategory {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.Categorize, addToCategory.name, correlationId);

    let result: TCategory;

    // We can't group cases which call `addToCategoryForPrimitive` as they each have a different generic type.
    switch (type.kind) {
        case Type.TypeKind.Action:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Any: {
            assertIsCategoryForType<Type.TAny, AnyCategory>(category, type);

            result = addTypeIfUniqueAny(category, type);
            break;
        }

        case Type.TypeKind.AnyNonNull:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Binary:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Date:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.DateTime:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.DateTimeZone:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Duration:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Function: {
            assertIsCategoryForType<Type.TFunction, FunctionCategory>(category, type);

            result = addToCategoryForFunction(category, type);
            break;
        }

        case Type.TypeKind.List: {
            assertIsCategoryForType<Type.TList, ListCategory>(category, type);

            result = addToCategoryForList(category, type);
            break;
        }

        case Type.TypeKind.Logical: {
            assertIsCategoryForType<Type.TLogical, LogicalCategory>(category, type);

            result = addToCategoryForLogical(category, type);
            break;
        }

        case Type.TypeKind.None:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.NotApplicable:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Null:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Number: {
            assertIsCategoryForType<Type.TNumber, NumberCategory>(category, type);
            result = addToCategoryForNumber(category, type);
            break;
        }

        case Type.TypeKind.Record: {
            assertIsCategoryForType<Type.TRecord, RecordCategory>(category, type);

            result = addToCategoryForRecord(category, type);
            break;
        }

        case Type.TypeKind.Table: {
            assertIsCategoryForType<Type.TTable, TableCategory>(category, type);

            result = addToCategoryForTable(category, type);
            break;
        }

        case Type.TypeKind.Text: {
            assertIsCategoryForType<Type.TText, TextCategory>(category, type);

            result = addToCategoryForText(category, type);
            break;
        }

        case Type.TypeKind.Time:
            result = addToCategoryForPrimitive(category, type);
            break;

        case Type.TypeKind.Type: {
            assertIsCategoryForType<Type.TType, TypeCategory>(category, type);

            result = addTypeIfUniqueType(category, type);
            break;
        }

        case Type.TypeKind.Unknown:
            result = addToCategoryForPrimitive(category, type);
            break;

        default:
            throw Assert.isNever(type);
    }

    trace.exit();

    return result;
}

function addTypeIfUniqueAny(category: AnyCategory, type: Type.TAny): AnyCategory {
    assertIsCategoryForType<Type.TAny, AnyCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.AnyUnion:
            return {
                ...category,
                anyUnions: category.anyUnions.add(type),
                flattenedAnyUnions: category.flattenedAnyUnions.addMany(flattenAnyUnion(type)),
            };

        case undefined:
            return addToCategoryForPrimitive(category, type);

        default:
            throw Assert.isNever(type);
    }
}

function addToCategoryForFunction(category: FunctionCategory, type: Type.TFunction): FunctionCategory {
    assertIsCategoryForType<Type.TFunction, FunctionCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedFunction: {
            return {
                ...category,
                definedFunctions: category.definedFunctions.add(type),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function addToCategoryForList(category: ListCategory, type: Type.TList): ListCategory {
    assertIsCategoryForType<Type.TList, ListCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedList: {
            return {
                ...category,
                definedLists: category.definedLists.add(type),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function addToCategoryForLogical(category: LogicalCategory, type: Type.TLogical): LogicalCategory {
    assertIsCategoryForType<Type.TLogical, LogicalCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.LogicalLiteral: {
            return {
                ...category,
                hasFalsyNonNullableLiteral:
                    category.hasFalsyNonNullableLiteral || (!type.normalizedLiteral && !type.isNullable),
                hasFalsyNullableLiteral:
                    category.hasFalsyNullableLiteral || (!type.normalizedLiteral && type.isNullable),
                hasTruthyNonNullableLiteral:
                    category.hasTruthyNonNullableLiteral || (type.normalizedLiteral && !type.isNullable),
                hasTruthyNullableLiteral:
                    category.hasTruthyNullableLiteral || (type.normalizedLiteral && type.isNullable),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function addToCategoryForNumber(category: NumberCategory, type: Type.TNumber): NumberCategory {
    assertIsCategoryForType<Type.TNumber, NumberCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.NumberLiteral: {
            return {
                ...category,
                literals: category.literals.add(type),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function addToCategoryForPrimitive<T extends Type.TPowerQueryType, C extends ITypeKindCategory<T> & TCategory>(
    category: TCategory,
    type: T,
): ITypeKindCategory<T> & TCategory {
    assertIsCategoryForType<T, C>(category, type);

    return {
        ...category,
        primitives: category.primitives.add(type),
    };
}

function addToCategoryForRecord(category: RecordCategory, type: Type.TRecord): RecordCategory {
    assertIsCategoryForType<Type.TRecord, RecordCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedRecord: {
            return {
                ...category,
                definedRecords: category.definedRecords.add(type),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function addToCategoryForTable(category: TableCategory, type: Type.TTable): TableCategory {
    assertIsCategoryForType<Type.TTable, TableCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedTable: {
            return {
                ...category,
                definedTables: category.definedTables.add(type),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function addToCategoryForText(category: TextCategory, type: Type.TText): TextCategory {
    assertIsCategoryForType<Type.TText, TextCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.TextLiteral: {
            return {
                ...category,
                literals: category.literals.add(type),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function addTypeIfUniqueType(category: TypeCategory, type: Type.TType): TypeCategory {
    assertIsCategoryForType<Type.TType, TypeCategory>(category, type);

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedListType: {
            return {
                ...category,
                definedListTypes: category.definedListTypes.add(type),
            };
        }

        case Type.ExtendedTypeKind.FunctionType: {
            return {
                ...category,
                functionTypes: category.functionTypes.add(type),
            };
        }

        case Type.ExtendedTypeKind.ListType: {
            return {
                ...category,
                listTypes: category.listTypes.add(type),
            };
        }

        case Type.ExtendedTypeKind.PrimaryPrimitiveType: {
            return {
                ...category,
                primaryPrimitiveTypes: category.primaryPrimitiveTypes.add(type),
            };
        }

        case Type.ExtendedTypeKind.RecordType: {
            return {
                ...category,
                recordTypes: category.recordTypes.add(type),
            };
        }

        case Type.ExtendedTypeKind.TableType: {
            return {
                ...category,
                tableTypes: category.tableTypes.add(type),
            };
        }

        case Type.ExtendedTypeKind.TableTypePrimaryExpression: {
            return {
                ...category,
                tablePrimaryExpressionTypes: category.tablePrimaryExpressionTypes.add(type),
            };
        }

        case undefined: {
            return {
                ...category,
                primitives: category.primitives.add(type),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function assertIsCategoryForType<PowerQueryType extends Type.TPowerQueryType, Category extends TCategory>(
    category: TCategory,
    type: PowerQueryType,
): asserts category is Category {
    if (category.kind !== type.kind) {
        throw new CommonError.InvariantError(`expected category and type to have the same kind`, {
            categoryKind: category.kind,
            typeKind: type.kind,
        });
    }
}

function createCategory(type: Type.TPowerQueryType, traceManager: TraceManager, correlationId: number): TCategory {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.Categorize, createCategory.name, correlationId);

    let result: TCategory;

    switch (type.kind) {
        case Type.TypeKind.Action:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Any:
            result = createCategoryForAny(type);
            break;

        case Type.TypeKind.AnyNonNull:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Binary:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Date:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.DateTime:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.DateTimeZone:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Duration:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Function:
            result = createCategoryForFunction(type);
            break;

        case Type.TypeKind.List:
            result = createCategoryForList(type);
            break;

        case Type.TypeKind.Logical:
            result = createCategoryForLogical(type);
            break;

        case Type.TypeKind.None:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.NotApplicable:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Null:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Number:
            result = createCategoryForNumber(type);
            break;

        case Type.TypeKind.Record:
            result = createCategoryForRecord(type);
            break;

        case Type.TypeKind.Table:
            result = createCategoryForTable(type);
            break;

        case Type.TypeKind.Text:
            result = createCategoryForText(type);
            break;

        case Type.TypeKind.Time:
            result = createCategoryForPrimitive(type);
            break;

        case Type.TypeKind.Type:
            result = createCategoryForType(type);
            break;

        case Type.TypeKind.Unknown:
            result = createCategoryForPrimitive(type);
            break;

        default:
            throw Assert.isNever(type);
    }

    trace.exit();

    return result;
}

function createCategoryForAny(type: Type.TAny): AnyCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.AnyUnion: {
            return {
                kind: Type.TypeKind.Any,
                primitives: new ImmutableSet<Type.Any>([], isEqualPrimitiveType),
                anyUnions: new ImmutableSet([type], isEqualAnyUnion),
                flattenedAnyUnions: new ImmutableSet(flattenAnyUnion(type), isEqualType),
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.Any,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                anyUnions: new ImmutableSet([], isEqualAnyUnion),
                flattenedAnyUnions: new ImmutableSet([], isEqualType),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForFunction(type: Type.TFunction): FunctionCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedFunction: {
            return {
                kind: Type.TypeKind.Function,
                primitives: new ImmutableSet<Type.Function>([], isEqualPrimitiveType),
                definedFunctions: new ImmutableSet([type], isEqualDefinedFunction),
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.Function,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                definedFunctions: new ImmutableSet([], isEqualDefinedFunction),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForList(type: Type.TList): ListCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedList: {
            return {
                kind: Type.TypeKind.List,
                primitives: new ImmutableSet<Type.List>([], isEqualPrimitiveType),
                definedLists: new ImmutableSet([type], isEqualDefinedList),
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.List,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                definedLists: new ImmutableSet([], isEqualDefinedList),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForLogical(type: Type.TLogical): LogicalCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.LogicalLiteral: {
            return {
                kind: Type.TypeKind.Logical,
                primitives: new ImmutableSet<Type.Logical>([], isEqualPrimitiveType),
                hasFalsyNonNullableLiteral: !type.normalizedLiteral && !type.isNullable,
                hasFalsyNullableLiteral: !type.normalizedLiteral && type.isNullable,
                hasTruthyNonNullableLiteral: type.normalizedLiteral && !type.isNullable,
                hasTruthyNullableLiteral: type.normalizedLiteral && type.isNullable,
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.Logical,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                hasFalsyNonNullableLiteral: false,
                hasFalsyNullableLiteral: false,
                hasTruthyNonNullableLiteral: false,
                hasTruthyNullableLiteral: false,
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForNumber(type: Type.TNumber): NumberCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.NumberLiteral: {
            return {
                kind: Type.TypeKind.Number,
                primitives: new ImmutableSet<Type.Number>([], isEqualPrimitiveType),
                literals: new ImmutableSet([type], isEqualNumberLiteral),
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.Number,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                literals: new ImmutableSet<Type.NumberLiteral>([], isEqualNumberLiteral),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForPrimitive<T extends Type.TPowerQueryType>(type: T): ITypeKindCategory<T> {
    return {
        kind: type.kind,
        primitives: new ImmutableSet<T>([type], isEqualType),
    };
}

function createCategoryForRecord(type: Type.TRecord): RecordCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedRecord: {
            return {
                kind: Type.TypeKind.Record,
                primitives: new ImmutableSet<Type.Record>([], isEqualPrimitiveType),
                definedRecords: new ImmutableSet([type], isEqualType),
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.Record,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                definedRecords: new ImmutableSet([], isEqualDefinedRecord),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForTable(type: Type.TTable): TableCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedTable: {
            return {
                kind: Type.TypeKind.Table,
                primitives: new ImmutableSet<Type.Table>([], isEqualPrimitiveType),
                definedTables: new ImmutableSet([type], isEqualDefinedTable),
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.Table,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                definedTables: new ImmutableSet([], isEqualDefinedTable),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForText(type: Type.TText): TextCategory {
    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.TextLiteral: {
            return {
                kind: Type.TypeKind.Text,
                primitives: new ImmutableSet<Type.Text>([], isEqualPrimitiveType),
                literals: new ImmutableSet([type], isEqualTextLiteral),
            };
        }

        case undefined: {
            return {
                kind: Type.TypeKind.Text,
                primitives: new ImmutableSet([type], isEqualPrimitiveType),
                literals: new ImmutableSet([], isEqualTextLiteral),
            };
        }

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForType(type: Type.TType): TypeCategory {
    let primitives: ReadonlyArray<Type.Type> = [];
    let definedListTypes: ReadonlyArray<Type.DefinedListType> = [];
    let functionTypes: ReadonlyArray<Type.FunctionType> = [];
    let listTypes: ReadonlyArray<Type.ListType> = [];
    let primaryPrimitiveTypes: ReadonlyArray<Type.PrimaryPrimitiveType> = [];
    let recordTypes: ReadonlyArray<Type.RecordType> = [];
    let tablePrimaryExpressionTypes: ReadonlyArray<Type.TableTypePrimaryExpression> = [];
    let tableTypes: ReadonlyArray<Type.TableType> = [];

    switch (type.extendedKind) {
        case Type.ExtendedTypeKind.DefinedListType:
            definedListTypes = [type];
            break;

        case Type.ExtendedTypeKind.FunctionType:
            functionTypes = [type];
            break;

        case Type.ExtendedTypeKind.ListType:
            listTypes = [type];
            break;

        case Type.ExtendedTypeKind.PrimaryPrimitiveType:
            primaryPrimitiveTypes = [type];
            break;

        case Type.ExtendedTypeKind.RecordType:
            recordTypes = [type];
            break;

        case Type.ExtendedTypeKind.TableTypePrimaryExpression:
            tablePrimaryExpressionTypes = [type];
            break;

        case Type.ExtendedTypeKind.TableType:
            tableTypes = [type];
            break;

        case undefined: {
            primitives = [type];
            break;
        }

        default:
            throw Assert.isNever(type);
    }

    return {
        kind: Type.TypeKind.Type,
        primitives: new ImmutableSet(primitives, isEqualPrimitiveType),
        definedListTypes: new ImmutableSet(definedListTypes, isEqualDefinedListType),
        functionTypes: new ImmutableSet(functionTypes, isEqualFunctionType),
        listTypes: new ImmutableSet(listTypes, isEqualListType),
        primaryPrimitiveTypes: new ImmutableSet(primaryPrimitiveTypes, isEqualPrimaryPrimitiveType),
        recordTypes: new ImmutableSet(recordTypes, isEqualRecordType),
        tablePrimaryExpressionTypes: new ImmutableSet(tablePrimaryExpressionTypes, isEqualTableTypePrimaryExpression),
        tableTypes: new ImmutableSet(tableTypes, isEqualTableType),
    };
}

function flattenAnyUnion(anyUnion: Type.AnyUnion): ReadonlyArray<Type.TPowerQueryType> {
    let newUnionedTypePairs: Type.TPowerQueryType[] = [];

    for (const item of anyUnion.unionedTypePairs) {
        // If it's an Any primitive then we can do an early return.
        // Else it's an AnyUnion so continue flattening the types.
        if (item.kind === Type.TypeKind.Any) {
            switch (item.extendedKind) {
                case undefined:
                    return [item];

                case Type.ExtendedTypeKind.AnyUnion:
                    newUnionedTypePairs = newUnionedTypePairs.concat(flattenAnyUnion(item));
                    break;

                default:
                    throw Assert.isNever(item);
            }
        } else {
            newUnionedTypePairs.push(item);
        }
    }

    return newUnionedTypePairs;
}
