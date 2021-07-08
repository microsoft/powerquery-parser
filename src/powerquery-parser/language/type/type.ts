// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { OrderedMap } from "../../common";

// A representation of a type can be either an extended type, or a non-extended type.
// Non-extended types are the types you traditionally find in Power Query, eg. `number`, `text`, etc.
//
// Extended types are an extension to the Power Query language.
// For example, you can treat `1` as a subtype of `number`.
export type TPowerQueryType = TPrimitiveType | TExtendedType;
export type TExtendedType =
    | AnyUnion
    | DefinedFunction
    | DefinedList
    | DefinedListType
    | DefinedRecord
    | DefinedTable
    | FunctionType
    | ListType
    | LogicalLiteral
    | NumberLiteral
    | PrimaryPrimitiveType
    | RecordType
    | TableType
    | TableTypePrimaryExpression
    | TextLiteral;
export type TExtendedTypeKind =
    | TypeKind.Any
    | TypeKind.Function
    | TypeKind.List
    | TypeKind.Logical
    | TypeKind.Number
    | TypeKind.Record
    | TypeKind.Table
    | TypeKind.Text
    | TypeKind.Type;

export type TLiteral = LogicalLiteral | NumberLiteral | TextLiteral;
export type TLiteralKind =
    | ExtendedTypeKind.LogicalLiteral
    | ExtendedTypeKind.NumberLiteral
    | ExtendedTypeKind.TextLiteral;

export type TAny = Any | AnyUnion;
export type TList = List | DefinedList;
export type TLogical = Logical | LogicalLiteral;
export type TFunction = Function | DefinedFunction;
export type TNumber = Number | NumberLiteral;
export type TRecord = Record | DefinedRecord;
export type TTable = Table | DefinedTable;
export type TText = Text | TextLiteral;
export type TType =
    | Type
    | DefinedListType
    | FunctionType
    | ListType
    | PrimaryPrimitiveType
    | RecordType
    | TableType
    | TableTypePrimaryExpression;

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

// Key value pairs for Records and Tables,
// where tables have ordered pairs and records have unordered pairs.
export type TFieldSpecificationList = FieldSpecificationList<TFields>;
export type TFields = OrderedFields | UnorderedFields;
export type OrderedFields = OrderedMap<string, TPowerQueryType>;
export type UnorderedFields = Map<string, TPowerQueryType>;

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
    // There can be nodes which are typable but contain non-typable children, such as RecordExpressions.
    NotApplicable = "NotApplicable",
    // Something that can't be typed due to a lack of information.
    // Eg. '[', a RecordExpression where the user hasn't entered any fields for.
    Unknown = "Unknown",
}

export const enum ExtendedTypeKind {
    // In Power Query if you want a union type, such as when a function returns either a `text` OR a `number`,
    // then you're only option is to give it the 'any' type.
    // This is a narrower definition which restricts that typing to the union `text | number`.
    AnyUnion = "AnyUnion",

    // A function with known paramaters and a known return type.
    DefinedFunction = "DefinedFunction",

    // A list of known size and a typing for each element in the list.
    // Eg. `{1, "foo"}
    DefinedList = "DefinedList",

    // A narrower typing for ListType, used to validate a DefinedList.
    DefinedListType = "DefinedListType",

    // A list of known fields and typing for each field.
    // An open record: `[a=1, b=2, ...]`
    // A closed record: `[a=1, b=2]`
    DefinedRecord = "DefinedRecord",

    // See details on DefinedRecord. They are functionally the same.
    DefinedTable = "DefinedTable",

    // `type function (x as number, optional y) => number`
    FunctionType = "FunctionType",

    // `type list { number }`
    ListType = "ListType",

    // true
    LogicalLiteral = "LogicalLiteral",

    // `1`
    NumberLiteral = "NumberLiteral",

    // `type number`
    PrimaryPrimitiveType = "PrimaryPrimitiveType",

    // `type record [ a, b = number, ...]`
    RecordType = "RecordType",

    // '"foo"`
    TextLiteral = "TextLiteral",

    // `type table [a, b = text]
    TableType = "TableType",

    // The docs say `table-type` only accepts a `field-specification-list` for `row-type`,
    // but the parser also accepts primary-expression. This handles that edge case.
    TableTypePrimaryExpression = "TableTypePrimaryExpression",
}

export interface IType<T extends TypeKind = TypeKind> {
    readonly kind: T;
    readonly maybeExtendedKind: ExtendedTypeKind | undefined;
    readonly isNullable: boolean;
}

export interface IExtendedType extends IType {
    readonly kind: TExtendedTypeKind;
    readonly maybeExtendedKind: ExtendedTypeKind;
}

export interface IPrimitiveLiteral extends IExtendedType {
    readonly literal: string;
}

export interface IPrimitiveType<T extends TypeKind = TypeKind> extends IType<T> {
    readonly maybeExtendedKind: undefined;
}

// ------------------------------------------
// ---------- Non-IType Interfaces ----------
// ------------------------------------------

export interface FieldSpecificationList<T extends TFields> {
    readonly fields: T;
    readonly isOpen: boolean;
}

export interface FunctionSignature {
    readonly parameters: ReadonlyArray<FunctionParameter>;
    readonly returnType: TPowerQueryType;
}

export interface SimplifiedNullablePrimitiveType {
    readonly typeKind: TypeKind;
    readonly isNullable: boolean;
}

export interface FunctionParameter {
    // Technically a parameter's name isn't part of its type,
    // but it's useful to have when inspecting parameters.
    readonly nameLiteral: string;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: TypeKind | undefined;
}

// -------------------------------------------
// ---------- IType Implementations ----------
// -------------------------------------------

export interface AnyUnion extends IExtendedType {
    readonly kind: TypeKind.Any;
    readonly maybeExtendedKind: ExtendedTypeKind.AnyUnion;
    readonly unionedTypePairs: ReadonlyArray<TPowerQueryType>;
}

export type DefinedFunction = IExtendedType &
    FunctionSignature & {
        readonly kind: TypeKind.Function;
        readonly maybeExtendedKind: ExtendedTypeKind.DefinedFunction;
    };

// A list which has a finite number of elements.
export interface DefinedList extends IExtendedType {
    readonly kind: TypeKind.List;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedList;
    readonly elements: ReadonlyArray<TPowerQueryType>;
}

// A ListType for DefinedList
export interface DefinedListType extends IExtendedType {
    readonly kind: TypeKind.Type;
    readonly maybeExtendedKind: ExtendedTypeKind.DefinedListType;
    readonly itemTypes: ReadonlyArray<TPowerQueryType>;
}

export type DefinedRecord = IExtendedType &
    FieldSpecificationList<UnorderedFields> & {
        readonly kind: TypeKind.Record;
        readonly maybeExtendedKind: ExtendedTypeKind.DefinedRecord;
    };

export type DefinedTable = IExtendedType &
    FieldSpecificationList<OrderedFields> & {
        readonly kind: TypeKind.Table;
        readonly maybeExtendedKind: ExtendedTypeKind.DefinedTable;
    };

export type FunctionType = IExtendedType &
    FunctionSignature & {
        readonly kind: TypeKind.Type;
        readonly maybeExtendedKind: ExtendedTypeKind.FunctionType;
    };

export interface ListType extends IExtendedType {
    readonly kind: TypeKind.Type;
    readonly maybeExtendedKind: ExtendedTypeKind.ListType;
    readonly itemType: TPowerQueryType;
}

export interface LogicalLiteral extends IPrimitiveLiteral {
    readonly kind: TypeKind.Logical;
    readonly maybeExtendedKind: ExtendedTypeKind.LogicalLiteral;
    readonly normalizedLiteral: boolean;
}

export interface NumberLiteral extends IPrimitiveLiteral {
    readonly kind: TypeKind.Number;
    readonly maybeExtendedKind: ExtendedTypeKind.NumberLiteral;
    readonly normalizedLiteral: number;
}

export interface PrimaryPrimitiveType extends IExtendedType {
    readonly kind: TypeKind.Type;
    readonly maybeExtendedKind: ExtendedTypeKind.PrimaryPrimitiveType;
    readonly primitiveType: TPrimitiveType;
}

export type RecordType = IExtendedType &
    FieldSpecificationList<UnorderedFields> & {
        readonly kind: TypeKind.Type;
        readonly maybeExtendedKind: ExtendedTypeKind.RecordType;
    };

export type TableType = IExtendedType &
    FieldSpecificationList<UnorderedFields> & {
        readonly kind: TypeKind.Type;
        readonly maybeExtendedKind: ExtendedTypeKind.TableType;
    };

export interface TableTypePrimaryExpression extends IExtendedType {
    readonly kind: TypeKind.Type;
    readonly maybeExtendedKind: ExtendedTypeKind.TableTypePrimaryExpression;
    readonly primaryExpression: TPowerQueryType;
}

export interface TextLiteral extends IPrimitiveLiteral {
    readonly kind: TypeKind.Text;
    readonly maybeExtendedKind: ExtendedTypeKind.TextLiteral;
}

// -------------------------------------------------------
// ---------- Non-nullable primitive singletons ----------
// -------------------------------------------------------

export const ActionInstance: IPrimitiveType<TypeKind.Action> = createPrimitiveType(TypeKind.Action, false);
export const AnyInstance: IPrimitiveType<TypeKind.Any> = createPrimitiveType(TypeKind.Any, false);
export const AnyNonNullInstance: IPrimitiveType<TypeKind.AnyNonNull> = createPrimitiveType(TypeKind.AnyNonNull, false);
export const BinaryInstance: IPrimitiveType<TypeKind.Binary> = createPrimitiveType(TypeKind.Binary, false);
export const DateInstance: IPrimitiveType<TypeKind.Date> = createPrimitiveType(TypeKind.Date, false);
export const DateTimeInstance: IPrimitiveType<TypeKind.DateTime> = createPrimitiveType(TypeKind.DateTime, false);
export const DateTimeZoneInstance: IPrimitiveType<TypeKind.DateTimeZone> = createPrimitiveType(
    TypeKind.DateTimeZone,
    false,
);
export const DurationInstance: IPrimitiveType<TypeKind.Duration> = createPrimitiveType(TypeKind.Duration, false);
export const FunctionInstance: IPrimitiveType<TypeKind.Function> = createPrimitiveType(TypeKind.Function, false);
export const ListInstance: IPrimitiveType<TypeKind.List> = createPrimitiveType(TypeKind.List, false);
export const LogicalInstance: IPrimitiveType<TypeKind.Logical> = createPrimitiveType(TypeKind.Logical, false);
export const NoneInstance: IPrimitiveType<TypeKind.None> = createPrimitiveType(TypeKind.None, false);
export const NotApplicableInstance: IPrimitiveType<TypeKind.NotApplicable> = createPrimitiveType(
    TypeKind.NotApplicable,
    false,
);
export const NullInstance: IPrimitiveType<TypeKind.Null> = createPrimitiveType(TypeKind.Null, false);
export const NumberInstance: IPrimitiveType<TypeKind.Number> = createPrimitiveType(TypeKind.Number, false);
export const RecordInstance: IPrimitiveType<TypeKind.Record> = createPrimitiveType(TypeKind.Record, false);
export const TableInstance: IPrimitiveType<TypeKind.Table> = createPrimitiveType(TypeKind.Table, false);
export const TextInstance: IPrimitiveType<TypeKind.Text> = createPrimitiveType(TypeKind.Text, false);
export const TimeInstance: IPrimitiveType<TypeKind.Time> = createPrimitiveType(TypeKind.Time, false);
export const TypePrimitiveInstance: IPrimitiveType<TypeKind.Type> = createPrimitiveType(TypeKind.Type, false);
export const UnknownInstance: IPrimitiveType<TypeKind.Unknown> = createPrimitiveType(TypeKind.Unknown, false);

// ---------------------------------------------------
// ---------- Nullable primitive singletons ----------
// ---------------------------------------------------

export const NullableActionInstance: IPrimitiveType<TypeKind.Action> = createPrimitiveType(TypeKind.Action, true);
export const NullableAnyInstance: IPrimitiveType<TypeKind.Any> = createPrimitiveType(TypeKind.Any, true);
export const NullableBinaryInstance: IPrimitiveType<TypeKind.Binary> = createPrimitiveType(TypeKind.Binary, true);
export const NullableDateInstance: IPrimitiveType<TypeKind.Date> = createPrimitiveType(TypeKind.Date, true);
export const NullableDateTimeInstance: IPrimitiveType<TypeKind.DateTime> = createPrimitiveType(TypeKind.DateTime, true);
export const NullableDateTimeZoneInstance: IPrimitiveType<TypeKind.DateTimeZone> = createPrimitiveType(
    TypeKind.DateTimeZone,
    true,
);
export const NullableDurationInstance: IPrimitiveType<TypeKind.Duration> = createPrimitiveType(TypeKind.Duration, true);
export const NullableFunctionInstance: IPrimitiveType<TypeKind.Function> = createPrimitiveType(TypeKind.Function, true);
export const NullableListInstance: IPrimitiveType<TypeKind.List> = createPrimitiveType(TypeKind.List, true);
export const NullableLogicalInstance: IPrimitiveType<TypeKind.Logical> = createPrimitiveType(TypeKind.Logical, true);
export const NullableNoneInstance: IPrimitiveType<TypeKind.None> = createPrimitiveType(TypeKind.None, true);
export const NullableNotApplicableInstance: IPrimitiveType<TypeKind.NotApplicable> = createPrimitiveType(
    TypeKind.NotApplicable,
    true,
);
export const NullableNullInstance: IPrimitiveType<TypeKind.Null> = createPrimitiveType(TypeKind.Null, true);
export const NullableNumberInstance: IPrimitiveType<TypeKind.Number> = createPrimitiveType(TypeKind.Number, true);
export const NullableRecordInstance: IPrimitiveType<TypeKind.Record> = createPrimitiveType(TypeKind.Record, true);
export const NullableTableInstance: IPrimitiveType<TypeKind.Table> = createPrimitiveType(TypeKind.Table, true);
export const NullableTextInstance: IPrimitiveType<TypeKind.Text> = createPrimitiveType(TypeKind.Text, true);
export const NullableTimeInstance: IPrimitiveType<TypeKind.Time> = createPrimitiveType(TypeKind.Time, true);
export const NullableTypeInstance: IPrimitiveType<TypeKind.Type> = createPrimitiveType(TypeKind.Type, true);
export const NullableUnknownInstance: IPrimitiveType<TypeKind.Unknown> = createPrimitiveType(TypeKind.Unknown, true);

// ----------------------------------------------
// ---------- Non-primitive singletons ----------
// ----------------------------------------------

export const FalseInstance: LogicalLiteral = createLogicalLiteral(false, false);
export const TrueInstance: LogicalLiteral = createLogicalLiteral(false, true);
export const NullableFalseInstance: LogicalLiteral = createLogicalLiteral(true, false);
export const NullableTrueInstance: LogicalLiteral = createLogicalLiteral(true, true);

export const PrimitiveInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable: false,
    unionedTypePairs: [
        ActionInstance,
        AnyInstance,
        AnyNonNullInstance,
        BinaryInstance,
        DateInstance,
        DateTimeInstance,
        DateTimeZoneInstance,
        DurationInstance,
        FunctionInstance,
        ListInstance,
        LogicalInstance,
        NoneInstance,
        NotApplicableInstance,
        NullInstance,
        NumberInstance,
        RecordInstance,
        TableInstance,
        TextInstance,
        TimeInstance,
        TypePrimitiveInstance,
    ],
};

export const NullablePrimitiveInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable: true,
    unionedTypePairs: [
        NullableActionInstance,
        NullableAnyInstance,
        NullableBinaryInstance,
        NullableDateInstance,
        NullableDateTimeInstance,
        NullableDateTimeZoneInstance,
        NullableDurationInstance,
        NullableFunctionInstance,
        NullableListInstance,
        NullableLogicalInstance,
        NullableNoneInstance,
        NullableNotApplicableInstance,
        NullableNullInstance,
        NullableNumberInstance,
        NullableRecordInstance,
        NullableTableInstance,
        NullableTextInstance,
        NullableTimeInstance,
        NullableTypeInstance,
    ],
};

export const ExpressionInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable: PrimitiveInstance.isNullable || NullablePrimitiveInstance.isNullable,
    unionedTypePairs: [...PrimitiveInstance.unionedTypePairs, ...NullablePrimitiveInstance.unionedTypePairs],
};

export const LiteralExpressionInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable:
        LogicalInstance.isNullable || NumberInstance.isNullable || TextInstance.isNullable || NullInstance.isNullable,
    unionedTypePairs: [LogicalInstance, NumberInstance, TextInstance, NullInstance],
};

export const PrimaryExpressionInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable: LiteralExpressionInstance.isNullable || ListInstance.isNullable || RecordInstance.isNullable,
    unionedTypePairs: [...LiteralExpressionInstance.unionedTypePairs, ListInstance, RecordInstance],
};

export const PrimaryTypeInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable: true,
    unionedTypePairs: [...PrimitiveInstance.unionedTypePairs, ...NullablePrimitiveInstance.unionedTypePairs],
};

export const TypeProductionInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable: ExpressionInstance.isNullable || PrimaryTypeInstance.isNullable,
    unionedTypePairs: [...ExpressionInstance.unionedTypePairs, ...PrimaryTypeInstance.unionedTypePairs],
};

export const TypeExpressionInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable: PrimaryExpressionInstance.isNullable || PrimaryTypeInstance.isNullable,
    unionedTypePairs: [PrimaryExpressionInstance, PrimaryTypeInstance],
};

export const AnyLiteralInstance: AnyUnion = {
    kind: TypeKind.Any,
    maybeExtendedKind: ExtendedTypeKind.AnyUnion,
    isNullable:
        RecordInstance.isNullable ||
        ListInstance.isNullable ||
        LogicalInstance.isNullable ||
        NumberInstance.isNullable ||
        TextInstance.isNullable ||
        NullInstance.isNullable,
    unionedTypePairs: [RecordInstance, ListInstance, LogicalInstance, NumberInstance, TextInstance, NullInstance],
};

// --------------------------------------
// ---------- Helper functions ----------
// --------------------------------------

// Creates IPrimitiveType<T> singleton instances.
function createPrimitiveType<T extends TypeKind>(typeKind: T, isNullable: boolean): IPrimitiveType<T> {
    return {
        kind: typeKind,
        maybeExtendedKind: undefined,
        isNullable,
    };
}

function createLogicalLiteral(isNullable: boolean, normalizedLiteral: boolean): LogicalLiteral {
    return {
        isNullable,
        kind: TypeKind.Logical,
        maybeExtendedKind: ExtendedTypeKind.LogicalLiteral,
        literal: normalizedLiteral ? "true" : "false",
        normalizedLiteral,
    };
}
