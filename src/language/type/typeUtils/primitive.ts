// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert } from "../../../common";
import { Ast } from "../../ast";

export function maybePrimitiveTypeConstantKindFromTypeKind(
    typeKind: Type.TypeKind,
): Ast.PrimitiveTypeConstantKind | undefined {
    switch (typeKind) {
        case Type.TypeKind.Action:
            return Ast.PrimitiveTypeConstantKind.Action;

        case Type.TypeKind.Any:
            return Ast.PrimitiveTypeConstantKind.Any;

        case Type.TypeKind.AnyNonNull:
            return Ast.PrimitiveTypeConstantKind.AnyNonNull;

        case Type.TypeKind.Binary:
            return Ast.PrimitiveTypeConstantKind.Binary;

        case Type.TypeKind.Date:
            return Ast.PrimitiveTypeConstantKind.Date;

        case Type.TypeKind.DateTime:
            return Ast.PrimitiveTypeConstantKind.DateTime;

        case Type.TypeKind.DateTimeZone:
            return Ast.PrimitiveTypeConstantKind.DateTimeZone;

        case Type.TypeKind.Duration:
            return Ast.PrimitiveTypeConstantKind.Duration;

        case Type.TypeKind.Function:
            return Ast.PrimitiveTypeConstantKind.Function;

        case Type.TypeKind.List:
            return Ast.PrimitiveTypeConstantKind.List;

        case Type.TypeKind.Logical:
            return Ast.PrimitiveTypeConstantKind.Logical;

        case Type.TypeKind.None:
            return Ast.PrimitiveTypeConstantKind.None;

        case Type.TypeKind.Null:
            return Ast.PrimitiveTypeConstantKind.Null;

        case Type.TypeKind.Number:
            return Ast.PrimitiveTypeConstantKind.Number;

        case Type.TypeKind.Record:
            return Ast.PrimitiveTypeConstantKind.Record;

        case Type.TypeKind.Table:
            return Ast.PrimitiveTypeConstantKind.Table;

        case Type.TypeKind.Text:
            return Ast.PrimitiveTypeConstantKind.Text;

        case Type.TypeKind.Time:
            return Ast.PrimitiveTypeConstantKind.Time;

        case Type.TypeKind.Type:
            return Ast.PrimitiveTypeConstantKind.Type;

        case Type.TypeKind.NotApplicable:
        case Type.TypeKind.Unknown:
            return undefined;

        default:
            throw Assert.isNever(typeKind);
    }
}

export function typeKindFromPrimitiveTypeConstantKind(
    primitiveTypeConstantKind: Ast.PrimitiveTypeConstantKind,
): Type.TypeKind {
    switch (primitiveTypeConstantKind) {
        case Ast.PrimitiveTypeConstantKind.Action:
            return Type.TypeKind.Action;

        case Ast.PrimitiveTypeConstantKind.Any:
            return Type.TypeKind.Any;

        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
            return Type.TypeKind.AnyNonNull;

        case Ast.PrimitiveTypeConstantKind.Binary:
            return Type.TypeKind.Binary;

        case Ast.PrimitiveTypeConstantKind.Date:
            return Type.TypeKind.Date;

        case Ast.PrimitiveTypeConstantKind.DateTime:
            return Type.TypeKind.DateTime;

        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
            return Type.TypeKind.DateTimeZone;

        case Ast.PrimitiveTypeConstantKind.Duration:
            return Type.TypeKind.Duration;

        case Ast.PrimitiveTypeConstantKind.Function:
            return Type.TypeKind.Function;

        case Ast.PrimitiveTypeConstantKind.List:
            return Type.TypeKind.List;

        case Ast.PrimitiveTypeConstantKind.Logical:
            return Type.TypeKind.Logical;

        case Ast.PrimitiveTypeConstantKind.None:
            return Type.TypeKind.None;

        case Ast.PrimitiveTypeConstantKind.Null:
            return Type.TypeKind.Null;

        case Ast.PrimitiveTypeConstantKind.Number:
            return Type.TypeKind.Number;

        case Ast.PrimitiveTypeConstantKind.Record:
            return Type.TypeKind.Record;

        case Ast.PrimitiveTypeConstantKind.Table:
            return Type.TypeKind.Table;

        case Ast.PrimitiveTypeConstantKind.Text:
            return Type.TypeKind.Text;

        case Ast.PrimitiveTypeConstantKind.Time:
            return Type.TypeKind.Time;

        case Ast.PrimitiveTypeConstantKind.Type:
            return Type.TypeKind.Type;

        default:
            throw Assert.isNever(primitiveTypeConstantKind);
    }
}

export const PrimitiveTypeConstantMap: ReadonlyMap<string, Type.IPrimitiveType> = new Map<string, Type.IPrimitiveType>([
    [primitiveTypeMapKey(Type.AnyInstance.kind, Type.AnyInstance.isNullable), Type.AnyInstance],
    [primitiveTypeMapKey(Type.AnyNonNullInstance.kind, Type.AnyNonNullInstance.isNullable), Type.AnyNonNullInstance],
    [primitiveTypeMapKey(Type.BinaryInstance.kind, Type.BinaryInstance.isNullable), Type.BinaryInstance],
    [primitiveTypeMapKey(Type.DateInstance.kind, Type.DateInstance.isNullable), Type.DateInstance],
    [primitiveTypeMapKey(Type.DateTimeInstance.kind, Type.DateTimeInstance.isNullable), Type.DateTimeInstance],
    [
        primitiveTypeMapKey(Type.DateTimeZoneInstance.kind, Type.DateTimeZoneInstance.isNullable),
        Type.DateTimeZoneInstance,
    ],
    [primitiveTypeMapKey(Type.DurationInstance.kind, Type.DurationInstance.isNullable), Type.DurationInstance],
    [primitiveTypeMapKey(Type.FunctionInstance.kind, Type.FunctionInstance.isNullable), Type.FunctionInstance],
    [primitiveTypeMapKey(Type.ListInstance.kind, Type.ListInstance.isNullable), Type.ListInstance],
    [primitiveTypeMapKey(Type.LogicalInstance.kind, Type.LogicalInstance.isNullable), Type.LogicalInstance],
    [primitiveTypeMapKey(Type.NoneInstance.kind, Type.NoneInstance.isNullable), Type.NoneInstance],
    [primitiveTypeMapKey(Type.NullInstance.kind, Type.NullInstance.isNullable), Type.NullInstance],
    [primitiveTypeMapKey(Type.NumberInstance.kind, Type.NumberInstance.isNullable), Type.NumberInstance],
    [primitiveTypeMapKey(Type.RecordInstance.kind, Type.RecordInstance.isNullable), Type.RecordInstance],
    [primitiveTypeMapKey(Type.TableInstance.kind, Type.TableInstance.isNullable), Type.TableInstance],
    [primitiveTypeMapKey(Type.TextInstance.kind, Type.TextInstance.isNullable), Type.TextInstance],
    [
        primitiveTypeMapKey(Type.TypePrimitiveInstance.kind, Type.TypePrimitiveInstance.isNullable),
        Type.TypePrimitiveInstance,
    ],
    [primitiveTypeMapKey(Type.ActionInstance.kind, Type.ActionInstance.isNullable), Type.ActionInstance],
    [primitiveTypeMapKey(Type.TimeInstance.kind, Type.TimeInstance.isNullable), Type.TimeInstance],
    [
        primitiveTypeMapKey(Type.NotApplicableInstance.kind, Type.NotApplicableInstance.isNullable),
        Type.NotApplicableInstance,
    ],
    [primitiveTypeMapKey(Type.UnknownInstance.kind, Type.UnknownInstance.isNullable), Type.UnknownInstance],
    [primitiveTypeMapKey(Type.NullableAnyInstance.kind, Type.NullableAnyInstance.isNullable), Type.NullableAnyInstance],
    [
        primitiveTypeMapKey(Type.NullableBinaryInstance.kind, Type.NullableBinaryInstance.isNullable),
        Type.NullableBinaryInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDateInstance.kind, Type.NullableDateInstance.isNullable),
        Type.NullableDateInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDateTimeInstance.kind, Type.NullableDateTimeInstance.isNullable),
        Type.NullableDateTimeInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDateTimeZoneInstance.kind, Type.NullableDateTimeZoneInstance.isNullable),
        Type.NullableDateTimeZoneInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDurationInstance.kind, Type.NullableDurationInstance.isNullable),
        Type.NullableDurationInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableFunctionInstance.kind, Type.NullableFunctionInstance.isNullable),
        Type.NullableFunctionInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableListInstance.kind, Type.NullableListInstance.isNullable),
        Type.NullableListInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableLogicalInstance.kind, Type.NullableLogicalInstance.isNullable),
        Type.NullableLogicalInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNoneInstance.kind, Type.NullableNoneInstance.isNullable),
        Type.NullableNoneInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNullInstance.kind, Type.NullableNullInstance.isNullable),
        Type.NullableNullInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNumberInstance.kind, Type.NullableNumberInstance.isNullable),
        Type.NullableNumberInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableRecordInstance.kind, Type.NullableRecordInstance.isNullable),
        Type.NullableRecordInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTableInstance.kind, Type.NullableTableInstance.isNullable),
        Type.NullableTableInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTextInstance.kind, Type.NullableTextInstance.isNullable),
        Type.NullableTextInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTypeInstance.kind, Type.NullableTypeInstance.isNullable),
        Type.NullableTypeInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableActionInstance.kind, Type.NullableActionInstance.isNullable),
        Type.NullableActionInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTimeInstance.kind, Type.NullableTimeInstance.isNullable),
        Type.NullableTimeInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNotApplicableInstance.kind, Type.NullableNotApplicableInstance.isNullable),
        Type.NullableNotApplicableInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableUnknownInstance.kind, Type.NullableUnknownInstance.isNullable),
        Type.NullableUnknownInstance,
    ],
]);

export function primitiveTypeMapKey(typeKind: Type.TypeKind, isNullable: boolean): string {
    return `${typeKind},${isNullable}`;
}
