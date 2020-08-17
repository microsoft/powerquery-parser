// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Type, TypeUtils } from "../../../../language/type";
import { CheckedRecord, IChecked } from "../../../../language/type/typeUtils";

function expectEqual<T>(actual: IChecked<T>, expected: IChecked<T>): void {
    expect(actual.valid).to.have.members(expected.valid);
    expect(actual.invalid).to.have.members(expected.invalid);
    expect(actual.extraneous).to.have.members(expected.extraneous);
    expect(actual.missing).to.have.members(expected.missing);
}

describe(`TypeUtils - typeCheck`, () => {
    describe(`${Type.ExtendedTypeKind.RecordType}`, () => {
        it(`primitive`, () => {
            const valueType: Type.Record = Type.RecordInstance;
            const schemaType: Type.RecordType = TypeUtils.recordTypeFactory(
                false,
                new Map<string, Type.TType>([
                    ["number", Type.NumberInstance],
                    ["text", Type.TextInstance],
                ]),
                false,
            );
            const actual: CheckedRecord = TypeUtils.typeCheckRecord(valueType, schemaType);
            const expected: CheckedRecord = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: ["number", "text"],
            };
            expectEqual(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.DefinedRecord}`, () => {
            const valueType: Type.DefinedRecord = TypeUtils.definedRecordFactory(
                false,
                new Map<string, Type.TType>([
                    ["number", Type.NullableNumberInstance],
                    ["nullableNumber", Type.NullableNumberInstance],
                    ["table", Type.TableInstance],
                ]),
                false,
            );
            const schemaType: Type.RecordType = TypeUtils.recordTypeFactory(
                false,
                new Map<string, Type.TType>([
                    ["number", Type.NumberInstance],
                    ["nullableNumber", Type.NullableNumberInstance],
                    ["text", Type.TextInstance],
                ]),
                false,
            );
            const actual: CheckedRecord = TypeUtils.typeCheckRecord(valueType, schemaType);
            const expected: CheckedRecord = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };
            expectEqual(actual, expected);
        });
    });
});
