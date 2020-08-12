// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert } from "../../../common";
import { ParameterScopeItem } from "../../../inspection";
import { PrimitiveTypeConstantMap, primitiveTypeMapKey, typeKindFromPrimitiveTypeConstantKind } from "./primitive";
import { dedupe } from "./typeUtils";

export function primitiveTypeFactory<T extends Type.TypeKind>(typeKind: T, isNullable: boolean): Type.IPrimitiveType {
    const key: string = primitiveTypeMapKey(typeKind, isNullable);
    const maybeValue: Type.IPrimitiveType | undefined = PrimitiveTypeConstantMap.get(key);
    Assert.isDefined(maybeValue, `unknown [typeKind, isNullable] key`, { typeKind, isNullable });

    return maybeValue;
}

export function anyUnionFactory(unionedTypePairs: ReadonlyArray<Type.TType>): Type.TType {
    const simplified: ReadonlyArray<Type.TType> = dedupe(unionedTypePairs);
    if (simplified.length === 1) {
        return simplified[0];
    }

    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: unionedTypePairs.find((ttype: Type.TType) => ttype.isNullable === true) !== undefined,
        unionedTypePairs: simplified,
    };
}

export function definedRecordFactory(
    isNullable: boolean,
    fields: Map<string, Type.TType>,
    isOpen: boolean,
): Type.DefinedRecord {
    return {
        kind: Type.TypeKind.Record,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
        isNullable,
        fields,
        isOpen,
    };
}

export function definedTableFactory(
    isNullable: boolean,
    fields: Map<string, Type.TType>,
    isOpen: boolean,
): Type.DefinedTable {
    return {
        kind: Type.TypeKind.Table,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedTable,
        isNullable,
        fields,
        isOpen,
    };
}

export function parameterFactory(parameter: ParameterScopeItem): Type.TType {
    if (parameter.maybeType === undefined) {
        return Type.NoneInstance;
    }

    return {
        kind: typeKindFromPrimitiveTypeConstantKind(parameter.maybeType),
        maybeExtendedKind: undefined,
        isNullable: parameter.isNullable,
    };
}
