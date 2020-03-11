// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TType = IType | TCustomType;

export type TCustomType = TFunctionType | TRecordType | TTableType;
export type TCustomTypeKind = TypeKind.Function | TypeKind.Record | TypeKind.Table;

export type TFunctionType = FunctionType | EachFunctionType;
export type TRecordType = RecordType | CustomRecordType;
export type TTableType = TableType | CustomTableType;

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

export interface IType {
    readonly kind: Exclude<TypeKind, TCustomTypeKind>;
}

export interface ICustomType {
    readonly kind: TCustomTypeKind;
    readonly isCustom: boolean;
}

export interface IRecord extends ICustomType {
    readonly kind: TypeKind.Record;
    readonly isCustom: boolean;
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
    readonly isCustom: boolean;
}

export interface TableType extends ITable {
    readonly isCustom: false;
}

export interface CustomTableType extends ITable {
    readonly isCustom: true;
    readonly fields: Map<string, undefined | TypeKind>;
}

export interface IFunctionType {
    readonly kind: TypeKind.Function;
    readonly isEachExpression: boolean;
}

export interface EachFunctionType extends IFunctionType {
    readonly isEachExpression: true;
}

export interface FunctionType extends IFunctionType {
    readonly isEachExpression: false;
}
