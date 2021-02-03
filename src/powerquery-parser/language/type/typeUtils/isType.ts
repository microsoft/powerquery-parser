// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert } from "../../../common";

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

export function isFieldSpecificationList(type: Type.TType): type is Type.TType & Type.FieldSpecificationList {
    return (
        (type.kind === Type.TypeKind.Record && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedRecord) ||
        (type.kind === Type.TypeKind.Table && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedTable) ||
        (type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.RecordType) ||
        (type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.TableType)
    );
}

export function isFunction(type: Type.TType): type is Type.Function | Type.DefinedFunction {
    return type.kind === Type.TypeKind.Function;
}

export function isFunctionSignature(type: Type.TType): type is Type.TType & Type.FunctionSignature {
    return (
        (type.kind === Type.TypeKind.Function && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) ||
        (type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.FunctionType)
    );
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

export function isNumberLiteral(type: Type.TType): type is Type.NumberLiteral {
    return type.kind === Type.TypeKind.Number && type.maybeExtendedKind === Type.ExtendedTypeKind.NumberLiteral;
}

export function isPrimaryPrimitiveType(type: Type.TType): type is Type.PrimaryPrimitiveType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.PrimaryPrimitiveType;
}

export function isRecord(type: Type.TType): type is Type.TRecord {
    return type.kind === Type.TypeKind.Record;
}

export function isRecordType(type: Type.TType): type is Type.RecordType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.RecordType;
}

export function isTable(type: Type.TType): type is Type.TTable {
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

export function isTextLiteral(type: Type.TType): type is Type.TextLiteral {
    return type.kind === Type.TypeKind.Text && type.maybeExtendedKind === Type.ExtendedTypeKind.TextLiteral;
}

export function isTime(type: Type.TType): type is Type.Time {
    return type.kind === Type.TypeKind.Time;
}

export function isTPrimitiveType(type: Type.TType): type is Type.TPrimitiveType {
    switch (type.kind) {
        case Type.TypeKind.Action:
        case Type.TypeKind.Any:
        case Type.TypeKind.AnyNonNull:
        case Type.TypeKind.Binary:
        case Type.TypeKind.Date:
        case Type.TypeKind.DateTime:
        case Type.TypeKind.DateTimeZone:
        case Type.TypeKind.Duration:
        case Type.TypeKind.Function:
        case Type.TypeKind.List:
        case Type.TypeKind.Logical:
        case Type.TypeKind.None:
        case Type.TypeKind.Null:
        case Type.TypeKind.Number:
        case Type.TypeKind.Record:
        case Type.TypeKind.Table:
        case Type.TypeKind.Text:
        case Type.TypeKind.Time:
        case Type.TypeKind.Type:
            return type.maybeExtendedKind === undefined;

        case Type.TypeKind.Unknown:
        case Type.TypeKind.NotApplicable:
            return false;

        default:
            throw Assert.isNever(type);
    }
}

export function isTPrimitiveTypeLiteral(type: Type.TType): type is Type.TPrimitiveTypeLiteral {
    return (
        type.maybeExtendedKind === Type.ExtendedTypeKind.TextLiteral ||
        type.maybeExtendedKind === Type.ExtendedTypeKind.NumberLiteral
    );
}

export function isType(type: Type.TType): type is Type.Type {
    return type.kind === Type.TypeKind.Type;
}

export function isUnknown(type: Type.TType): type is Type.Unknown {
    return type.kind === Type.TypeKind.Unknown;
}
