// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isCompatible, isCompatibleWithFunctionParameter } from "./isCompatible";
import { Trace, TraceManager } from "../../../common/trace";
import { ArrayUtils } from "../../../common";
import { isEqualFunctionParameter } from "./isEqualType";
import { Type } from "..";
import { TypeUtilsTraceConstant } from "./typeTraceConstant";

export type TChecked =
    | CheckedDefinedFunction
    | CheckedDefinedList
    | CheckedDefinedRecord
    | CheckedDefinedTable
    | CheckedFunctionSignature
    | CheckedInvocation;

export interface IChecked<Key, Mismatch> {
    readonly valid: ReadonlyArray<Key>;
    readonly invalid: Map<Key, Mismatch>;
    readonly extraneous: ReadonlyArray<Key>;
    readonly missing: ReadonlyArray<Key>;
}

export interface CheckedDefinedFunction extends IChecked<number, DefinedFunctionMismatch> {
    readonly isReturnTypeCompatible: boolean;
}

export type CheckedDefinedList = IChecked<number, DefinedListMismatch>;

export type CheckedDefinedRecord = IChecked<string, DefinedRecordMismatch>;

export type CheckedDefinedTable = IChecked<string, DefinedTableMismatch>;

export type CheckedFunctionSignature = IChecked<number, FunctionSignatureMismatch>;

export type CheckedInvocation = IChecked<number, InvocationMismatch>;

export type TMismatch =
    | DefinedFunctionMismatch
    | DefinedListMismatch
    | DefinedRecordMismatch
    | DefinedTableMismatch
    | FunctionSignatureMismatch
    | InvocationMismatch;

export interface IMismatch<Actual, Expected> {
    readonly actual: Actual;
    readonly expected: Expected;
}

export type DefinedFunctionMismatch = IMismatch<Type.FunctionParameter, Type.FunctionParameter>;

export type DefinedListMismatch = IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>;

export type DefinedRecordMismatch = IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>;

export type DefinedTableMismatch = IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>;

export type FunctionSignatureMismatch = IMismatch<Type.FunctionParameter, Type.FunctionParameter>;

export type InvocationMismatch = IMismatch<Type.TPowerQueryType | undefined, Type.FunctionParameter>;

export function typeCheckFunction(
    valueType: Type.DefinedFunction,
    schemaType: Type.FunctionType,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CheckedDefinedFunction {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.TypeCheck, typeCheckFunction.name, correlationId);

    const result: CheckedDefinedFunction = {
        ...typeCheckFunctionSignature(valueType, schemaType, traceManager, trace.id),
        isReturnTypeCompatible:
            isCompatible(valueType.returnType, schemaType.returnType, traceManager, trace.id) === true,
    };

    trace.exit();

    return result;
}

export function typeCheckFunctionSignature(
    valueType: Type.FunctionSignature,
    schemaType: Type.FunctionSignature,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CheckedFunctionSignature {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.TypeCheck,
        typeCheckFunctionSignature.name,
        correlationId,
    );

    const result: CheckedFunctionSignature = typeCheckGenericNumber<Type.FunctionParameter, Type.FunctionParameter>(
        valueType.parameters,
        schemaType.parameters,
        (left: Type.FunctionParameter, right: Type.FunctionParameter) => isEqualFunctionParameter(left, right),
        traceManager,
        trace.id,
    );

    trace.exit();

    return result;
}

export function typeCheckInvocation(
    args: ReadonlyArray<Type.TPowerQueryType>,
    definedFunction: Type.DefinedFunction,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CheckedInvocation {
    const trace: Trace = traceManager.entry(TypeUtilsTraceConstant.TypeCheck, typeCheckInvocation.name, correlationId);

    const parameters: ReadonlyArray<Type.FunctionParameter> = definedFunction.parameters;
    const numArgs: number = args.length;
    const numParameters: number = parameters.length;

    const extraneousArgs: ReadonlyArray<number> =
        numArgs > numParameters ? ArrayUtils.range(numArgs - numParameters, numParameters) : [];

    const validArgs: number[] = [];
    const missingArgs: number[] = [];
    const invalidArgs: Map<number, InvocationMismatch> = new Map();

    for (let index: number = 0; index < numParameters; index += 1) {
        const arg: Type.TPowerQueryType | undefined = args[index];
        const parameter: Type.FunctionParameter = parameters[index];

        if (isCompatibleWithFunctionParameter(arg, parameter)) {
            validArgs.push(index);
        } else if (arg !== undefined) {
            invalidArgs.set(index, {
                expected: parameter,
                actual: arg,
            });
        } else {
            missingArgs.push(index);
        }
    }

    const result: CheckedInvocation = {
        valid: validArgs,
        invalid: invalidArgs,
        extraneous: extraneousArgs,
        missing: missingArgs,
    };

    trace.exit();

    return result;
}

export function typeCheckListWithListType(
    valueType: Type.DefinedList,
    schemaType: Type.ListType,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CheckedDefinedList {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.TypeCheck,
        typeCheckListWithListType.name,
        correlationId,
    );

    const validArgs: number[] = [];
    const invalidArgs: Map<number, DefinedListMismatch> = new Map();
    const schemaItemType: Type.TPowerQueryType = schemaType.itemType;
    const valueElements: ReadonlyArray<Type.TPowerQueryType> = valueType.elements;

    for (const [element, index] of ArrayUtils.enumerate(valueElements)) {
        if (isCompatible(element, schemaItemType, traceManager, trace.id)) {
            validArgs.push(index);
        } else {
            invalidArgs.set(index, {
                expected: schemaType,
                actual: element,
            });
        }
    }

    const result: CheckedDefinedList = {
        valid: validArgs,
        invalid: invalidArgs,
        extraneous: [],
        missing: [],
    };

    trace.exit();

    return result;
}

export function typeCheckListWithDefinedListType(
    valueType: Type.DefinedList,
    schemaType: Type.DefinedListType,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CheckedDefinedList {
    return typeCheckGenericNumber(valueType.elements, schemaType.itemTypes, isCompatible, traceManager, correlationId);
}

export function typeCheckRecord(
    valueType: Type.DefinedRecord,
    schemaType: Type.RecordType,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CheckedDefinedRecord {
    return typeCheckRecordOrTable(valueType.fields, schemaType.fields, schemaType.isOpen, traceManager, correlationId);
}

export function typeCheckTable(
    valueType: Type.DefinedTable,
    schemaType: Type.TableType,
    traceManager: TraceManager,
    correlationId: number | undefined,
): CheckedDefinedTable {
    return typeCheckRecordOrTable(valueType.fields, schemaType.fields, schemaType.isOpen, traceManager, correlationId);
}

function typeCheckGenericNumber<
    Value extends Type.TPowerQueryType | Type.FunctionParameter | undefined,
    Schema extends Type.TPowerQueryType | Type.FunctionParameter,
>(
    valueElements: ReadonlyArray<Value>,
    schemaItemTypes: ReadonlyArray<Schema>,
    comparer: (left: Value, right: Schema, traceManager: TraceManager, correlationId: number) => boolean | undefined,
    traceManager: TraceManager,
    correlationId: number | undefined,
): IChecked<number, IMismatch<Value, Schema>> {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.TypeCheck,
        typeCheckGenericNumber.name,
        correlationId,
    );

    const numElements: number = valueElements.length;
    const numItemTypes: number = schemaItemTypes.length;

    let upperBound: number;
    let extraneousIndices: ReadonlyArray<number>;
    let missingIndices: ReadonlyArray<number>;

    if (numElements > numItemTypes) {
        upperBound = numItemTypes;
        extraneousIndices = ArrayUtils.range(numElements - numItemTypes, numItemTypes);
        missingIndices = [];
    } else {
        upperBound = numElements;
        extraneousIndices = [];
        missingIndices = ArrayUtils.range(numItemTypes - numElements, numElements);
    }

    const validIndices: number[] = [];
    const mismatches: Map<number, IMismatch<Value, Schema>> = new Map();

    for (let index: number = 0; index < upperBound; index += 1) {
        const element: Value = valueElements[index];
        const schemaItemType: Schema = schemaItemTypes[index];

        if (comparer(element, schemaItemType, traceManager, trace.id)) {
            validIndices.push(index);
        } else {
            mismatches.set(index, {
                expected: schemaItemType,
                actual: element,
            });
        }
    }

    const result: IChecked<number, IMismatch<Value, Schema>> = {
        valid: validIndices,
        invalid: mismatches,
        extraneous: extraneousIndices,
        missing: missingIndices,
    };

    trace.exit();

    return result;
}

function typeCheckRecordOrTable(
    valueFields: Map<string, Type.TPowerQueryType>,
    schemaFields: Map<string, Type.TPowerQueryType>,
    schemaIsOpen: boolean,
    traceManager: TraceManager,
    correlationId: number | undefined,
): IChecked<string, IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>> {
    const trace: Trace = traceManager.entry(
        TypeUtilsTraceConstant.TypeCheck,
        typeCheckRecordOrTable.name,
        correlationId,
    );

    const validFields: string[] = [];
    const mismatches: Map<string, IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>> = new Map();
    const extraneousFields: string[] = [];

    const missingFields: ReadonlyArray<string> = [...schemaFields.keys()].filter(
        (key: string) => !valueFields.has(key),
    );

    for (const [key, type] of valueFields.entries()) {
        const schemaValueType: Type.TPowerQueryType | undefined = schemaFields.get(key);

        if (schemaValueType !== undefined) {
            if (isCompatible(type, schemaValueType, traceManager, trace.id)) {
                validFields.push(key);
            } else {
                mismatches.set(key, {
                    expected: schemaValueType,
                    actual: type,
                });
            }
        } else if (schemaIsOpen) {
            validFields.push(key);
        } else {
            extraneousFields.push(key);
        }
    }

    const result: IChecked<string, IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>> = {
        valid: validFields,
        invalid: mismatches,
        extraneous: extraneousFields,
        missing: missingFields,
    };

    trace.exit();

    return result;
}
