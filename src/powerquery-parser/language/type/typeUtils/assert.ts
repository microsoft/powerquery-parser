// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as isType from "./isType";

import { Type } from "..";
import { CommonError } from "../../../common";

export function assertAsAction(type: Type.PqType): Type.Action {
    assertIsAction(type);
    return type;
}

export function assertAsAny(type: Type.PqType): Type.TAny {
    assertIsAny(type);
    return type;
}

export function assertAsAnyUnion(type: Type.PqType): Type.AnyUnion {
    assertIsAnyUnion(type);
    return type;
}

export function assertAsAnyNonNull(type: Type.PqType): Type.AnyNonNull {
    assertIsAnyNonNull(type);
    return type;
}

export function assertAsBinary(type: Type.PqType): Type.Binary {
    assertIsBinary(type);
    return type;
}

export function assertAsDate(type: Type.PqType): Type.Date {
    assertIsDate(type);
    return type;
}

export function assertAsDateTime(type: Type.PqType): Type.DateTime {
    assertIsDateTime(type);
    return type;
}

export function assertAsDateTimeZone(type: Type.PqType): Type.DateTimeZone {
    assertIsDateTimeZone(type);
    return type;
}

export function assertAsDefinedFunction(type: Type.PqType): Type.DefinedFunction {
    assertIsDefinedFunction(type);
    return type;
}

export function assertAsDefinedList(type: Type.PqType): Type.DefinedList {
    assertIsDefinedList(type);
    return type;
}

export function assertAsDefinedListType(type: Type.PqType): Type.DefinedListType {
    assertIsDefinedListType(type);
    return type;
}

export function assertAsDefinedRecord(type: Type.PqType): Type.DefinedRecord {
    assertIsDefinedRecord(type);
    return type;
}

export function assertAsDefinedTable(type: Type.PqType): Type.DefinedTable {
    assertIsDefinedTable(type);
    return type;
}

export function assertAsDuration(type: Type.PqType): Type.Duration {
    assertIsDuration(type);
    return type;
}

export function assertAsFunction(type: Type.PqType): Type.TFunction {
    assertIsFunction(type);
    return type;
}

export function assertAsFunctionType(type: Type.PqType): Type.FunctionType {
    assertIsFunctionType(type);
    return type;
}

export function assertAsList(type: Type.PqType): Type.TList {
    assertIsList(type);
    return type;
}

export function assertAsLogical(type: Type.PqType): Type.TLogical {
    assertIsLogical(type);
    return type;
}

export function assertAsLogicalLiteral(type: Type.PqType): Type.LogicalLiteral {
    assertIsLogicalLiteral(type);
    return type;
}

export function assertAsNone(type: Type.PqType): Type.None {
    assertIsNone(type);
    return type;
}

export function assertAsNotApplicable(type: Type.PqType): Type.NotApplicable {
    assertIsNotApplicable(type);
    return type;
}

export function assertAsNull(type: Type.PqType): Type.Null {
    assertIsNull(type);
    return type;
}

export function assertAsNumber(type: Type.PqType): Type.TNumber {
    assertIsNumber(type);
    return type;
}

export function assertAsNumberLiteral(type: Type.PqType): Type.NumberLiteral {
    assertIsNumberLiteral(type);
    return type;
}

export function assertAsPrimaryPrimitiveType(type: Type.PqType): Type.PrimaryPrimitiveType {
    assertIsPrimaryPrimitiveType(type);
    return type;
}

export function assertAsRecord(type: Type.PqType): Type.TRecord {
    assertIsRecord(type);
    return type;
}

export function assertAsRecordType(type: Type.PqType): Type.RecordType {
    assertIsRecordType(type);
    return type;
}

export function assertAsTable(type: Type.PqType): Type.TTable {
    assertIsTable(type);
    return type;
}

export function assertAsTableType(type: Type.PqType): Type.TableType {
    assertIsTableType(type);
    return type;
}

export function assertAsTableTypePrimaryExpression(type: Type.PqType): Type.TableTypePrimaryExpression {
    assertIsTableTypePrimaryExpression(type);
    return type;
}

export function assertAsText(type: Type.PqType): Type.TText {
    assertIsText(type);
    return type;
}

export function assertAsTextLiteral(type: Type.PqType): Type.TextLiteral {
    assertIsTextLiteral(type);
    return type;
}

export function assertAsTime(type: Type.PqType): Type.Time {
    assertIsTime(type);
    return type;
}

export function assertAsTPrimitiveType(type: Type.PqType): Type.TPrimitiveType {
    assertIsTPrimitiveType(type);
    return type;
}

export function assertAsTLiteral(type: Type.PqType): Type.TLiteral {
    assertIsLiteral(type);
    return type;
}

export function assertAsType(type: Type.PqType): Type.Type {
    assertIsType(type);
    return type;
}

export function assertAsUnknown(type: Type.PqType): Type.Unknown {
    assertIsUnknown(type);
    return type;
}

export function assertIsAction(type: Type.PqType): asserts type is Type.Action {
    if (!isType.isAction(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Action,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsAction.name} failed`, details);
    }
}

export function assertIsAny(type: Type.PqType): asserts type is Type.Any | Type.AnyUnion {
    if (!isType.isAny(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Any,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.AnyUnion],
        };
        throw new CommonError.InvariantError(`${assertIsAny.name} failed`, details);
    }
}

export function assertIsAnyUnion(type: Type.PqType): asserts type is Type.AnyUnion {
    if (!isType.isAnyUnion(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Any,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.AnyUnion],
        };
        throw new CommonError.InvariantError(`${assertIsAnyUnion.name} failed`, details);
    }
}

export function assertIsAnyNonNull(type: Type.PqType): asserts type is Type.AnyNonNull {
    if (!isType.isAnyNonNull(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.AnyNonNull,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsAnyNonNull.name} failed`, details);
    }
}

export function assertIsBinary(type: Type.PqType): asserts type is Type.Binary {
    if (!isType.isBinary(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Binary,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsBinary.name} failed`, details);
    }
}

export function assertIsDate(type: Type.PqType): asserts type is Type.Date {
    if (!isType.isDate(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Date,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsDate.name} failed`, details);
    }
}

export function assertIsDateTime(type: Type.PqType): asserts type is Type.DateTime {
    if (!isType.isDateTime(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.DateTime,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsDateTime.name} failed`, details);
    }
}

export function assertIsDateTimeZone(type: Type.PqType): asserts type is Type.DateTimeZone {
    if (!isType.isDateTimeZone(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.DateTimeZone,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsDateTimeZone.name} failed`, details);
    }
}

export function assertIsDefinedFunction(type: Type.PqType): asserts type is Type.DefinedFunction {
    if (!isType.isDefinedFunction(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Function,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedFunction],
        };
        throw new CommonError.InvariantError(`${assertIsDefinedFunction.name} failed`, details);
    }
}

export function assertIsDefinedList(type: Type.PqType): asserts type is Type.DefinedList {
    if (!isType.isDefinedList(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.List,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedList],
        };
        throw new CommonError.InvariantError(`${assertIsDefinedList.name} failed`, details);
    }
}

export function assertIsDefinedListType(type: Type.PqType): asserts type is Type.DefinedListType {
    if (!isType.isDefinedListType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedListType],
        };
        throw new CommonError.InvariantError(`${assertIsDefinedListType.name} failed`, details);
    }
}

export function assertIsDefinedRecord(type: Type.PqType): asserts type is Type.DefinedRecord {
    if (!isType.isDefinedRecord(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Record,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedRecord],
        };
        throw new CommonError.InvariantError(`${assertIsDefinedRecord.name} failed`, details);
    }
}

export function assertIsDefinedTable(type: Type.PqType): asserts type is Type.DefinedTable {
    if (!isType.isDefinedTable(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Table,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.DefinedTable],
        };
        throw new CommonError.InvariantError(`${assertIsDefinedTable.name} failed`, details);
    }
}

export function assertIsDuration(type: Type.PqType): asserts type is Type.Duration {
    if (!isType.isDuration(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Duration,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsDuration.name} failed`, details);
    }
}

export function assertIsFunction(type: Type.PqType): asserts type is Type.TFunction {
    if (!isType.isFunction(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Function,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedFunction],
        };
        throw new CommonError.InvariantError(`${assertIsFunction.name} failed`, details);
    }
}

export function assertIsFunctionType(type: Type.PqType): asserts type is Type.FunctionType {
    if (!isType.isFunctionType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.FunctionType],
        };
        throw new CommonError.InvariantError(`${assertIsFunctionType.name} failed`, details);
    }
}

export function assertIsList(type: Type.PqType): asserts type is Type.TList {
    if (!isType.isList(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.List,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedList],
        };
        throw new CommonError.InvariantError(`${assertIsList.name} failed`, details);
    }
}

export function assertIsLiteral(type: Type.PqType): asserts type is Type.TLiteral {
    if (!isType.isLiteral(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: [Type.TypeKind.Number, Type.TypeKind.Text],
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.NumberLiteral, Type.ExtendedTypeKind.TextLiteral],
        };
        throw new CommonError.InvariantError(`${assertIsLiteral.name} failed`, details);
    }
}

export function assertIsLogical(type: Type.PqType): asserts type is Type.TLogical {
    if (!isType.isLogical(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Logical,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.LogicalLiteral],
        };
        throw new CommonError.InvariantError(`${assertIsLogical.name} failed`, details);
    }
}

export function assertIsLogicalLiteral(type: Type.PqType): asserts type is Type.LogicalLiteral {
    if (!isType.isLogicalLiteral(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Logical,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.LogicalLiteral],
        };
        throw new CommonError.InvariantError(`${assertIsLogicalLiteral.name} failed`, details);
    }
}

export function assertIsNone(type: Type.PqType): asserts type is Type.None {
    if (!isType.isNone(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.None,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsNone.name} failed`, details);
    }
}

export function assertIsNotApplicable(type: Type.PqType): asserts type is Type.NotApplicable {
    if (!isType.isNotApplicable(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.NotApplicable,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsNotApplicable.name} failed`, details);
    }
}

export function assertIsNull(type: Type.PqType): asserts type is Type.Null {
    if (!isType.isNull(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Null,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsNull.name} failed`, details);
    }
}

export function assertIsNumber(type: Type.PqType): asserts type is Type.TNumber {
    if (!isType.isNumber(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Number,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.NumberLiteral],
        };
        throw new CommonError.InvariantError(`${assertIsNumber.name} failed`, details);
    }
}

export function assertIsNumberLiteral(type: Type.PqType): asserts type is Type.NumberLiteral {
    if (!isType.isNumber(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Number,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.NumberLiteral],
        };
        throw new CommonError.InvariantError(`${assertIsNumberLiteral.name} failed`, details);
    }
}

export function assertIsPrimaryPrimitiveType(type: Type.PqType): asserts type is Type.PrimaryPrimitiveType {
    if (!isType.isPrimaryPrimitiveType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.PrimaryPrimitiveType],
        };
        throw new CommonError.InvariantError(`${assertIsPrimaryPrimitiveType.name} failed`, details);
    }
}

export function assertIsTPrimitiveType(type: Type.PqType): asserts type is Type.TPrimitiveType {
    if (!isType.isTPrimitiveType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: [
                Type.TypeKind.Action,
                Type.TypeKind.Any,
                Type.TypeKind.AnyNonNull,
                Type.TypeKind.Binary,
                Type.TypeKind.Date,
                Type.TypeKind.DateTime,
                Type.TypeKind.DateTimeZone,
                Type.TypeKind.Duration,
                Type.TypeKind.Function,
                Type.TypeKind.List,
                Type.TypeKind.Logical,
                Type.TypeKind.None,
                Type.TypeKind.NotApplicable,
                Type.TypeKind.Null,
                Type.TypeKind.Number,
                Type.TypeKind.Record,
                Type.TypeKind.Table,
                Type.TypeKind.Text,
                Type.TypeKind.Time,
                Type.TypeKind.Type,
                Type.TypeKind.Unknown,
            ],
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsTPrimitiveType.name}`, details);
    }
}

export function assertIsRecord(type: Type.PqType): asserts type is Type.TRecord {
    if (!isType.isRecord(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Record,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedRecord],
        };
        throw new CommonError.InvariantError(`${assertIsRecord.name} failed`, details);
    }
}

export function assertIsRecordType(type: Type.PqType): asserts type is Type.RecordType {
    if (!isType.isRecordType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.RecordType],
        };
        throw new CommonError.InvariantError(`${assertIsRecordType.name} failed`, details);
    }
}

export function assertIsTable(type: Type.PqType): asserts type is Type.TTable {
    if (!isType.isTable(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Table,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.DefinedTable],
        };
        throw new CommonError.InvariantError(`${assertIsTable.name} failed`, details);
    }
}

export function assertIsTableType(type: Type.PqType): asserts type is Type.TableType {
    if (!isType.isTableType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.TableType],
        };
        throw new CommonError.InvariantError(`${assertIsTableType.name} failed`, details);
    }
}

export function assertIsTableTypePrimaryExpression(type: Type.PqType): asserts type is Type.TableTypePrimaryExpression {
    if (!isType.isTableTypePrimaryExpression(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.TableTypePrimaryExpression],
        };
        throw new CommonError.InvariantError(`${assertIsTableTypePrimaryExpression.name} failed`, details);
    }
}

export function assertIsText(type: Type.PqType): asserts type is Type.TText {
    if (!isType.isText(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Text,
            expectedExtendedTypeKind: [undefined, Type.ExtendedTypeKind.TextLiteral],
        };
        throw new CommonError.InvariantError(`${assertIsText.name} failed`, details);
    }
}

export function assertIsTextLiteral(type: Type.PqType): asserts type is Type.TextLiteral {
    if (!isType.isText(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Text,
            expectedExtendedTypeKind: [Type.ExtendedTypeKind.TextLiteral],
        };
        throw new CommonError.InvariantError(`${assertIsTextLiteral.name} failed`, details);
    }
}

export function assertIsTime(type: Type.PqType): asserts type is Type.Time {
    if (!isType.isTime(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Time,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsTime.name} failed`, details);
    }
}

export function assertIsType(type: Type.PqType): asserts type is Type.Type {
    if (!isType.isType(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Type,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsType.name} failed`, details);
    }
}

export function assertIsUnknown(type: Type.PqType): asserts type is Type.Unknown {
    if (!isType.isUnknown(type)) {
        const details: AssertErrorDetails = {
            givenTypeKind: type.kind,
            givenExtendedTypeKind: type.maybeExtendedKind,
            expectedTypeKind: Type.TypeKind.Unknown,
            expectedExtendedTypeKind: undefined,
        };
        throw new CommonError.InvariantError(`${assertIsUnknown.name} failed`, details);
    }
}

interface AssertErrorDetails {
    givenTypeKind: Type.TypeKind;
    givenExtendedTypeKind: Type.ExtendedTypeKind | undefined;
    expectedTypeKind: Type.TypeKind | ReadonlyArray<Type.TypeKind>;
    expectedExtendedTypeKind: undefined | ReadonlyArray<Type.ExtendedTypeKind | undefined>;
}
