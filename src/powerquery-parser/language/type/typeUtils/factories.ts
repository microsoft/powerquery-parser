// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, StringUtils } from "../../../common";
import { ParameterScopeItem } from "../../../inspection";
import { PrimitiveTypeConstantMap, primitiveTypeMapKey, typeKindFromPrimitiveTypeConstantKind } from "./primitive";
import { dedupe } from "./typeUtils";

export function primitiveTypeFactory<T extends Type.TypeKind>(isNullable: boolean, typeKind: T): Type.TPrimitiveType {
    const key: string = primitiveTypeMapKey(isNullable, typeKind);
    return Assert.asDefined(PrimitiveTypeConstantMap.get(key), `unknown key for PrimitiveTypeConstantMap`, {
        typeKind,
        isNullable,
    });
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

export function definedFunctionFactory(
    isNullable: boolean,
    parameters: ReadonlyArray<Type.FunctionParameter>,
    returnType: Type.TType,
): Type.DefinedFunction {
    return {
        kind: Type.TypeKind.Function,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable,
        parameters,
        returnType,
    };
}

export function definedListFactory(isNullable: boolean, elements: ReadonlyArray<Type.TType>): Type.DefinedList {
    return {
        kind: Type.TypeKind.List,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        isNullable,
        elements,
    };
}

export function definedListTypeFactory(
    isNullable: boolean,
    itemTypes: ReadonlyArray<Type.TType>,
): Type.DefinedListType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedListType,
        isNullable,
        itemTypes,
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

export function functionTypeFactory(
    isNullable: boolean,
    parameters: ReadonlyArray<Type.FunctionParameter>,
    returnType: Type.TType,
): Type.FunctionType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.FunctionType,
        isNullable,
        parameters,
        returnType,
    };
}

export function numberLiteralFactory(isNullable: boolean, literal: string): Type.NumberLiteral {
    return {
        isNullable,
        kind: Type.TypeKind.Number,
        maybeExtendedKind: Type.ExtendedTypeKind.NumberLiteral,
        literal,
        normalizedLiteral: Number.parseFloat(Assert.asDefined(StringUtils.maybeNormalizeNumber(literal))),
    };
}

export function parameterFactory(parameter: ParameterScopeItem): Type.TPrimitiveType {
    if (parameter.maybeType === undefined) {
        return Type.NoneInstance;
    }

    return {
        kind: typeKindFromPrimitiveTypeConstantKind(parameter.maybeType),
        maybeExtendedKind: undefined,
        isNullable: parameter.isNullable,
    };
}

export function listTypeFactory(isNullable: boolean, itemType: Type.TType): Type.ListType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.ListType,
        isNullable,
        itemType,
    };
}

export function primaryPrimitiveTypeFactory(
    isNullable: boolean,
    primitiveType: Type.TPrimitiveType,
): Type.PrimaryPrimitiveType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.PrimaryPrimitiveType,
        isNullable,
        primitiveType,
    };
}

export function recordTypeFactory(
    isNullable: boolean,
    fields: Map<string, Type.TType>,
    isOpen: boolean,
): Type.RecordType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
        isNullable,
        fields,
        isOpen,
    };
}

export function tableTypeFactory(
    isNullable: boolean,
    fields: Map<string, Type.TType>,
    isOpen: boolean,
): Type.TableType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.TableType,
        isNullable,
        fields,
        isOpen,
    };
}

export function textLiteralFactory(isNullable: boolean, literal: string): Type.TextLiteral {
    return {
        isNullable,
        kind: Type.TypeKind.Text,
        maybeExtendedKind: Type.ExtendedTypeKind.TextLiteral,
        literal,
    };
}

export function tableTypePrimaryExpression(
    isNullable: boolean,
    primaryExpression: Type.TType,
): Type.TableTypePrimaryExpression {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.TableTypePrimaryExpression,
        isNullable,
        primaryExpression,
    };
}
