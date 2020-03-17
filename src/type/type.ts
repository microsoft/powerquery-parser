// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TType = PrimitiveType | TExtendedType;
export type TExtendedType = AnyUnion | DefinedRecord | DefinedTable;
export type TExtendedTypeKind = TypeKind.Any | TypeKind.Record | TypeKind.Table;

export const enum TypeKind {
    Action = "Action",
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
    Time = "Time",
    Type = "Type",
    Unknown = "Unknown",
}

export const enum ExtendedTypeKind {
    AnyUnion = "AnyUnion",
    CustomRecord = "CustomRecord",
    CustomTable = "CustomTable",
}

export interface IType {
    readonly kind: TypeKind;
    readonly maybeExtendedKind: undefined | ExtendedTypeKind;
    readonly isNullable: boolean;
}

export interface PrimitiveType extends IType {
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

export interface DefinedRecord extends IExtendedType {
    readonly kind: TypeKind.Record;
    readonly maybeExtendedKind: ExtendedTypeKind.CustomRecord;
    readonly fields: Map<string, TType>;
}

export interface DefinedTable extends IExtendedType {
    readonly kind: TypeKind.Record;
    readonly maybeExtendedKind: ExtendedTypeKind.CustomTable;
    readonly fields: Map<string, TType>;
}

export interface ParameterType extends IExtendedType {
    readonly isOptional: boolean;
}

export interface SimplifiedNullablePrimitiveType {
    readonly typeKind: TypeKind;
    readonly isNullable: boolean;
}
