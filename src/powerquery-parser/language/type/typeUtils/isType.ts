// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";

export function isAction(type: Type.TType): type is Type.Action {
    return type.kind === Type.TypeKind.Action;
}

export function isAny(type: Type.TType): type is Type.Any | Type.AnyUnion {
    return type.kind === Type.TypeKind.Any;
}

export function isAnyUnion(type: Type.TType): type is Type.AnyUnion {
    return type.kind === Type.TypeKind.Any && type.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion;
}

export function isAnyNonNull(type: Type.TType): type is Type.AnyNonNull {
    return type.kind === Type.TypeKind.AnyNonNull;
}

export function isBinary(type: Type.TType): type is Type.Binary {
    return type.kind === Type.TypeKind.Binary;
}

export function isDate(type: Type.TType): type is Type.Date {
    return type.kind === Type.TypeKind.Date;
}

export function isDateTime(type: Type.TType): type is Type.DateTime {
    return type.kind === Type.TypeKind.DateTime;
}

export function isDateTimeZone(type: Type.TType): type is Type.DateTimeZone {
    return type.kind === Type.TypeKind.DateTimeZone;
}

export function isDefinedFunction(type: Type.TType): type is Type.DefinedFunction {
    return type.kind === Type.TypeKind.Function && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction;
}

export function isDefinedList(type: Type.TType): type is Type.DefinedList {
    return type.kind === Type.TypeKind.List && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedList;
}

export function isDefinedListType(type: Type.TType): type is Type.DefinedListType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedListType;
}

export function isDefinedRecord(type: Type.TType): type is Type.DefinedRecord {
    return type.kind === Type.TypeKind.Record && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedRecord;
}

export function isDefinedTable(type: Type.TType): type is Type.DefinedTable {
    return type.kind === Type.TypeKind.Table && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedTable;
}

export function isDuration(type: Type.TType): type is Type.Duration {
    return type.kind === Type.TypeKind.Duration;
}

export function isFunction(type: Type.TType): type is Type.Function | Type.DefinedFunction {
    return type.kind === Type.TypeKind.Function;
}

export function isFunctionType(type: Type.TType): type is Type.FunctionType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.FunctionType;
}

export function isList(type: Type.TType): type is Type.List | Type.DefinedList {
    return type.kind === Type.TypeKind.List;
}

export function isLogical(type: Type.TType): type is Type.Logical {
    return type.kind === Type.TypeKind.Logical;
}

export function isNone(type: Type.TType): type is Type.None {
    return type.kind === Type.TypeKind.None;
}

export function isNotApplicable(type: Type.TType): type is Type.NotApplicable {
    return type.kind === Type.TypeKind.NotApplicable;
}

export function isNull(type: Type.TType): type is Type.Null {
    return type.kind === Type.TypeKind.Null;
}

export function isNumber(type: Type.TType): type is Type.Number {
    return type.kind === Type.TypeKind.Number;
}

export function isPrimaryPrimitiveType(type: Type.TType): type is Type.PrimaryPrimitiveType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.PrimaryPrimitiveType;
}

export function isRecord(type: Type.TType): type is Type.Record | Type.DefinedRecord {
    return type.kind === Type.TypeKind.Record;
}

export function isRecordType(type: Type.TType): type is Type.RecordType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.RecordType;
}

export function isTable(type: Type.TType): type is Type.Table | Type.DefinedTable {
    return type.kind === Type.TypeKind.Table;
}

export function isTableType(type: Type.TType): type is Type.TableType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.TableType;
}

export function isTableTypePrimaryExpression(type: Type.TType): type is Type.TableTypePrimaryExpression {
    return (
        type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.TableTypePrimaryExpression
    );
}

export function isText(type: Type.TType): type is Type.Text {
    return type.kind === Type.TypeKind.Text;
}

export function isTime(type: Type.TType): type is Type.Time {
    return type.kind === Type.TypeKind.Time;
}

export function isType(type: Type.TType): type is Type.Type {
    return type.kind === Type.TypeKind.Type;
}

export function isUnknown(type: Type.TType): type is Type.Unknown {
    return type.kind === Type.TypeKind.Unknown;
}
