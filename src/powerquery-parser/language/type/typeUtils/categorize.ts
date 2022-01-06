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
import { Type } from "..";

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
    readonly maybeAction: ActionCategory | undefined;
    readonly maybeAnyNonNull: AnyNonNullCategory | undefined;
    readonly maybeAny: AnyCategory | undefined;
    readonly maybeBinary: BinaryCategory | undefined;
    readonly maybeDate: DateCategory | undefined;
    readonly maybeDateTime: DateTimeCategory | undefined;
    readonly maybeDateTimeZone: DateTimeZoneCategory | undefined;
    readonly maybeDuration: DurationCategory | undefined;
    readonly maybeFunction: FunctionCategory | undefined;
    readonly maybeList: ListCategory | undefined;
    readonly maybeLogical: LogicalCategory | undefined;
    readonly maybeNone: NoneCategory | undefined;
    readonly maybeNotApplicable: NotApplicableCategory | undefined;
    readonly maybeNumber: NumberCategory | undefined;
    readonly maybeNull: NullCategory | undefined;
    readonly maybeRecord: RecordCategory | undefined;
    readonly maybeTable: TableCategory | undefined;
    readonly maybeText: TextCategory | undefined;
    readonly maybeTime: TimeCategory | undefined;
    readonly maybeType: TypeCategory | undefined;
    readonly maybeUnknown: UnknownCategory | undefined;
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
export function categorize(types: ReadonlyArray<Type.TPowerQueryType>): CategorizedPowerQueryTypes {
    const categoryByKind: Map<Type.TypeKind, TCategory> = new Map();

    for (const type of types) {
        const maybeCategory: TCategory | undefined = categoryByKind.get(type.kind);

        if (maybeCategory === undefined) {
            categoryByKind.set(type.kind, createCategory(type));
        } else {
            categoryByKind.set(type.kind, addToCategory(maybeCategory, type));
        }
    }

    return {
        maybeAction: categoryByKind.get(Type.TypeKind.Action) as ActionCategory,
        maybeAny: categoryByKind.get(Type.TypeKind.Any) as AnyCategory,
        maybeAnyNonNull: categoryByKind.get(Type.TypeKind.AnyNonNull) as AnyNonNullCategory,
        maybeBinary: categoryByKind.get(Type.TypeKind.Binary) as BinaryCategory,
        maybeDate: categoryByKind.get(Type.TypeKind.Date) as DateCategory,
        maybeDateTime: categoryByKind.get(Type.TypeKind.DateTime) as DateTimeCategory,
        maybeDateTimeZone: categoryByKind.get(Type.TypeKind.DateTimeZone) as DateTimeZoneCategory,
        maybeDuration: categoryByKind.get(Type.TypeKind.Duration) as DurationCategory,
        maybeFunction: categoryByKind.get(Type.TypeKind.Function) as FunctionCategory,
        maybeList: categoryByKind.get(Type.TypeKind.List) as ListCategory,
        maybeLogical: categoryByKind.get(Type.TypeKind.Logical) as LogicalCategory,
        maybeNone: categoryByKind.get(Type.TypeKind.None) as NoneCategory,
        maybeNotApplicable: categoryByKind.get(Type.TypeKind.NotApplicable) as NotApplicableCategory,
        maybeNull: categoryByKind.get(Type.TypeKind.Null) as NullCategory,
        maybeNumber: categoryByKind.get(Type.TypeKind.Number) as NumberCategory,
        maybeRecord: categoryByKind.get(Type.TypeKind.Record) as RecordCategory,
        maybeTable: categoryByKind.get(Type.TypeKind.Table) as TableCategory,
        maybeText: categoryByKind.get(Type.TypeKind.Text) as TextCategory,
        maybeTime: categoryByKind.get(Type.TypeKind.Time) as TimeCategory,
        maybeType: categoryByKind.get(Type.TypeKind.Type) as TypeCategory,
        maybeUnknown: categoryByKind.get(Type.TypeKind.Unknown) as UnknownCategory,
    };
}

interface ITypeKindCategory<T extends Type.TPowerQueryType> {
    readonly kind: T["kind"];
    readonly primitives: ImmutableSet<T>;
}

function addToCategory(category: TCategory, type: Type.TPowerQueryType): TCategory {
    // We can't group cases which call `addToCategoryForPrimitive` as they each have a different generic type.
    switch (type.kind) {
        case Type.TypeKind.Action:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Any: {
            assertIsCategoryForType<Type.TAny, AnyCategory>(category, type);

            return addTypeIfUniqueAny(category, type);
        }

        case Type.TypeKind.AnyNonNull:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Binary:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Date:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.DateTime:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.DateTimeZone:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Duration:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Function: {
            assertIsCategoryForType<Type.TFunction, FunctionCategory>(category, type);

            return addToCategoryForFunction(category, type);
        }

        case Type.TypeKind.List: {
            assertIsCategoryForType<Type.TList, ListCategory>(category, type);

            return addToCategoryForList(category, type);
        }

        case Type.TypeKind.Logical: {
            assertIsCategoryForType<Type.TLogical, LogicalCategory>(category, type);

            return addToCategoryForLogical(category, type);
        }

        case Type.TypeKind.None:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.NotApplicable:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Null:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Number: {
            assertIsCategoryForType<Type.TNumber, NumberCategory>(category, type);

            return addToCategoryForNumber(category, type);
        }

        case Type.TypeKind.Record: {
            assertIsCategoryForType<Type.TRecord, RecordCategory>(category, type);

            return addToCategoryForRecord(category, type);
        }

        case Type.TypeKind.Table: {
            assertIsCategoryForType<Type.TTable, TableCategory>(category, type);

            return addToCategoryForTable(category, type);
        }

        case Type.TypeKind.Text: {
            assertIsCategoryForType<Type.TText, TextCategory>(category, type);

            return addToCategoryForText(category, type);
        }

        case Type.TypeKind.Time:
            return addToCategoryForPrimitive(category, type);

        case Type.TypeKind.Type: {
            assertIsCategoryForType<Type.TType, TypeCategory>(category, type);

            return addTypeIfUniqueType(category, type);
        }

        case Type.TypeKind.Unknown:
            return addToCategoryForPrimitive(category, type);

        default:
            throw Assert.isNever(type);
    }
}

function addTypeIfUniqueAny(category: AnyCategory, type: Type.TAny): AnyCategory {
    assertIsCategoryForType<Type.TAny, AnyCategory>(category, type);

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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

function createCategory(type: Type.TPowerQueryType): TCategory {
    switch (type.kind) {
        case Type.TypeKind.Action:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Any:
            return createCategoryForAny(type);

        case Type.TypeKind.AnyNonNull:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Binary:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Date:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.DateTime:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.DateTimeZone:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Duration:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Function:
            return createCategoryForFunction(type);

        case Type.TypeKind.List:
            return createCategoryForList(type);

        case Type.TypeKind.Logical:
            return createCategoryForLogical(type);

        case Type.TypeKind.None:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.NotApplicable:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Null:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Number:
            return createCategoryForNumber(type);

        case Type.TypeKind.Record:
            return createCategoryForRecord(type);

        case Type.TypeKind.Table:
            return createCategoryForTable(type);

        case Type.TypeKind.Text:
            return createCategoryForText(type);

        case Type.TypeKind.Time:
            return createCategoryForPrimitive(type);

        case Type.TypeKind.Type:
            return createCategoryForType(type);

        case Type.TypeKind.Unknown:
            return createCategoryForPrimitive(type);

        default:
            throw Assert.isNever(type);
    }
}

function createCategoryForAny(type: Type.TAny): AnyCategory {
    switch (type.maybeExtendedKind) {
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
    switch (type.maybeExtendedKind) {
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
    switch (type.maybeExtendedKind) {
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
    switch (type.maybeExtendedKind) {
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
    switch (type.maybeExtendedKind) {
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
    switch (type.maybeExtendedKind) {
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
    switch (type.maybeExtendedKind) {
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
    switch (type.maybeExtendedKind) {
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

    switch (type.maybeExtendedKind) {
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
            switch (item.maybeExtendedKind) {
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
