// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Trace, TraceManager } from "../../../common/trace";
import { Assert } from "../../../common";
import { Constant } from "../..";
import { Type } from "..";
import { TypeUtilsTraceConstant } from "./typeTraceConstant";

export function nameOf(
    type: Type.TPowerQueryType,
    traceManager: TraceManager,
    maybeCorrelationId: number | undefined,
): string {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.NameOf, nameOf.name, maybeCorrelationId);

    let result: string;

    if (type.kind === Type.TypeKind.Null) {
        result = "null";
    } else {
        switch (type.maybeExtendedKind) {
            case Type.ExtendedTypeKind.NumberLiteral:
            case Type.ExtendedTypeKind.TextLiteral:
                result = prefixNullableIfRequired(type, `${type.literal}`);
                break;

            case Type.ExtendedTypeKind.AnyUnion:
                result = type.unionedTypePairs
                    .map((subtype: Type.TPowerQueryType) => nameOf(subtype, traceManager, trace.id))
                    .join(" | ");

                break;

            case Type.ExtendedTypeKind.DefinedFunction:
                result = prefixNullableIfRequired(type, nameOfFunctionSignature(type, true, traceManager, trace.id));
                break;

            case Type.ExtendedTypeKind.DefinedList:
                result = prefixNullableIfRequired(type, `{${nameOfIterable(type.elements, traceManager, trace.id)}}`);
                break;

            case Type.ExtendedTypeKind.DefinedListType:
                result = prefixNullableIfRequired(
                    type,
                    `type {${nameOfIterable(type.itemTypes, traceManager, trace.id)}}`,
                );

                break;

            case Type.ExtendedTypeKind.DefinedRecord:
                result = prefixNullableIfRequired(type, nameOfFieldSpecificationList(type, traceManager, trace.id));
                break;

            case Type.ExtendedTypeKind.DefinedTable:
                result = prefixNullableIfRequired(
                    type,
                    `table ${nameOfFieldSpecificationList(type, traceManager, trace.id)}`,
                );

                break;

            case Type.ExtendedTypeKind.FunctionType:
                result = prefixNullableIfRequired(
                    type,
                    `type function ${nameOfFunctionSignature(type, false, traceManager, trace.id)}`,
                );

                break;

            case Type.ExtendedTypeKind.ListType:
                result = prefixNullableIfRequired(type, `type {${nameOf(type.itemType, traceManager, trace.id)}}`);
                break;

            case Type.ExtendedTypeKind.LogicalLiteral:
                result = prefixNullableIfRequired(type, `${type.normalizedLiteral}`);
                break;

            case Type.ExtendedTypeKind.PrimaryPrimitiveType:
                result = prefixNullableIfRequired(type, `type ${nameOf(type.primitiveType, traceManager, trace.id)}`);
                break;

            case Type.ExtendedTypeKind.RecordType:
                result = prefixNullableIfRequired(
                    type,
                    `type ${nameOfFieldSpecificationList(type, traceManager, trace.id)}`,
                );

                break;

            case Type.ExtendedTypeKind.TableType:
                result = prefixNullableIfRequired(
                    type,
                    `type table ${nameOfFieldSpecificationList(type, traceManager, trace.id)}`,
                );

                break;

            case Type.ExtendedTypeKind.TableTypePrimaryExpression:
                result = prefixNullableIfRequired(
                    type,
                    `type table ${nameOf(type.primaryExpression, traceManager, trace.id)}`,
                );

                break;

            case undefined:
                result = prefixNullableIfRequired(type, nameOfTypeKind(type.kind));
                break;

            default:
                throw Assert.isNever(type);
        }
    }

    trace.exit();

    return result;
}

export function nameOfFunctionParameter(
    parameter: Type.FunctionParameter,
    traceManager: TraceManager,
    maybeCorrelationId: number | undefined,
): string {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.NameOf,
        nameOfFunctionParameter.name,
        maybeCorrelationId,
    );

    let partial: string = `${parameter.nameLiteral}:`;

    if (parameter.isOptional === true) {
        partial += " optional";
    }

    if (parameter.isNullable === true) {
        partial += " nullable";
    }

    if (parameter.maybeType !== undefined) {
        partial += ` ${nameOfTypeKind(parameter.maybeType)}`;
    } else {
        partial += ` ${nameOfTypeKind(Type.TypeKind.Any)}`;
    }

    trace.exit();

    return partial;
}

export function nameOfFunctionSignature(
    type: Type.FunctionSignature,
    includeFatArrow: boolean,
    traceManager: TraceManager,
    maybeCorrelationId: number | undefined,
): string {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.NameOf,
        nameOfFunctionSignature.name,
        maybeCorrelationId,
    );

    const parameters: string = type.parameters
        .map((parameter: Type.FunctionParameter) => nameOfFunctionParameter(parameter, traceManager, trace.id))
        .join(", ");

    const result: string = `(${parameters})${includeFatArrow ? " =>" : ""} ${nameOf(
        type.returnType,
        traceManager,
        trace.id,
    )}`;

    trace.exit();

    return result;
}

export function nameOfTypeKind(kind: Type.TypeKind): string {
    return kind === Type.TypeKind.NotApplicable ? "not applicable" : kind.toLowerCase();
}

function nameOfFieldSpecificationList(
    type: Type.TFieldSpecificationList,
    traceManager: TraceManager,
    correlationId: number | undefined,
): string {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.NameOf,
        nameOfFieldSpecificationList.name,
        correlationId,
    );

    const chunks: string[] = [];

    for (const [key, value] of type.fields.entries()) {
        chunks.push(`${key}: ${nameOf(value, traceManager, trace.id)}`);
    }

    if (type.isOpen === true) {
        chunks.push("...");
    }

    const pairs: string = chunks.join(", ");
    const result: string = `[${pairs}]`;

    trace.exit();

    return result;
}

function nameOfIterable(
    collection: ReadonlyArray<Type.TPowerQueryType>,
    traceManager: TraceManager,
    correlationId: number,
): string {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.NameOf, nameOfIterable.name, correlationId);

    const result: string = collection
        .map((item: Type.TPowerQueryType) => nameOf(item, traceManager, trace.id))
        .join(", ");

    trace.exit();

    return result;
}

function prefixNullableIfRequired(type: Type.TPowerQueryType, name: string): string {
    return type.isNullable ? `${Constant.LanguageConstant.Nullable} ${name}` : name;
}
