// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as isType from "./isType";

import { Type } from "..";
import { CommonError } from "../../../common";

export function assertAsAction(type: Type.TType): Type.Action {
    assertIsAction(type);
    return type;
}

export function assertAsAny(type: Type.TType): Type.Any | Type.AnyUnion {
    assertIsAny(type);
    return type;
}

export function assertAsAnyUnion(type: Type.TType): Type.AnyUnion {
    assertIsAnyUnion(type);
    return type;
}

export function assertAsAnyNonNull(type: Type.TType): Type.AnyNonNull {
    assertIsAnyNonNull(type);
    return type;
}

export function assertAsBinary(type: Type.TType): Type.Binary {
    assertIsBinary(type);
    return type;
}

export function assertAsDate(type: Type.TType): Type.Date {
    assertIsDate(type);
    return type;
}

export function assertAsDateTime(type: Type.TType): Type.DateTime {
    assertIsDateTime(type);
    return type;
}

export function assertAsDateTimeZone(type: Type.TType): Type.DateTimeZone {
    assertIsDateTimeZone(type);
    return type;
}

export function assertAsDefinedFunction(type: Type.TType): Type.DefinedFunction {
    assertIsDefinedFunction(type);
    return type;
}

export function assertAsDefinedList(type: Type.TType): Type.DefinedList {
    assertIsDefinedList(type);
    return type;
}

export function assertAsDefinedListType(type: Type.TType): Type.DefinedListType {
    assertIsDefinedListType(type);
    return type;
}

export function assertAsDefinedRecord(type: Type.TType): Type.DefinedRecord {
    assertIsDefinedRecord(type);
    return type;
}

export function assertAsDefinedTable(type: Type.TType): Type.DefinedTable {
    assertIsDefinedTable(type);
    return type;
}

export function assertAsDuration(type: Type.TType): Type.Duration {
    assertIsDuration(type);
    return type;
}

export function assertAsFunction(type: Type.TType): Type.Function | Type.DefinedFunction {
    assertIsFunction(type);
    return type;
}

export function assertAsFunctionType(type: Type.TType): Type.FunctionType {
    assertIsFunctionType(type);
    return type;
}

export function assertAsList(type: Type.TType): Type.List | Type.DefinedList {
    assertIsList(type);
    return type;
}

export function assertAsLogical(type: Type.TType): Type.Logical {
    assertIsLogical(type);
    return type;
}

export function assertAsNone(type: Type.TType): Type.None {
    assertIsNone(type);
    return type;
}

export function assertAsNotApplicable(type: Type.TType): Type.NotApplicable {
    assertIsNotApplicable(type);
    return type;
}

export function assertAsNull(type: Type.TType): Type.Null {
    assertIsNull(type);
    return type;
}

export function assertAsNumber(type: Type.TType): Type.Number {
    assertIsNumber(type);
    return type;
}

export function assertAsPrimaryPrimitiveType(type: Type.TType): Type.PrimaryPrimitiveType {
    assertIsPrimaryPrimitiveType(type);
    return type;
}

export function assertAsRecord(type: Type.TType): Type.Record | Type.DefinedRecord {
    assertIsRecord(type);
    return type;
}

export function assertAsRecordType(type: Type.TType): Type.RecordType {
    assertIsRecordType(type);
    return type;
}

export function assertAsTable(type: Type.TType): Type.Table | Type.DefinedTable {
    assertIsTable(type);
    return type;
}

export function assertAsTableType(type: Type.TType): Type.TableType {
    assertIsTableType(type);
    return type;
}

export function assertAsTableTypePrimaryExpression(type: Type.TType): Type.TableTypePrimaryExpression {
    assertIsTableTypePrimaryExpression(type);
    return type;
}

export function assertAsText(type: Type.TType): Type.Text {
    assertIsText(type);
    return type;
}

export function assertAsTime(type: Type.TType): Type.Time {
    assertIsTime(type);
    return type;
}

export function assertAsType(type: Type.TType): Type.Type {
    assertIsType(type);
    return type;
}

export function assertAsUnknown(type: Type.TType): Type.Unknown {
    assertIsUnknown(type);
    return type;
}

export function assertIsAction(type: Type.TType): asserts type is Type.Action {
    if (!isType.isAction(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Action,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsAny(type: Type.TType): asserts type is Type.Any | Type.AnyUnion {
    if (!isType.isAny(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Any,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.AnyUnion],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsAnyUnion(type: Type.TType): asserts type is Type.AnyUnion {
    if (!isType.isAnyUnion(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Any,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.AnyUnion],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsAnyNonNull(type: Type.TType): asserts type is Type.AnyNonNull {
    if (!isType.isAnyNonNull(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.AnyNonNull,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsBinary(type: Type.TType): asserts type is Type.Binary {
    if (!isType.isBinary(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Binary,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDate(type: Type.TType): asserts type is Type.Date {
    if (!isType.isDate(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Date,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDateTime(type: Type.TType): asserts type is Type.DateTime {
    if (!isType.isDateTime(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.DateTime,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDateTimeZone(type: Type.TType): asserts type is Type.DateTimeZone {
    if (!isType.isDateTimeZone(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.DateTimeZone,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDefinedFunction(type: Type.TType): asserts type is Type.DefinedFunction {
    if (!isType.isDefinedFunction(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Function,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedFunction],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDefinedList(type: Type.TType): asserts type is Type.DefinedList {
    if (!isType.isDefinedList(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.List,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedList],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDefinedListType(type: Type.TType): asserts type is Type.DefinedListType {
    if (!isType.isDefinedListType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedListType],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDefinedRecord(type: Type.TType): asserts type is Type.DefinedRecord {
    if (!isType.isDefinedRecord(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Record,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedRecord],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDefinedTable(type: Type.TType): asserts type is Type.DefinedTable {
    if (!isType.isDefinedTable(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Table,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedTable],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsDuration(type: Type.TType): asserts type is Type.Duration {
    if (!isType.isDuration(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Duration,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsFunction(type: Type.TType): asserts type is Type.Function | Type.DefinedFunction {
    if (!isType.isFunction(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Function,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedFunction],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsFunctionType(type: Type.TType): asserts type is Type.FunctionType {
    if (!isType.isFunctionType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.FunctionType],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsList(type: Type.TType): asserts type is Type.List | Type.DefinedList {
    if (!isType.isList(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.List,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedList],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsLogical(type: Type.TType): asserts type is Type.Logical {
    if (!isType.isLogical(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Logical,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsNone(type: Type.TType): asserts type is Type.None {
    if (!isType.isNone(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.None,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsNotApplicable(type: Type.TType): asserts type is Type.NotApplicable {
    if (!isType.isNotApplicable(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.NotApplicable,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsNull(type: Type.TType): asserts type is Type.Null {
    if (!isType.isNull(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Null,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsNumber(type: Type.TType): asserts type is Type.Number {
    if (!isType.isNumber(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Number,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsPrimaryPrimitiveType(type: Type.TType): asserts type is Type.PrimaryPrimitiveType {
    if (!isType.isPrimaryPrimitiveType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.PrimaryPrimitiveType],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsRecord(type: Type.TType): asserts type is Type.Record | Type.DefinedRecord {
    if (!isType.isRecord(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Record,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedRecord],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsRecordType(type: Type.TType): asserts type is Type.RecordType {
    if (!isType.isRecordType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.RecordType],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsTable(type: Type.TType): asserts type is Type.Table | Type.DefinedTable {
    if (!isType.isTable(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Table,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedTable],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsTableType(type: Type.TType): asserts type is Type.TableType {
    if (!isType.isTableType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.TableType],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsTableTypePrimaryExpression(type: Type.TType): asserts type is Type.TableTypePrimaryExpression {
    if (!isType.isTableTypePrimaryExpression(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.TableTypePrimaryExpression],
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsText(type: Type.TType): asserts type is Type.Text {
    if (!isType.isText(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Text,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsTime(type: Type.TType): asserts type is Type.Time {
    if (!isType.isTime(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Time,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsType(type: Type.TType): asserts type is Type.Type {
    if (!isType.isType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

export function assertIsUnknown(type: Type.TType): asserts type is Type.Unknown {
    if (!isType.isUnknown(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Unknown,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`assert failed, expected different type`, details);
    }
}

interface AssertErrorDetails {
    givenTypeKind: Type.TypeKind;
    givenExtendedTypeKind: Type.ExtendedTypeKind | undefined;
    expectedTypeKind: Type.TypeKind;
    expectedExtendedTypeKind: undefined | (Type.ExtendedTypeKind | undefined)[];
}
