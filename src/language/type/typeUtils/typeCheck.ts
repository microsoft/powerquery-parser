// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { ArrayUtils } from "../../../powerquery-parser/common";
import { isCompatible, isCompatibleWithFunctionParameter } from "./isCompatible";

export type TChecked =
    | CheckedDefinedFunction
    | CheckedDefinedList
    | CheckedDefinedRecord
    | CheckedDefinedTable
    | CheckedFunctionSignature;

export interface IChecked<Key, T extends Type.TType | Type.FunctionParameter> {
    readonly valid: ReadonlyArray<Key>;
    readonly invalid: ReadonlyArray<Mismatch<Key, T>>;
    readonly extraneous: ReadonlyArray<Key>;
    readonly missing: ReadonlyArray<Key>;
}

export type CheckedDefinedList = IChecked<number, Type.TType>;

export interface CheckedDefinedFunction extends IChecked<number, Type.FunctionParameter> {
    readonly isReturnTypeCompatible: boolean;
}

export type CheckedFunctionSignature = IChecked<number, Type.FunctionParameter>;

export type CheckedDefinedRecord = IChecked<string, Type.TType>;

export type CheckedDefinedTable = IChecked<string, Type.TType>;

export interface Mismatch<K, T> {
    readonly key: K;
    readonly expected: T;
    readonly actual: T;
}

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
    return typeCheckGenericNumber<Type.FunctionParameter>(
        valueType.parameters,
        schemaType.parameters,
        (left: Type.FunctionParameter, right: Type.FunctionParameter) => isCompatibleWithFunctionParameter(left, right),
    );
}

export function typeCheckListWithListType(valueType: Type.DefinedList, schemaType: Type.ListType): CheckedDefinedList {
    const valid: number[] = [];
    const invalid: Mismatch<number, Type.TType>[] = [];
    const schemaItemType: Type.TType = schemaType.itemType;

    const valueElements: ReadonlyArray<Type.TType> = valueType.elements;
    const numElements: number = valueElements.length;
    for (let index: number = 0; index < numElements; index += 1) {
        const element: Type.TType = valueElements[index];
        if (isCompatible(element, schemaItemType)) {
            valid.push(index);
        } else {
            invalid.push({
                key: index,
                expected: schemaType,
                actual: element,
            });
        }
    }

    return {
        valid,
        invalid,
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

function typeCheckGenericNumber<T extends Type.TType | Type.FunctionParameter>(
    valueElements: ReadonlyArray<T>,
    schemaItemTypes: ReadonlyArray<T>,
    valueCmpFn: (left: T, right: T) => boolean | undefined,
): IChecked<number, T> {
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
    const mismatches: Mismatch<number, T>[] = [];
    for (let index: number = 0; index < upperBound; index += 1) {
        const element: T = valueElements[index];
        const schemaItemType: T = schemaItemTypes[index];

        if (valueCmpFn(element, schemaItemType)) {
            validIndices.push(index);
        } else {
            mismatches.push({
                key: index,
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
    valueFields: Map<string, Type.TType>,
    schemaFields: Map<string, Type.TType>,
    schemaIsOpen: boolean,
): IChecked<string, Type.TType> {
    const validFields: string[] = [];
    const mismatches: Mismatch<string, Type.TType>[] = [];
    const extraneousFields: string[] = [];
    const missingFields: ReadonlyArray<string> = [...schemaFields.keys()].filter(
        (key: string) => valueFields.has(key) === false,
    );

    for (const [key, type] of valueFields.entries()) {
        const maybeSchemaValueType: Type.TType | undefined = schemaFields.get(key);
        if (maybeSchemaValueType !== undefined) {
            if (isCompatible(type, maybeSchemaValueType)) {
                validFields.push(key);
            } else {
                mismatches.push({
                    key,
                    expected: maybeSchemaValueType,
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
