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
    readonly fields: Map<string, TypeKind>;
}

export interface DefinedTable extends IExtendedType {
    readonly kind: TypeKind.Record;
    readonly maybeExtendedKind: ExtendedTypeKind.CustomTable;
    readonly fields: Map<string, TypeKind>;
}

// export interface IExtendedType {
//     readonly kind: TExtendedTypeKind;
//     readonly maybeExtendedKind: ExtendedTypeKind;
//     readonly isNullable: boolean;
// }

// export interface ExtendedRecord extends IExtendedType {
//     readonly kind: TExtendedTypeKind;
//     readonly maybeExtendedKind: ExtendedTypeKind;
//     readonly isNullable: boolean;
// }

// function isExtendedType<T>(ttype: TType): ttype is TExtendedType {
//     return ttype.maybeExtendedKind !== undefined;
// }

// function maybeAsExtendedType<T>(ttype: TType, extendedTypeKind: ExtendedTypeKind): undefined | (T & TExtendedType) {
//     if (!isExtendedType(ttype)) {
//         return undefined;
//     }

//     switch (extendedTypeKind) {
//         case ExtendedTypeKind.Record:
//             return;
//     }
// }

// export interface ICustomType {
//     readonly kind: TExtendedTypeKind;
//     readonly isNullable: boolean;
//     readonly isCustom: boolean;
// }

// export interface IRecord extends ICustomType {
//     readonly kind: TypeKind.Record;
//     readonly isCustom: boolean;
// }

// export interface RecordType extends IRecord {
//     readonly isCustom: false;
// }

// export interface CustomRecordType extends IRecord {
//     readonly isCustom: true;
//     readonly fields: Map<string, undefined | TypeKind>;
// }

// export interface ITable extends ICustomType {
//     readonly kind: TypeKind.Table;
//     readonly isCustom: boolean;
// }

// export interface TableType extends ITable {
//     readonly isCustom: false;
// }

// export interface CustomTableType extends ITable {
//     readonly isCustom: true;
//     readonly fields: Map<string, undefined | TypeKind>;
// }

// export interface IFunctionExpression extends IType {
//     readonly kind: TypeKind.Function;
//     readonly isEach: boolean;
//     readonly isReturnNullable: boolean;
//     readonly returnType: TypeKind;
// }

// export interface EachFunctionExpressionType extends IFunctionExpression {
//     readonly isEach: true;
//     readonly returnType: TypeKind;
// }

// export interface FunctionExpressionType extends IFunctionExpression {
//     readonly isEach: false;
//     readonly parameters: ReadonlyArray<FunctionParameter>;
// }

// export type TFunctionExpression = EachFunctionExpressionType | FunctionExpressionType;

// // export type FunctionExpressionType = FunctionExpression & IType & { readonly kind: TypeKind.Function };

// export interface FunctionParameter {
//     readonly name: Ast.Identifier;
//     readonly isOptional: boolean;
//     readonly isNullable: boolean;
//     readonly maybeType: Ast.TConstantKind | undefined;
// }

export interface SimplifiedNullablePrimitiveType {
    readonly typeKind: TypeKind;
    readonly isNullable: boolean;
}
