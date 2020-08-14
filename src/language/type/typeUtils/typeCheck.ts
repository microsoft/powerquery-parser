// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { ArrayUtils } from "../../../common";
import { isCompatible } from "./isCompatible";
import { isEqualFunctionParameter } from "./isEqualType";

// export type ValidationType = Type.RecordType | Type.TableType | Type.ListType | Type.FunctionType;

export interface CheckedDefinedList {
    readonly validIndices: ReadonlyArray<number>;
    readonly invalidIndices: ReadonlyArray<number>;
    readonly extraneousIndices: ReadonlyArray<number>;
    readonly missingIndices: ReadonlyArray<number>;
}

export interface CheckedRecord {
    readonly validFields: ReadonlyArray<string>;
    readonly invalidFields: ReadonlyArray<string>;
    readonly extraneousFields: ReadonlyArray<string>;
    readonly missingFields: ReadonlyArray<string>;
}

export interface CheckedTable {
    readonly validFields: ReadonlyArray<string>;
    readonly invalidFields: ReadonlyArray<string>;
    readonly extraneousFields: ReadonlyArray<string>;
    readonly missingFields: ReadonlyArray<string>;
}

export interface CheckedFunctionSignature {
    readonly validParameters: ReadonlyArray<number>;
    readonly invalidParameters: ReadonlyArray<number>;
    readonly extraneousParameters: ReadonlyArray<number>;
    readonly missingParameters: ReadonlyArray<number>;
}

export function typeCheck(valueType: Type.TType, schemaType: Type.TType): boolean {
    return false;
}

export function typeCheckListTypeWithListType(valueType: Type.DefinedList, schemaType: Type.ListType): boolean {
    const schemaItemType: Type.TType = schemaType.itemType;
    for (const element of valueType.elements) {
        if (!isCompatible(element, schemaItemType)) {
            return false;
        }
    }

    return true;
}

export function typeCheckListTypeWithDefinedListType(
    valueType: Type.DefinedList,
    schemaType: Type.DefinedListType,
): CheckedDefinedList {
    const valueElements: ReadonlyArray<Type.TType> = valueType.elements;
    const schemaItemTypes: ReadonlyArray<Type.TType> = schemaType.itemTypes;

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
    const invalidIndices: number[] = [];
    for (let index: number = 0; index < upperBound; index += 1) {
        const element: Type.TType = valueElements[index];
        const schemaItemType: Type.TType = schemaItemTypes[index];

        if (isCompatible(element, schemaItemType)) {
            validIndices.push(index);
        } else {
            invalidIndices.push(index);
        }
    }

    return {
        validIndices,
        invalidIndices,
        extraneousIndices,
        missingIndices,
    };

    // return true;
}

export function typeCheckRecord(valueType: Type.DefinedRecord, schemaType: Type.RecordType): CheckedRecord {
    const validFields: string[] = [];
    const invalidFields: string[] = [];
    const extraneousFields: string[] = [];
    const missingFields: ReadonlyArray<string> = [...schemaType.fields.keys()].filter(key => valueType.fields.has(key));

    for (const [key, type] of valueType.fields.entries()) {
        const maybeSchemaValueType: Type.TType | undefined = schemaType.fields.get(key);
        if (maybeSchemaValueType !== undefined) {
            if (isCompatible(type, maybeSchemaValueType)) {
                validFields.push(key);
            } else {
                invalidFields.push(key);
            }
        } else {
            extraneousFields.push(key);
        }
    }

    return {
        validFields,
        invalidFields,
        extraneousFields,
        missingFields,
    };
}

export function typeCheckTable(valueType: Type.DefinedTable, schemaType: Type.TableType): CheckedTable {
    const validFields: string[] = [];
    const invalidFields: string[] = [];
    const extraneousFields: string[] = [];
    const missingFields: ReadonlyArray<string> = [...schemaType.fields.keys()].filter(key => valueType.fields.has(key));

    for (const [key, type] of valueType.fields.entries()) {
        const maybeSchemaValueType: Type.TType | undefined = schemaType.fields.get(key);
        if (maybeSchemaValueType !== undefined) {
            if (isCompatible(type, maybeSchemaValueType)) {
                validFields.push(key);
            } else {
                invalidFields.push(key);
            }
        } else {
            extraneousFields.push(key);
        }
    }

    return {
        validFields,
        invalidFields,
        extraneousFields,
        missingFields,
    };
}

export function typeCheckFunctionSignature(
    valueType: Type.FunctionSignature,
    schemaType: Type.FunctionSignature,
): CheckedFunctionSignature {
    const valueParameters: ReadonlyArray<Type.FunctionParameter> = valueType.parameters;
    const schemaParameters: ReadonlyArray<Type.FunctionParameter> = schemaType.parameters;

    const numValueParameters: number = valueType.parameters.length;
    const numSchemaParameters: number = schemaType.parameters.length;

    let upperBound: number;
    let extraneousParameters: ReadonlyArray<number>;
    let missingParameters: ReadonlyArray<number>;
    if (numValueParameters > numSchemaParameters) {
        upperBound = numSchemaParameters;
        extraneousParameters = ArrayUtils.range(numValueParameters - numSchemaParameters, numSchemaParameters);
        missingParameters = [];
    } else {
        upperBound = numValueParameters;
        extraneousParameters = [];
        missingParameters = ArrayUtils.range(numSchemaParameters - numValueParameters, numValueParameters);
    }

    const validParameters: number[] = [];
    const invalidParameters: number[] = [];

    for (let index: number = 0; index < upperBound; index += 1) {
        if (isEqualFunctionParameter(valueParameters[index], schemaParameters[index])) {
            validParameters.push(index);
        } else {
            invalidParameters.push(index);
        }
    }

    return {
        validParameters,
        invalidParameters,
        extraneousParameters,
        missingParameters,
    };
}
