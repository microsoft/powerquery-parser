// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { ArrayUtils } from "../../../common";
import { isCompatible, isCompatibleWithFunctionParameter } from "./isCompatible";

export interface IChecked<T> {
    readonly valid: ReadonlyArray<T>;
    readonly invalid: ReadonlyArray<T>;
    readonly extraneous: ReadonlyArray<T>;
    readonly missing: ReadonlyArray<T>;
}

export type CheckedDefinedList = IChecked<number>;

export interface CheckedFunction extends IChecked<number> {
    readonly isReturnTypeCompatible: boolean;
}

export type CheckedFunctionSignature = IChecked<number>;

export type CheckedRecord = IChecked<string>;

export type CheckedTable = IChecked<string>;

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
    return typeCheckGenericNumber(valueType.elements, schemaType.itemTypes, isCompatible);
}

export function typeCheckFunction(
    valueType: Type.Function | Type.DefinedFunction,
    schemaType: Type.FunctionType,
): CheckedFunction {
    if (valueType.maybeExtendedKind === undefined) {
        return {
            valid: [],
            invalid: [],
            extraneous: [],
            missing: ArrayUtils.range(schemaType.parameters.length, 0),
            isReturnTypeCompatible:
                schemaType.returnType.kind === Type.TypeKind.Any &&
                schemaType.returnType.maybeExtendedKind === undefined &&
                schemaType.returnType.isNullable === false,
        };
    }

    return {
        ...typeCheckFunctionSignature(valueType, schemaType),
        isReturnTypeCompatible: isCompatible(valueType.returnType, schemaType.returnType) === true,
    };
}

export function typeCheckFunctionSignature(
    valueType: Type.FunctionSignature,
    schemaType: Type.FunctionSignature,
): CheckedFunctionSignature {
    return typeCheckGenericNumber(
        valueType.parameters,
        schemaType.parameters,
        (left: Type.FunctionParameter, right: Type.FunctionParameter) => isCompatibleWithFunctionParameter(left, right),
    );
}

export function typeCheckRecord(
    valueType: Type.Record | Type.DefinedRecord,
    schemaType: Type.RecordType,
): CheckedRecord {
    if (valueType.maybeExtendedKind === undefined) {
        return typeCheckRecordOrTableOrTablePrimitive([...schemaType.fields.keys()]);
    }

    return typeCheckRecordOrTable(valueType.fields, schemaType.fields, schemaType.isOpen);
}

function typeCheckRecordOrTableOrTablePrimitive(schemaTypeKeys: ReadonlyArray<string>): CheckedRecord | CheckedTable {
    return {
        valid: [],
        invalid: [],
        extraneous: [],
        missing: schemaTypeKeys,
    };
}

export function typeCheckTable(valueType: Type.Table | Type.DefinedTable, schemaType: Type.TableType): CheckedTable {
    if (valueType.maybeExtendedKind === undefined) {
        return typeCheckRecordOrTableOrTablePrimitive([...schemaType.fields.keys()]);
    }

    return typeCheckRecordOrTable(valueType.fields, schemaType.fields, schemaType.isOpen);
}

function typeCheckGenericNumber<T>(
    valueElements: ReadonlyArray<T>,
    schemaItemTypes: ReadonlyArray<T>,
    valueCmpFn: (left: T, right: T) => boolean | undefined,
): IChecked<number> {
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
        const element: T = valueElements[index];
        const schemaItemType: T = schemaItemTypes[index];

        if (valueCmpFn(element, schemaItemType)) {
            validIndices.push(index);
        } else {
            invalidIndices.push(index);
        }
    }

    return {
        valid: validIndices,
        invalid: invalidIndices,
        extraneous: extraneousIndices,
        missing: missingIndices,
    };
}

function typeCheckRecordOrTable(
    valueFields: Map<string, Type.TType>,
    schemaFields: Map<string, Type.TType>,
    schemaIsOpen: boolean,
): IChecked<string> {
    const validFields: string[] = [];
    const invalidFields: string[] = [];
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
                invalidFields.push(key);
            }
        } else if (schemaIsOpen === true) {
            validFields.push(key);
        } else {
            extraneousFields.push(key);
        }
    }

    return {
        valid: validFields,
        invalid: invalidFields,
        extraneous: extraneousFields,
        missing: missingFields,
    };
}
