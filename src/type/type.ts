// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type TType = IPrimitiveType | TExtendedType;
export type TExtendedType = AnyUnion | DefinedFunction | DefinedRecordExpression | DefinedTable | DefinedType;
export type TExtendedTypeKind = TypeKind.Any | TypeKind.Function | TypeKind.Record | TypeKind.Table | TypeKind.Type;

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
    DefinedFunction = "DefinedFunction",
    DefinedRecordExpression = "DefinedRecordExpression",
    DefinedTable = "DefinedTable",
    DefinedType = "DefinedType",
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
    readonly parameterTypes: ReadonlyArray<TType>;
    readonly returnType: TType;
}

export interface DefinedRecordExpression extends IExtendedType {
    readonly kind: TypeKind.Record;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedRecordExpression;
    readonly fields: Map<string, TType>;
}

export interface DefinedTable extends IExtendedType {
    readonly kind: TypeKind.Table;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedTable;
    readonly fields: Map<string, TType>;
}

export interface DefinedType extends IExtendedType {
    readonly kind: TypeKind.Type;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedType;
    readonly primaryType: TType;
}

export interface ParameterType extends IExtendedType {
    readonly isOptional: boolean;
}

export interface SimplifiedNullablePrimitiveType {
    readonly typeKind: TypeKind;
    readonly isNullable: boolean;
}
