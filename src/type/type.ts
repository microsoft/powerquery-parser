// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../parser";

export type TType = TFunctionExpression | IType | TExtendedType;

export type TExtendedType = TFunctionExpressionType | TRecordType | TTableType;
export type TExtendedTypeKind = TypeKind.Record | TypeKind.Table;

export type TFunctionExpressionType = EachFunctionExpressionType | FunctionExpressionType;
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
    readonly kind: Exclude<TypeKind, TExtendedTypeKind>;
    readonly isNullable: boolean;
}

export interface ICustomType {
    readonly kind: TExtendedTypeKind;
    readonly isNullable: boolean;
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

export interface IFunctionExpression extends IType {
    readonly kind: TypeKind.Function;
    readonly isEach: boolean;
    readonly isReturnNullable: boolean;
    readonly returnType: TypeKind;
}

export interface EachFunctionExpressionType extends IFunctionExpression {
    readonly isEach: true;
    readonly returnType: TypeKind;
}

export interface FunctionExpressionType extends IFunctionExpression {
    readonly isEach: false;
    readonly parameters: ReadonlyArray<FunctionParameter>;
}

export type TFunctionExpression = EachFunctionExpressionType | FunctionExpressionType;

// export type FunctionExpressionType = FunctionExpression & IType & { readonly kind: TypeKind.Function };

export interface FunctionParameter {
    readonly name: Ast.Identifier;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: Ast.TConstantKind | undefined;
}

export interface SimplifiedNullablePrimitiveType {
    readonly typeKind: TypeKind;
    readonly isNullable: boolean;
}
