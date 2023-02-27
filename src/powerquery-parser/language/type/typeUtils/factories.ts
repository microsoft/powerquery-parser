// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, StringUtils } from "../../../common";
import { PrimitiveTypeConstantMap, primitiveTypeMapKey } from "./primitive";
import { Trace, TraceManager } from "../../../common/trace";
import { simplify } from "./simplify";
import { Type } from "..";
import { TypeUtilsTraceConstant } from "./typeTraceConstant";

export function primitiveType<T extends Type.TypeKind>(isNullable: boolean, typeKind: T): Type.TPrimitiveType {
    const key: string = primitiveTypeMapKey(isNullable, typeKind);

    return Assert.asDefined(PrimitiveTypeConstantMap.get(key), `unknown key for PrimitiveTypeConstantMap`, {
        typeKind,
        isNullable,
    });
}

// If the given types can be simplified/deduped down to a single type then that is returned instead.
// Otherwise returns an instance of `Type.AnyUnion`.
export function anyUnion(
    unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>,
    traceManager: TraceManager,
    correlationId: number | undefined,
): Type.TPowerQueryType {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.AnyUnion, anyUnion.name, correlationId);

    const simplified: ReadonlyArray<Type.TPowerQueryType> = simplify(unionedTypePairs, traceManager, trace.id);

    if (simplified.length === 1) {
        trace.exit();

        return simplified[0];
    }

    const result: Type.AnyUnion = {
        kind: Type.TypeKind.Any,
        extendedKind: Type.ExtendedTypeKind.AnyUnion,
        isNullable: unionedTypePairs.find((ttype: Type.TPowerQueryType) => ttype.isNullable === true) !== undefined,
        unionedTypePairs: simplified,
    };

    trace.exit();

    return result;
}

export function definedFunction(
    isNullable: boolean,
    parameters: ReadonlyArray<Type.FunctionParameter>,
    returnType: Type.TPowerQueryType,
): Type.DefinedFunction {
    return {
        kind: Type.TypeKind.Function,
        extendedKind: Type.ExtendedTypeKind.DefinedFunction,
        isNullable,
        parameters,
        returnType,
    };
}

export function definedList(isNullable: boolean, elements: ReadonlyArray<Type.TPowerQueryType>): Type.DefinedList {
    return {
        kind: Type.TypeKind.List,
        extendedKind: Type.ExtendedTypeKind.DefinedList,
        isNullable,
        elements,
    };
}

export function definedListType(
    isNullable: boolean,
    itemTypes: ReadonlyArray<Type.TPowerQueryType>,
): Type.DefinedListType {
    return {
        kind: Type.TypeKind.Type,
        extendedKind: Type.ExtendedTypeKind.DefinedListType,
        isNullable,
        itemTypes,
    };
}

export function definedRecord(
    isNullable: boolean,
    fields: Map<string, Type.TPowerQueryType>,
    isOpen: boolean,
): Type.DefinedRecord {
    return {
        kind: Type.TypeKind.Record,
        extendedKind: Type.ExtendedTypeKind.DefinedRecord,
        isNullable,
        fields,
        isOpen,
    };
}

export function definedTable(isNullable: boolean, fields: Type.OrderedFields, isOpen: boolean): Type.DefinedTable {
    return {
        kind: Type.TypeKind.Table,
        extendedKind: Type.ExtendedTypeKind.DefinedTable,
        isNullable,
        fields,
        isOpen,
    };
}

export function functionType(
    isNullable: boolean,
    parameters: ReadonlyArray<Type.FunctionParameter>,
    returnType: Type.TPowerQueryType,
): Type.FunctionType {
    return {
        kind: Type.TypeKind.Type,
        extendedKind: Type.ExtendedTypeKind.FunctionType,
        isNullable,
        parameters,
        returnType,
    };
}

export function logicalLiteral(isNullable: boolean, literal: string | boolean): Type.LogicalLiteral {
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
        extendedKind: Type.ExtendedTypeKind.LogicalLiteral,
        literal: parsedLiteral,
        normalizedLiteral,
    };
}

export function listType(isNullable: boolean, itemType: Type.TPowerQueryType): Type.ListType {
    return {
        kind: Type.TypeKind.Type,
        extendedKind: Type.ExtendedTypeKind.ListType,
        isNullable,
        itemType,
    };
}

export function numberLiteral(isNullable: boolean, literal: string | number): Type.NumberLiteral {
    let parsedLiteral: string;
    let normalizedLiteral: number;

    if (typeof literal === "number") {
        parsedLiteral = literal.toString();
        normalizedLiteral = literal;
    } else {
        parsedLiteral = literal;
        normalizedLiteral = Number.parseFloat(Assert.asDefined(StringUtils.normalizeNumber(literal)));
    }

    return {
        isNullable,
        kind: Type.TypeKind.Number,
        extendedKind: Type.ExtendedTypeKind.NumberLiteral,
        literal: parsedLiteral,
        normalizedLiteral,
    };
}

export function primaryPrimitiveType(
    isNullable: boolean,
    primitiveType: Type.TPrimitiveType,
): Type.PrimaryPrimitiveType {
    return {
        kind: Type.TypeKind.Type,
        extendedKind: Type.ExtendedTypeKind.PrimaryPrimitiveType,
        isNullable,
        primitiveType,
    };
}

export function recordType(
    isNullable: boolean,
    fields: Map<string, Type.TPowerQueryType>,
    isOpen: boolean,
): Type.RecordType {
    return {
        kind: Type.TypeKind.Type,
        extendedKind: Type.ExtendedTypeKind.RecordType,
        isNullable,
        fields,
        isOpen,
    };
}

export function tableType(
    isNullable: boolean,
    fields: Map<string, Type.TPowerQueryType>,
    isOpen: boolean,
): Type.TableType {
    return {
        kind: Type.TypeKind.Type,
        extendedKind: Type.ExtendedTypeKind.TableType,
        isNullable,
        fields,
        isOpen,
    };
}

export function tableTypePrimary(
    isNullable: boolean,
    primaryExpression: Type.TPowerQueryType,
): Type.TableTypePrimaryExpression {
    return {
        kind: Type.TypeKind.Type,
        extendedKind: Type.ExtendedTypeKind.TableTypePrimaryExpression,
        isNullable,
        primaryExpression,
    };
}

export function textLiteral(isNullable: boolean, literal: string): Type.TextLiteral {
    literal = StringUtils.ensureQuoted(literal);

    return {
        isNullable,
        kind: Type.TypeKind.Text,
        extendedKind: Type.ExtendedTypeKind.TextLiteral,
        literal,
        normalizedLiteral: literal,
    };
}
