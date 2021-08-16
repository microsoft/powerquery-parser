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

export const PrimitiveTypeConstantMap: ReadonlyMap<string, Type.TPrimitiveType> = new Map(
    [
        Type.ActionInstance,
        Type.AnyInstance,
        Type.AnyNonNullInstance,
        Type.BinaryInstance,
        Type.DateInstance,
        Type.DateTimeInstance,
        Type.DateTimeZoneInstance,
        Type.DurationInstance,
        Type.FunctionInstance,
        Type.ListInstance,
        Type.LogicalInstance,
        Type.NoneInstance,
        Type.NotApplicableInstance,
        Type.NullInstance,
        Type.NumberInstance,
        Type.RecordInstance,
        Type.TableInstance,
        Type.TimeInstance,
        Type.TextInstance,
        Type.TypePrimitiveInstance,
        Type.UnknownInstance,
        Type.NullableActionInstance,
        Type.NullableAnyInstance,
        Type.NullableBinaryInstance,
        Type.NullableDateInstance,
        Type.NullableDateTimeInstance,
        Type.NullableDateTimeZoneInstance,
        Type.NullableDurationInstance,
        Type.NullableFunctionInstance,
        Type.NullableListInstance,
        Type.NullableLogicalInstance,
        Type.NullableNoneInstance,
        Type.NullableNotApplicableInstance,
        Type.NullableNumberInstance,
        Type.NullableRecordInstance,
        Type.NullableTableInstance,
        Type.NullableTextInstance,
        Type.NullableTimeInstance,
        Type.NullableTypeInstance,
        Type.NullableUnknownInstance,
    ].map((type: Type.TPrimitiveType) => [primitiveTypeMapKey(type.isNullable, type.kind), type]),
);

export function primitiveTypeMapKey(isNullable: boolean, typeKind: Type.TypeKind): string {
    return `${typeKind},${isNullable}`;
}
