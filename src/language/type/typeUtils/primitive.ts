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
