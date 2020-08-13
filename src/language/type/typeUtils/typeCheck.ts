// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "..";
import { isCompatible } from "./isCompatible";

// export type ValidationType = Type.RecordType | Type.TableType | Type.ListType | Type.FunctionType;

interface CheckedRecord {
    readonly validFields: ReadonlyArray<string>;
    readonly invalidFields: ReadonlyArray<string>;
    readonly extraneousFields: ReadonlyArray<string>;
    readonly missingFields: ReadonlyArray<string>;
}

export function typeCheckRecord(
    valueType: Type.Record | Type.DefinedRecord,
    schemaType: Type.RecordType,
): CheckedRecord {
    if (valueType.maybeExtendedKind === undefined) {
        throw new Error();
    }

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

// export function typeCheckList
