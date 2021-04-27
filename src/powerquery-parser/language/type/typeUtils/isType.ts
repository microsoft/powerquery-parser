// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert } from "../../../common";

export function isAction(type: Type.TPowerQueryType): type is Type.Action {
    return type.kind === Type.TypeKind.Action;
}

export function isAny(type: Type.TPowerQueryType): type is Type.TAny {
    return type.kind === Type.TypeKind.Any;
}

export function isAnyUnion(type: Type.TPowerQueryType): type is Type.AnyUnion {
    return type.kind === Type.TypeKind.Any && type.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion;
}

export function isAnyNonNull(type: Type.TPowerQueryType): type is Type.AnyNonNull {
    return type.kind === Type.TypeKind.AnyNonNull;
}

export function isBinary(type: Type.TPowerQueryType): type is Type.Binary {
    return type.kind === Type.TypeKind.Binary;
}

export function isDate(type: Type.TPowerQueryType): type is Type.Date {
    return type.kind === Type.TypeKind.Date;
}

export function isDateTime(type: Type.TPowerQueryType): type is Type.DateTime {
    return type.kind === Type.TypeKind.DateTime;
}

export function isDateTimeZone(type: Type.TPowerQueryType): type is Type.DateTimeZone {
    return type.kind === Type.TypeKind.DateTimeZone;
}

export function isDefinedFunction(type: Type.TPowerQueryType): type is Type.DefinedFunction {
    return type.kind === Type.TypeKind.Function && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction;
}

export function isDefinedList(type: Type.TPowerQueryType): type is Type.DefinedList {
    return type.kind === Type.TypeKind.List && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedList;
}

export function isDefinedListType(type: Type.TPowerQueryType): type is Type.DefinedListType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedListType;
}

export function isDefinedRecord(type: Type.TPowerQueryType): type is Type.DefinedRecord {
    return type.kind === Type.TypeKind.Record && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedRecord;
}

export function isDefinedTable(type: Type.TPowerQueryType): type is Type.DefinedTable {
    return type.kind === Type.TypeKind.Table && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedTable;
}

export function isDuration(type: Type.TPowerQueryType): type is Type.Duration {
    return type.kind === Type.TypeKind.Duration;
}

export function isFieldSpecificationList(
    type: Type.TPowerQueryType,
): type is Type.TPowerQueryType & Type.FieldSpecificationList {
    return (
        (type.kind === Type.TypeKind.Record && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedRecord) ||
        (type.kind === Type.TypeKind.Table && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedTable) ||
        (type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.RecordType) ||
        (type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.TableType)
    );
}

export function isFunction(type: Type.TPowerQueryType): type is Type.TFunction {
    return type.kind === Type.TypeKind.Function;
}

export function isFunctionSignature(type: Type.TPowerQueryType): type is Type.TPowerQueryType & Type.FunctionSignature {
    return (
        (type.kind === Type.TypeKind.Function && type.maybeExtendedKind === Type.ExtendedTypeKind.DefinedFunction) ||
        (type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.FunctionType)
    );
}

export function isFunctionType(type: Type.TPowerQueryType): type is Type.FunctionType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.FunctionType;
}

export function isList(type: Type.TPowerQueryType): type is Type.TList {
    return type.kind === Type.TypeKind.List;
}

export function isLiteral(type: Type.TPowerQueryType): type is Type.TLiteral {
    return (
        type.maybeExtendedKind === Type.ExtendedTypeKind.TextLiteral ||
        type.maybeExtendedKind === Type.ExtendedTypeKind.NumberLiteral
    );
}

export function isLogical(type: Type.TPowerQueryType): type is Type.TLogical {
    return type.kind === Type.TypeKind.Logical;
}

export function isLogicalLiteral(type: Type.TPowerQueryType): type is Type.LogicalLiteral {
    return type.kind === Type.TypeKind.Logical && type.maybeExtendedKind === Type.ExtendedTypeKind.LogicalLiteral;
}

export function isNone(type: Type.TPowerQueryType): type is Type.None {
    return type.kind === Type.TypeKind.None;
}

export function isNotApplicable(type: Type.TPowerQueryType): type is Type.NotApplicable {
    return type.kind === Type.TypeKind.NotApplicable;
}

export function isNull(type: Type.TPowerQueryType): type is Type.Null {
    return type.kind === Type.TypeKind.Null;
}

export function isNumber(type: Type.TPowerQueryType): type is Type.Number {
    return type.kind === Type.TypeKind.Number;
}

export function isNumberLiteral(type: Type.TPowerQueryType): type is Type.NumberLiteral {
    return type.kind === Type.TypeKind.Number && type.maybeExtendedKind === Type.ExtendedTypeKind.NumberLiteral;
}

export function isPrimaryPrimitiveType(type: Type.TPowerQueryType): type is Type.PrimaryPrimitiveType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.PrimaryPrimitiveType;
}

export function isRecord(type: Type.TPowerQueryType): type is Type.TRecord {
    return type.kind === Type.TypeKind.Record;
}

export function isRecordType(type: Type.TPowerQueryType): type is Type.RecordType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.RecordType;
}

export function isTable(type: Type.TPowerQueryType): type is Type.TTable {
    return type.kind === Type.TypeKind.Table;
}

export function isTableType(type: Type.TPowerQueryType): type is Type.TableType {
    return type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.TableType;
}

export function isTableTypePrimaryExpression(type: Type.TPowerQueryType): type is Type.TableTypePrimaryExpression {
    return (
        type.kind === Type.TypeKind.Type && type.maybeExtendedKind === Type.ExtendedTypeKind.TableTypePrimaryExpression
    );
}

export function isText(type: Type.TPowerQueryType): type is Type.Text {
    return type.kind === Type.TypeKind.Text;
}

export function isTextLiteral(type: Type.TPowerQueryType): type is Type.TextLiteral {
    return type.kind === Type.TypeKind.Text && type.maybeExtendedKind === Type.ExtendedTypeKind.TextLiteral;
}

export function isTime(type: Type.TPowerQueryType): type is Type.Time {
    return type.kind === Type.TypeKind.Time;
}

export function isTPrimitiveType(type: Type.TPowerQueryType): type is Type.TPrimitiveType {
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

export function isType(type: Type.TPowerQueryType): type is Type.Type {
    return type.kind === Type.TypeKind.Type;
}

export function isUnknown(type: Type.TPowerQueryType): type is Type.Unknown {
    return type.kind === Type.TypeKind.Unknown;
}
