// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TType = IType | TRecordType | TTableType;

export type TRecordType = RecordType | CustomRecordType;

export type TTableType = TableType | CustomTableType;

export type TCustomTypeKind = TypeKind.Record | TypeKind.Table;

export const enum TypeKind {
    Action = "Action",
    Any = "Any",
    AnyNonNull = "AnyNonNull",
    Binary = "Binary",
    Date = "Date",
    DateTime = "DateTime",
    DateTimeZone = "DateTimeZone",
    Duration = "Duration",
    Error = "Error",
    Function = "Function",
    List = "List",
    Logical = "Logical",
    Null = "Null",
    Numeric = "Numeric",
    Record = "Record",
    Table = "Table",
    Text = "Text",
    Time = "Time",
    Type = "Type",
    Unknown = "Unknown",
}

export interface IType {
    readonly kind: Exclude<TypeKind, TCustomTypeKind>;
}

export interface ICustomType {
    readonly kind: TCustomTypeKind;
    readonly isCustom: boolean;
}

export interface IRecord extends ICustomType {
    readonly kind: TypeKind.Record;
}

export interface RecordType extends IRecord {
    readonly isCustom: false;
}

export interface CustomRecordType extends IRecord {
    readonly isCustom: true;
    readonly fields: Map<string, undefined | TypeKind>;
}

export interface ITable extends ICustomType {
    readonly kind: TypeKind.Table;
}

export interface TableType extends ITable {
    readonly isCustom: false;
}

export interface CustomTableType extends ITable {
    readonly isCustom: true;
    readonly fields: Map<string, undefined | TypeKind>;
}
