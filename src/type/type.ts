// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TType = TPrimitiveType | TExtendedType;
export type TExtendedType =
    | AnyUnion
    | DefinedFunction
    | DefinedList
    | ListType
    | DefinedRecord
    | DefinedTable
    | DefinedType<TType>
    | PrimaryExpressionTable;
export type TExtendedTypeKind =
    | TypeKind.Any
    | TypeKind.Function
    | TypeKind.List
    | TypeKind.Record
    | TypeKind.Table
    | TypeKind.Type;

export type Action = IPrimitiveType<TypeKind.Action>;
export type Any = IPrimitiveType<TypeKind.Any>;
export type AnyNonNull = IPrimitiveType<TypeKind.AnyNonNull>;
export type Binary = IPrimitiveType<TypeKind.Binary>;
export type Date = IPrimitiveType<TypeKind.Date>;
export type DateTime = IPrimitiveType<TypeKind.DateTime>;
export type DateTimeZone = IPrimitiveType<TypeKind.DateTimeZone>;
export type Duration = IPrimitiveType<TypeKind.Duration>;
export type Function = IPrimitiveType<TypeKind.Function>;
export type List = IPrimitiveType<TypeKind.List>;
export type Logical = IPrimitiveType<TypeKind.Logical>;
export type None = IPrimitiveType<TypeKind.None>;
export type NotApplicable = IPrimitiveType<TypeKind.NotApplicable>;
export type Null = IPrimitiveType<TypeKind.Null>;
export type Number = IPrimitiveType<TypeKind.Number>;
export type Record = IPrimitiveType<TypeKind.Record>;
export type Table = IPrimitiveType<TypeKind.Table>;
export type Text = IPrimitiveType<TypeKind.Text>;
export type Time = IPrimitiveType<TypeKind.Time>;
export type Type = IPrimitiveType<TypeKind.Type>;
export type Unknown = IPrimitiveType<TypeKind.Unknown>;

export type TPrimitiveType =
    | Action
    | Any
    | AnyNonNull
    | Binary
    | Date
    | DateTime
    | DateTimeZone
    | Duration
    | Function
    | List
    | Logical
    | None
    | NotApplicable
    | Null
    | Number
    | Record
    | Table
    | Text
    | Time
    | Type
    | Unknown;

export const AnyInstance: IPrimitiveType<TypeKind.Any> = primitiveTypeFactory(TypeKind.Any, false);
export const AnyNonNullInstance: IPrimitiveType<TypeKind.AnyNonNull> = primitiveTypeFactory(TypeKind.AnyNonNull, false);
export const BinaryInstance: IPrimitiveType<TypeKind.Binary> = primitiveTypeFactory(TypeKind.Binary, false);
export const DateInstance: IPrimitiveType<TypeKind.Date> = primitiveTypeFactory(TypeKind.Date, false);
export const DateTimeInstance: IPrimitiveType<TypeKind.DateTime> = primitiveTypeFactory(TypeKind.DateTime, false);
export const DateTimeZoneInstance: IPrimitiveType<TypeKind.DateTimeZone> = primitiveTypeFactory(
    TypeKind.DateTimeZone,
    false,
);
export const DurationInstance: IPrimitiveType<TypeKind.Duration> = primitiveTypeFactory(TypeKind.Duration, false);
export const FunctionInstance: IPrimitiveType<TypeKind.Function> = primitiveTypeFactory(TypeKind.Function, false);
export const ListInstance: IPrimitiveType<TypeKind.List> = primitiveTypeFactory(TypeKind.List, false);
export const LogicalInstance: IPrimitiveType<TypeKind.Logical> = primitiveTypeFactory(TypeKind.Logical, false);
export const NoneInstance: IPrimitiveType<TypeKind.None> = primitiveTypeFactory(TypeKind.None, false);
export const NullInstance: IPrimitiveType<TypeKind.Null> = primitiveTypeFactory(TypeKind.Null, false);
export const NumberInstance: IPrimitiveType<TypeKind.Number> = primitiveTypeFactory(TypeKind.Number, false);
export const RecordInstance: IPrimitiveType<TypeKind.Record> = primitiveTypeFactory(TypeKind.Record, false);
export const TableInstance: IPrimitiveType<TypeKind.Table> = primitiveTypeFactory(TypeKind.Table, false);
export const TextInstance: IPrimitiveType<TypeKind.Text> = primitiveTypeFactory(TypeKind.Text, false);
export const TypeInstance: IPrimitiveType<TypeKind.Type> = primitiveTypeFactory(TypeKind.Type, false);
export const ActionInstance: IPrimitiveType<TypeKind.Action> = primitiveTypeFactory(TypeKind.Action, false);
export const TimeInstance: IPrimitiveType<TypeKind.Time> = primitiveTypeFactory(TypeKind.Time, false);
export const NotApplicableInstance: IPrimitiveType<TypeKind.NotApplicable> = primitiveTypeFactory(
    TypeKind.NotApplicable,
    false,
);
export const UnknownInstance: IPrimitiveType<TypeKind.Unknown> = primitiveTypeFactory(TypeKind.Unknown, false);

export const NullableAnyInstance: IPrimitiveType<TypeKind.Any> = primitiveTypeFactory(TypeKind.Any, true);
export const NullableBinaryInstance: IPrimitiveType<TypeKind.Binary> = primitiveTypeFactory(TypeKind.Binary, true);
export const NullableDateInstance: IPrimitiveType<TypeKind.Date> = primitiveTypeFactory(TypeKind.Date, true);
export const NullableDateTimeInstance: IPrimitiveType<TypeKind.DateTime> = primitiveTypeFactory(
    TypeKind.DateTime,
    true,
);
export const NullableDateTimeZoneInstance: IPrimitiveType<TypeKind.DateTimeZone> = primitiveTypeFactory(
    TypeKind.DateTimeZone,
    true,
);
export const NullableDurationInstance: IPrimitiveType<TypeKind.Duration> = primitiveTypeFactory(
    TypeKind.Duration,
    true,
);
export const NullableFunctionInstance: IPrimitiveType<TypeKind.Function> = primitiveTypeFactory(
    TypeKind.Function,
    true,
);
export const NullableListInstance: IPrimitiveType<TypeKind.List> = primitiveTypeFactory(TypeKind.List, true);
export const NullableLogicalInstance: IPrimitiveType<TypeKind.Logical> = primitiveTypeFactory(TypeKind.Logical, true);
export const NullableNoneInstance: IPrimitiveType<TypeKind.None> = primitiveTypeFactory(TypeKind.None, true);
export const NullableNullInstance: IPrimitiveType<TypeKind.Null> = primitiveTypeFactory(TypeKind.Null, true);
export const NullableNumberInstance: IPrimitiveType<TypeKind.Number> = primitiveTypeFactory(TypeKind.Number, true);
export const NullableRecordInstance: IPrimitiveType<TypeKind.Record> = primitiveTypeFactory(TypeKind.Record, true);
export const NullableTableInstance: IPrimitiveType<TypeKind.Table> = primitiveTypeFactory(TypeKind.Table, true);
export const NullableTextInstance: IPrimitiveType<TypeKind.Text> = primitiveTypeFactory(TypeKind.Text, true);
export const NullableTypeInstance: IPrimitiveType<TypeKind.Type> = primitiveTypeFactory(TypeKind.Type, true);
export const NullableActionInstance: IPrimitiveType<TypeKind.Action> = primitiveTypeFactory(TypeKind.Action, true);
export const NullableTimeInstance: IPrimitiveType<TypeKind.Time> = primitiveTypeFactory(TypeKind.Time, true);
export const NullableNotApplicableInstance: IPrimitiveType<TypeKind.NotApplicable> = primitiveTypeFactory(
    TypeKind.NotApplicable,
    true,
);
export const NullableUnknownInstance: IPrimitiveType<TypeKind.Unknown> = primitiveTypeFactory(TypeKind.Unknown, true);

export const enum TypeKind {
    Any = "Any",
    AnyNonNull = "AnyNonNull",
    Binary = "Binary",
    Date = "Date",
    DateTime = "DateTime",
    DateTimeZone = "DateTimeZone",
    Duration = "Duration",
    Function = "Function",
    List = "List",
    Logical = "Logical",
    None = "None",
    Null = "Null",
    Number = "Number",
    Record = "Record",
    Table = "Table",
    Text = "Text",
    Type = "Type",

    // Types that are not defined in the standard.
    Action = "Action",
    Time = "Time",

    // Some NodeKinds are non-typeable, such as ArrayWrapper.
    // NodeKinds can contain non-typeable and still be typeable.
    // Eg. a RecordExpression's fields are stored in an ArrayWrapper yet still can be typed.
    NotApplicable = "NotApplicable",
    // Something that can't be typed due to a lack of information.
    // Eg. '[', a RecordExpression which the user hasn't entered any fields for.
    Unknown = "Unknown",
}

export const enum ExtendedTypeKind {
    AnyUnion = "AnyUnion",
    DefinedFunction = "DefinedFunction",
    DefinedList = "DefinedList",
    DefinedRecord = "DefinedRecord",
    DefinedTable = "DefinedTable",
    DefinedType = "DefinedType",
    ListType = "ListType",
    PrimaryExpressionTable = "PrimaryExpressionTable",
}

export interface IType<T extends TypeKind = TypeKind> {
    readonly kind: T;
    readonly maybeExtendedKind: ExtendedTypeKind | undefined;
    readonly isNullable: boolean;
}

export interface IPrimitiveType<T extends TypeKind = TypeKind> extends IType<T> {
    readonly maybeExtendedKind: undefined;
}

export interface IExtendedType extends IType {
    readonly kind: TExtendedTypeKind;
    readonly maybeExtendedKind: ExtendedTypeKind;
}

export interface AnyUnion extends IExtendedType {
    readonly kind: TypeKind.Any;
    readonly maybeExtendedKind: ExtendedTypeKind.AnyUnion;
    readonly unionedTypePairs: ReadonlyArray<TType>;
}

export interface DefinedFunction extends IExtendedType {
    readonly kind: TypeKind.Function;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedFunction;
    readonly parameters: ReadonlyArray<FunctionParameter>;
    readonly returnType: TType;
}

export interface DefinedList extends IExtendedType {
    readonly kind: TypeKind.List;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedList;
    readonly elements: ReadonlyArray<TType>;
}

export interface ListType extends IExtendedType {
    readonly kind: TypeKind.Type;
    readonly maybeExtendedKind: ExtendedTypeKind.ListType;
    readonly itemType: TType;
}

export interface DefinedRecord extends IExtendedType {
    readonly kind: TypeKind.Record;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedRecord;
    readonly fields: Map<string, TType>;
    readonly isOpen: boolean;
}

export interface DefinedTable extends IExtendedType {
    readonly kind: TypeKind.Table;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedTable;
    readonly fields: Map<string, TType>;
    readonly isOpen: boolean;
}

export interface DefinedType<T extends TType> extends IExtendedType {
    readonly kind: TypeKind.Type;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedType;
    readonly primaryType: T;
}

export interface PrimaryExpressionTable extends IExtendedType {
    readonly kind: TypeKind.Table;
    readonly maybeExtendedKind: ExtendedTypeKind.PrimaryExpressionTable;
    readonly type: TType;
}

export interface SimplifiedNullablePrimitiveType {
    readonly typeKind: TypeKind;
    readonly isNullable: boolean;
}

export interface FunctionParameter {
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: TypeKind | undefined;
}

function primitiveTypeFactory<T extends TypeKind>(typeKind: T, isNullable: boolean): IPrimitiveType<T> {
    return {
        kind: typeKind,
        maybeExtendedKind: undefined,
        isNullable,
    };
}
