// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Type, TypeUtils } from "../../../../language/type";
import { CheckedRecord } from "../../../../language/type/typeUtils";

describe(`TypeUtils - typeCheck`, () => {
    describe(`${Type.ExtendedTypeKind.RecordType}`, () => {
        it(`primitive, closed`, () => {
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
                missing: [],
            };
            expect(expected).deep.equal(actual);
        });
    });
});
