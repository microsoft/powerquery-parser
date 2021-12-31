// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isCompatible, isCompatibleWithFunctionParameter } from "./isCompatible";
import { ArrayUtils } from "../../../common";
import { isEqualFunctionParameter } from "./isEqualType";
import { Type } from "..";

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
): CheckedDefinedFunction {
    return {
        ...typeCheckFunctionSignature(valueType, schemaType),
        isReturnTypeCompatible: isCompatible(valueType.returnType, schemaType.returnType) === true,
    };
}

export function typeCheckFunctionSignature(
    valueType: Type.FunctionSignature,
    schemaType: Type.FunctionSignature,
): CheckedFunctionSignature {
    return typeCheckGenericNumber<Type.FunctionParameter, Type.FunctionParameter>(
        valueType.parameters,
        schemaType.parameters,
        (left: Type.FunctionParameter, right: Type.FunctionParameter) => isEqualFunctionParameter(left, right),
    );
}

export function typeCheckInvocation(
    args: ReadonlyArray<Type.TPowerQueryType>,
    definedFunction: Type.DefinedFunction,
): CheckedInvocation {
    const parameters: ReadonlyArray<Type.FunctionParameter> = definedFunction.parameters;
    const numArgs: number = args.length;
    const numParameters: number = parameters.length;

    const extraneousArgs: ReadonlyArray<number> =
        numArgs > numParameters ? ArrayUtils.range(numArgs - numParameters, numParameters) : [];

    const validArgs: number[] = [];
    const missingArgs: number[] = [];
    const invalidArgs: Map<number, InvocationMismatch> = new Map();
    for (let index: number = 0; index < numParameters; index += 1) {
        const maybeArg: Type.TPowerQueryType | undefined = args[index];
        const parameter: Type.FunctionParameter = parameters[index];

        if (isCompatibleWithFunctionParameter(maybeArg, parameter)) {
            validArgs.push(index);
        } else if (maybeArg !== undefined) {
            invalidArgs.set(index, {
                expected: parameter,
                actual: maybeArg,
            });
        } else {
            missingArgs.push(index);
        }
    }

    return {
        valid: validArgs,
        invalid: invalidArgs,
        extraneous: extraneousArgs,
        missing: missingArgs,
    };
}

export function typeCheckListWithListType(valueType: Type.DefinedList, schemaType: Type.ListType): CheckedDefinedList {
    const validArgs: number[] = [];
    const invalidArgs: Map<number, DefinedListMismatch> = new Map();
    const schemaItemType: Type.TPowerQueryType = schemaType.itemType;

    const valueElements: ReadonlyArray<Type.TPowerQueryType> = valueType.elements;
    const numElements: number = valueElements.length;
    for (let index: number = 0; index < numElements; index += 1) {
        const element: Type.TPowerQueryType = valueElements[index];
        if (isCompatible(element, schemaItemType)) {
            validArgs.push(index);
        } else {
            invalidArgs.set(index, {
                expected: schemaType,
                actual: element,
            });
        }
    }

    return {
        valid: validArgs,
        invalid: invalidArgs,
        extraneous: [],
        missing: [],
    };
}

export function typeCheckListWithDefinedListType(
    valueType: Type.DefinedList,
    schemaType: Type.DefinedListType,
): CheckedDefinedList {
    return typeCheckGenericNumber(valueType.elements, schemaType.itemTypes, isCompatible);
}

export function typeCheckRecord(valueType: Type.DefinedRecord, schemaType: Type.RecordType): CheckedDefinedRecord {
    return typeCheckRecordOrTable(valueType.fields, schemaType.fields, schemaType.isOpen);
}

export function typeCheckTable(valueType: Type.DefinedTable, schemaType: Type.TableType): CheckedDefinedTable {
    return typeCheckRecordOrTable(valueType.fields, schemaType.fields, schemaType.isOpen);
}

function typeCheckGenericNumber<
    Value extends Type.TPowerQueryType | Type.FunctionParameter | undefined,
    Schema extends Type.TPowerQueryType | Type.FunctionParameter,
>(
    valueElements: ReadonlyArray<Value>,
    schemaItemTypes: ReadonlyArray<Schema>,
    valueCmpFn: (left: Value, right: Schema) => boolean | undefined,
): IChecked<number, IMismatch<Value, Schema>> {
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

        if (valueCmpFn(element, schemaItemType)) {
            validIndices.push(index);
        } else {
            mismatches.set(index, {
                expected: schemaItemType,
                actual: element,
            });
        }
    }

    return {
        valid: validIndices,
        invalid: mismatches,
        extraneous: extraneousIndices,
        missing: missingIndices,
    };
}

function typeCheckRecordOrTable(
    valueFields: Map<string, Type.TPowerQueryType>,
    schemaFields: Map<string, Type.TPowerQueryType>,
    schemaIsOpen: boolean,
): IChecked<string, IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>> {
    const validFields: string[] = [];
    const mismatches: Map<string, IMismatch<Type.TPowerQueryType, Type.TPowerQueryType>> = new Map();
    const extraneousFields: string[] = [];
    const missingFields: ReadonlyArray<string> = [...schemaFields.keys()].filter(
        (key: string) => !valueFields.has(key),
    );

    for (const [key, type] of valueFields.entries()) {
        const maybeSchemaValueType: Type.TPowerQueryType | undefined = schemaFields.get(key);
        if (maybeSchemaValueType !== undefined) {
            const schemaValueType: Type.TPowerQueryType = maybeSchemaValueType;

            if (isCompatible(type, schemaValueType)) {
                validFields.push(key);
            } else {
                mismatches.set(key, {
                    expected: schemaValueType,
                    actual: type,
                });
            }
        } else if (schemaIsOpen === true) {
            validFields.push(key);
        } else {
            extraneousFields.push(key);
        }
    }

    return {
        valid: validFields,
        invalid: mismatches,
        extraneous: extraneousFields,
        missing: missingFields,
    };
}
