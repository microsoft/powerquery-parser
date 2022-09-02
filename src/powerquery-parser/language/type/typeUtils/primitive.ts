// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../../common";
import { Constant } from "../../constant";
import { Type } from "..";

export function primitiveTypeConstantKindFromTypeKind(
    typeKind: Type.TypeKind,
): Constant.PrimitiveTypeConstant | undefined {
    switch (typeKind) {
        case Type.TypeKind.Action:
            return Constant.PrimitiveTypeConstant.Action;

        case Type.TypeKind.Any:
            return Constant.PrimitiveTypeConstant.Any;

        case Type.TypeKind.AnyNonNull:
            return Constant.PrimitiveTypeConstant.AnyNonNull;

        case Type.TypeKind.Binary:
            return Constant.PrimitiveTypeConstant.Binary;

        case Type.TypeKind.Date:
            return Constant.PrimitiveTypeConstant.Date;

        case Type.TypeKind.DateTime:
            return Constant.PrimitiveTypeConstant.DateTime;

        case Type.TypeKind.DateTimeZone:
            return Constant.PrimitiveTypeConstant.DateTimeZone;

        case Type.TypeKind.Duration:
            return Constant.PrimitiveTypeConstant.Duration;

        case Type.TypeKind.Function:
            return Constant.PrimitiveTypeConstant.Function;

        case Type.TypeKind.List:
            return Constant.PrimitiveTypeConstant.List;

        case Type.TypeKind.Logical:
            return Constant.PrimitiveTypeConstant.Logical;

        case Type.TypeKind.None:
            return Constant.PrimitiveTypeConstant.None;

        case Type.TypeKind.Null:
            return Constant.PrimitiveTypeConstant.Null;

        case Type.TypeKind.Number:
            return Constant.PrimitiveTypeConstant.Number;

        case Type.TypeKind.Record:
            return Constant.PrimitiveTypeConstant.Record;

        case Type.TypeKind.Table:
            return Constant.PrimitiveTypeConstant.Table;

        case Type.TypeKind.Text:
            return Constant.PrimitiveTypeConstant.Text;

        case Type.TypeKind.Time:
            return Constant.PrimitiveTypeConstant.Time;

        case Type.TypeKind.Type:
            return Constant.PrimitiveTypeConstant.Type;

        case Type.TypeKind.NotApplicable:
        case Type.TypeKind.Unknown:
            return undefined;

        default:
            throw Assert.isNever(typeKind);
    }
}

export function typeKindFromPrimitiveTypeConstantKind(
    primitiveTypeConstantKind: Constant.PrimitiveTypeConstant,
): Type.TypeKind {
    switch (primitiveTypeConstantKind) {
        case Constant.PrimitiveTypeConstant.Action:
            return Type.TypeKind.Action;

        case Constant.PrimitiveTypeConstant.Any:
            return Type.TypeKind.Any;

        case Constant.PrimitiveTypeConstant.AnyNonNull:
            return Type.TypeKind.AnyNonNull;

        case Constant.PrimitiveTypeConstant.Binary:
            return Type.TypeKind.Binary;

        case Constant.PrimitiveTypeConstant.Date:
            return Type.TypeKind.Date;

        case Constant.PrimitiveTypeConstant.DateTime:
            return Type.TypeKind.DateTime;

        case Constant.PrimitiveTypeConstant.DateTimeZone:
            return Type.TypeKind.DateTimeZone;

        case Constant.PrimitiveTypeConstant.Duration:
            return Type.TypeKind.Duration;

        case Constant.PrimitiveTypeConstant.Function:
            return Type.TypeKind.Function;

        case Constant.PrimitiveTypeConstant.List:
            return Type.TypeKind.List;

        case Constant.PrimitiveTypeConstant.Logical:
            return Type.TypeKind.Logical;

        case Constant.PrimitiveTypeConstant.None:
            return Type.TypeKind.None;

        case Constant.PrimitiveTypeConstant.Null:
            return Type.TypeKind.Null;

        case Constant.PrimitiveTypeConstant.Number:
            return Type.TypeKind.Number;

        case Constant.PrimitiveTypeConstant.Record:
            return Type.TypeKind.Record;

        case Constant.PrimitiveTypeConstant.Table:
            return Type.TypeKind.Table;

        case Constant.PrimitiveTypeConstant.Text:
            return Type.TypeKind.Text;

        case Constant.PrimitiveTypeConstant.Time:
            return Type.TypeKind.Time;

        case Constant.PrimitiveTypeConstant.Type:
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
