// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { Assert, CommonError, StringUtils } from "../../../common";
import { PrimitiveTypeConstantMap, primitiveTypeMapKey } from "./primitive";
import { simplify } from "./simplify";

export function createPrimitiveType<T extends Type.TypeKind>(isNullable: boolean, typeKind: T): Type.TPrimitiveType {
    const key: string = primitiveTypeMapKey(isNullable, typeKind);
    return Assert.asDefined(PrimitiveTypeConstantMap.get(key), `unknown key for PrimitiveTypeConstantMap`, {
        typeKind,
        isNullable,
    });
}

// If the given types can be simplified/deduped down to a single type then that is returned instead.
// Otherwise returns an instance of `Type.AnyUnion`.
export function createAnyUnion(unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>): Type.TPowerQueryType {
    const simplified: ReadonlyArray<Type.TPowerQueryType> = simplify(unionedTypePairs);
    if (simplified.length === 1) {
        return simplified[0];
    }

    return {
        kind: Type.TypeKind.Any,
        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: unionedTypePairs.find((ttype: Type.TPowerQueryType) => ttype.isNullable === true) !== undefined,
        unionedTypePairs: simplified,
    };
}

export function createDefinedFunction(
    isNullable: boolean,
    parameters: ReadonlyArray<Type.FunctionParameter>,
    returnType: Type.TPowerQueryType,
): Type.DefinedFunction {
    return {
        kind: Type.TypeKind.Function,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable,
        parameters,
        returnType,
    };
}

export function createDefinedList(
    isNullable: boolean,
    elements: ReadonlyArray<Type.TPowerQueryType>,
): Type.DefinedList {
    return {
        kind: Type.TypeKind.List,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        isNullable,
        elements,
    };
}

export function createDefinedListType(
    isNullable: boolean,
    itemTypes: ReadonlyArray<Type.TPowerQueryType>,
): Type.DefinedListType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedListType,
        isNullable,
        itemTypes,
    };
}

export function createDefinedRecord(
    isNullable: boolean,
    fields: Map<string, Type.TPowerQueryType>,
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

export function createDefinedTable(
    isNullable: boolean,
    fields: Type.OrderedFields,
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

export function createFunctionType(
    isNullable: boolean,
    parameters: ReadonlyArray<Type.FunctionParameter>,
    returnType: Type.TPowerQueryType,
): Type.FunctionType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.FunctionType,
        isNullable,
        parameters,
        returnType,
    };
}

export function createLogicalLiteral(isNullable: boolean, literal: string | boolean): Type.LogicalLiteral {
    let parsedLiteral: string;
    let normalizedLiteral: boolean;

    if (literal === true || literal === "true") {
        parsedLiteral = "true";
        normalizedLiteral = true;
    } else if (literal === false || literal === "false") {
        parsedLiteral = "false";
        normalizedLiteral = false;
    } else {
        throw new CommonError.InvariantError(`invalid boolean string`);
    }

    return {
        isNullable,
        kind: Type.TypeKind.Logical,
        maybeExtendedKind: Type.ExtendedTypeKind.LogicalLiteral,
        literal: parsedLiteral,
        normalizedLiteral,
    };
}

export function createListType(isNullable: boolean, itemType: Type.TPowerQueryType): Type.ListType {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.ListType,
        isNullable,
        itemType,
    };
}

export function createNumberLiteral(isNullable: boolean, literal: string | number): Type.NumberLiteral {
    let parsedLiteral: string;
    let normalizedLiteral: number;

    if (typeof literal === "number") {
        parsedLiteral = literal.toString();
        normalizedLiteral = literal;
    } else {
        parsedLiteral = literal;
        normalizedLiteral = Number.parseFloat(Assert.asDefined(StringUtils.maybeNormalizeNumber(literal)));
    }

    return {
        isNullable,
        kind: Type.TypeKind.Number,
        maybeExtendedKind: Type.ExtendedTypeKind.NumberLiteral,
        literal: parsedLiteral,
        normalizedLiteral,
    };
}

export function createPrimaryPrimitiveType(
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

export function createRecordType(
    isNullable: boolean,
    fields: Map<string, Type.TPowerQueryType>,
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

export function createTableType(
    isNullable: boolean,
    fields: Map<string, Type.TPowerQueryType>,
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

export function createTextLiteral(isNullable: boolean, literal: string): Type.TextLiteral {
    if (literal[0] !== `"` || literal[literal.length - 1] !== `"`) {
        throw new CommonError.InvariantError(`text literal must begin and end with double quote`);
    }

    return {
        isNullable,
        kind: Type.TypeKind.Text,
        maybeExtendedKind: Type.ExtendedTypeKind.TextLiteral,
        literal,
        normalizedLiteral: literal,
    };
}

export function createTableTypePrimary(
    isNullable: boolean,
    primaryExpression: Type.TPowerQueryType,
): Type.TableTypePrimaryExpression {
    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.TableTypePrimaryExpression,
        isNullable,
        primaryExpression,
    };
}
