// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, CommonError, StringUtils } from "../../../common";
import { PrimitiveTypeConstantMap, primitiveTypeMapKey } from "./primitive";
import { simplify } from "./simplify";

export function primitiveTypeFactory<T extends Type.TypeKind>(isNullable: boolean, typeKind: T): Type.TPrimitiveType {
    const key: string = primitiveTypeMapKey(isNullable, typeKind);
    return Assert.asDefined(PrimitiveTypeConstantMap.get(key), `unknown key for PrimitiveTypeConstantMap`, {
        typeKind,
        isNullable,
    });
}

// If the given types can be simplified/deduped down to a single type then that is returned instead.
// Otherwise returns an instance of `Type.AnyUnion`.
export function anyUnionFactory(unionedTypePairs: ReadonlyArray<Type.PqType>): Type.PqType {
    const simplified: ReadonlyArray<Type.PqType> = simplify(unionedTypePairs);
    if (simplified.length === 1) {
        return simplified[0];
    }

    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: unionedTypePairs.find((ttype: Type.PqType) => ttype.isNullable === true) !== undefined,
        unionedTypePairs: simplified,
    };
}

export function definedFunctionFactory(
    isNullable: boolean,
    parameters: ReadonlyArray<Type.FunctionParameter>,
    returnType: Type.PqType,
): Type.DefinedFunction {
    return {
        kind: Type.TypeKind.Function,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable,
        parameters,
        returnType,
    };
}

export function definedListFactory(isNullable: boolean, elements: ReadonlyArray<Type.PqType>): Type.DefinedList {
    return {
        kind: Type.TypeKind.List,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        isNullable,
        elements,
    };
}

export function definedListTypeFactory(
    isNullable: boolean,
    itemTypes: ReadonlyArray<Type.PqType>,
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
    fields: Map<string, Type.PqType>,
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
    fields: Map<string, Type.PqType>,
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
    returnType: Type.PqType,
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

export function listTypeFactory(isNullable: boolean, itemType: Type.PqType): Type.ListType {
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
    fields: Map<string, Type.PqType>,
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
    fields: Map<string, Type.PqType>,
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
    if (literal[0] !== `"` || literal[literal.length - 1] !== `"`) {
        throw new CommonError.InvariantError(`text literal must begin and end with double quote`);
    }

    return {
        isNullable,
        kind: Type.TypeKind.Text,
        maybeExtendedKind: Type.ExtendedTypeKind.TextLiteral,
        literal,
    };
}

export function tableTypePrimaryExpression(
    isNullable: boolean,
    primaryExpression: Type.PqType,
): Type.TableTypePrimaryExpression {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.TableTypePrimaryExpression,
        isNullable,
        primaryExpression,
    };
}
