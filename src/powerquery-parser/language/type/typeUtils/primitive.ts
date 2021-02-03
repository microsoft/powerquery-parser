// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert } from "../../../common";
import { Constant } from "../../constant";

export function maybePrimitiveTypeConstantKindFromTypeKind(
    typeKind: Type.TypeKind,
): Constant.PrimitiveTypeConstantKind | undefined {
    switch (typeKind) {
        case Type.TypeKind.Action:
            return Constant.PrimitiveTypeConstantKind.Action;

        case Type.TypeKind.Any:
            return Constant.PrimitiveTypeConstantKind.Any;

        case Type.TypeKind.AnyNonNull:
            return Constant.PrimitiveTypeConstantKind.AnyNonNull;

        case Type.TypeKind.Binary:
            return Constant.PrimitiveTypeConstantKind.Binary;

        case Type.TypeKind.Date:
            return Constant.PrimitiveTypeConstantKind.Date;

        case Type.TypeKind.DateTime:
            return Constant.PrimitiveTypeConstantKind.DateTime;

        case Type.TypeKind.DateTimeZone:
            return Constant.PrimitiveTypeConstantKind.DateTimeZone;

        case Type.TypeKind.Duration:
            return Constant.PrimitiveTypeConstantKind.Duration;

        case Type.TypeKind.Function:
            return Constant.PrimitiveTypeConstantKind.Function;

        case Type.TypeKind.List:
            return Constant.PrimitiveTypeConstantKind.List;

        case Type.TypeKind.Logical:
            return Constant.PrimitiveTypeConstantKind.Logical;

        case Type.TypeKind.None:
            return Constant.PrimitiveTypeConstantKind.None;

        case Type.TypeKind.Null:
            return Constant.PrimitiveTypeConstantKind.Null;

        case Type.TypeKind.Number:
            return Constant.PrimitiveTypeConstantKind.Number;

        case Type.TypeKind.Record:
            return Constant.PrimitiveTypeConstantKind.Record;

        case Type.TypeKind.Table:
            return Constant.PrimitiveTypeConstantKind.Table;

        case Type.TypeKind.Text:
            return Constant.PrimitiveTypeConstantKind.Text;

        case Type.TypeKind.Time:
            return Constant.PrimitiveTypeConstantKind.Time;

        case Type.TypeKind.Type:
            return Constant.PrimitiveTypeConstantKind.Type;

        case Type.TypeKind.NotApplicable:
        case Type.TypeKind.Unknown:
            return undefined;

        default:
            throw Assert.isNever(typeKind);
    }
}

export function typeKindFromPrimitiveTypeConstantKind(
    primitiveTypeConstantKind: Constant.PrimitiveTypeConstantKind,
): Type.TypeKind {
    switch (primitiveTypeConstantKind) {
        case Constant.PrimitiveTypeConstantKind.Action:
            return Type.TypeKind.Action;

        case Constant.PrimitiveTypeConstantKind.Any:
            return Type.TypeKind.Any;

        case Constant.PrimitiveTypeConstantKind.AnyNonNull:
            return Type.TypeKind.AnyNonNull;

        case Constant.PrimitiveTypeConstantKind.Binary:
            return Type.TypeKind.Binary;

        case Constant.PrimitiveTypeConstantKind.Date:
            return Type.TypeKind.Date;

        case Constant.PrimitiveTypeConstantKind.DateTime:
            return Type.TypeKind.DateTime;

        case Constant.PrimitiveTypeConstantKind.DateTimeZone:
            return Type.TypeKind.DateTimeZone;

        case Constant.PrimitiveTypeConstantKind.Duration:
            return Type.TypeKind.Duration;

        case Constant.PrimitiveTypeConstantKind.Function:
            return Type.TypeKind.Function;

        case Constant.PrimitiveTypeConstantKind.List:
            return Type.TypeKind.List;

        case Constant.PrimitiveTypeConstantKind.Logical:
            return Type.TypeKind.Logical;

        case Constant.PrimitiveTypeConstantKind.None:
            return Type.TypeKind.None;

        case Constant.PrimitiveTypeConstantKind.Null:
            return Type.TypeKind.Null;

        case Constant.PrimitiveTypeConstantKind.Number:
            return Type.TypeKind.Number;

        case Constant.PrimitiveTypeConstantKind.Record:
            return Type.TypeKind.Record;

        case Constant.PrimitiveTypeConstantKind.Table:
            return Type.TypeKind.Table;

        case Constant.PrimitiveTypeConstantKind.Text:
            return Type.TypeKind.Text;

        case Constant.PrimitiveTypeConstantKind.Time:
            return Type.TypeKind.Time;

        case Constant.PrimitiveTypeConstantKind.Type:
            return Type.TypeKind.Type;

        default:
            throw Assert.isNever(primitiveTypeConstantKind);
    }
}

export const PrimitiveTypeConstantMap: ReadonlyMap<string, Type.TPrimitiveType> = new Map<string, Type.TPrimitiveType>([
    [primitiveTypeMapKey(Type.AnyInstance.isNullable, Type.AnyInstance.kind), Type.AnyInstance],
    [primitiveTypeMapKey(Type.AnyNonNullInstance.isNullable, Type.AnyNonNullInstance.kind), Type.AnyNonNullInstance],
    [primitiveTypeMapKey(Type.BinaryInstance.isNullable, Type.BinaryInstance.kind), Type.BinaryInstance],
    [primitiveTypeMapKey(Type.DateInstance.isNullable, Type.DateInstance.kind), Type.DateInstance],
    [primitiveTypeMapKey(Type.DateTimeInstance.isNullable, Type.DateTimeInstance.kind), Type.DateTimeInstance],
    [
        primitiveTypeMapKey(Type.DateTimeZoneInstance.isNullable, Type.DateTimeZoneInstance.kind),
        Type.DateTimeZoneInstance,
    ],
    [primitiveTypeMapKey(Type.DurationInstance.isNullable, Type.DurationInstance.kind), Type.DurationInstance],
    [primitiveTypeMapKey(Type.FunctionInstance.isNullable, Type.FunctionInstance.kind), Type.FunctionInstance],
    [primitiveTypeMapKey(Type.ListInstance.isNullable, Type.ListInstance.kind), Type.ListInstance],
    [primitiveTypeMapKey(Type.LogicalInstance.isNullable, Type.LogicalInstance.kind), Type.LogicalInstance],
    [primitiveTypeMapKey(Type.NoneInstance.isNullable, Type.NoneInstance.kind), Type.NoneInstance],
    [primitiveTypeMapKey(Type.NullInstance.isNullable, Type.NullInstance.kind), Type.NullInstance],
    [primitiveTypeMapKey(Type.NumberInstance.isNullable, Type.NumberInstance.kind), Type.NumberInstance],
    [primitiveTypeMapKey(Type.RecordInstance.isNullable, Type.RecordInstance.kind), Type.RecordInstance],
    [primitiveTypeMapKey(Type.TableInstance.isNullable, Type.TableInstance.kind), Type.TableInstance],
    [primitiveTypeMapKey(Type.TextInstance.isNullable, Type.TextInstance.kind), Type.TextInstance],
    [
        primitiveTypeMapKey(Type.TypePrimitiveInstance.isNullable, Type.TypePrimitiveInstance.kind),
        Type.TypePrimitiveInstance,
    ],
    [primitiveTypeMapKey(Type.ActionInstance.isNullable, Type.ActionInstance.kind), Type.ActionInstance],
    [primitiveTypeMapKey(Type.TimeInstance.isNullable, Type.TimeInstance.kind), Type.TimeInstance],
    [
        primitiveTypeMapKey(Type.NotApplicableInstance.isNullable, Type.NotApplicableInstance.kind),
        Type.NotApplicableInstance,
    ],
    [primitiveTypeMapKey(Type.UnknownInstance.isNullable, Type.UnknownInstance.kind), Type.UnknownInstance],
    [primitiveTypeMapKey(Type.NullableAnyInstance.isNullable, Type.NullableAnyInstance.kind), Type.NullableAnyInstance],
    [
        primitiveTypeMapKey(Type.NullableBinaryInstance.isNullable, Type.NullableBinaryInstance.kind),
        Type.NullableBinaryInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDateInstance.isNullable, Type.NullableDateInstance.kind),
        Type.NullableDateInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDateTimeInstance.isNullable, Type.NullableDateTimeInstance.kind),
        Type.NullableDateTimeInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDateTimeZoneInstance.isNullable, Type.NullableDateTimeZoneInstance.kind),
        Type.NullableDateTimeZoneInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableDurationInstance.isNullable, Type.NullableDurationInstance.kind),
        Type.NullableDurationInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableFunctionInstance.isNullable, Type.NullableFunctionInstance.kind),
        Type.NullableFunctionInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableListInstance.isNullable, Type.NullableListInstance.kind),
        Type.NullableListInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableLogicalInstance.isNullable, Type.NullableLogicalInstance.kind),
        Type.NullableLogicalInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNoneInstance.isNullable, Type.NullableNoneInstance.kind),
        Type.NullableNoneInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNullInstance.isNullable, Type.NullableNullInstance.kind),
        Type.NullableNullInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNumberInstance.isNullable, Type.NullableNumberInstance.kind),
        Type.NullableNumberInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableRecordInstance.isNullable, Type.NullableRecordInstance.kind),
        Type.NullableRecordInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTableInstance.isNullable, Type.NullableTableInstance.kind),
        Type.NullableTableInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTextInstance.isNullable, Type.NullableTextInstance.kind),
        Type.NullableTextInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTypeInstance.isNullable, Type.NullableTypeInstance.kind),
        Type.NullableTypeInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableActionInstance.isNullable, Type.NullableActionInstance.kind),
        Type.NullableActionInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableTimeInstance.isNullable, Type.NullableTimeInstance.kind),
        Type.NullableTimeInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableNotApplicableInstance.isNullable, Type.NullableNotApplicableInstance.kind),
        Type.NullableNotApplicableInstance,
    ],
    [
        primitiveTypeMapKey(Type.NullableUnknownInstance.isNullable, Type.NullableUnknownInstance.kind),
        Type.NullableUnknownInstance,
    ],
]);

export function primitiveTypeMapKey(isNullable: boolean, typeKind: Type.TypeKind): string {
    return `${typeKind},${isNullable}`;
}
