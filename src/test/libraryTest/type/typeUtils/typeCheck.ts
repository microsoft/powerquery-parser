// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Type, TypeUtils } from "../../../../language/type";
import { CheckedFunction, CheckedRecord, CheckedTable, IChecked } from "../../../../language/type/typeUtils";

function expectEqual<T>(actual: IChecked<T>, expected: IChecked<T>): void {
    expect(actual.valid).to.have.members(expected.valid, "mismatch on valid");
    expect(actual.invalid).to.have.members(expected.invalid, "mismatch on invalid");
    expect(actual.extraneous).to.have.members(expected.extraneous, "mismatch on extraneous");
    expect(actual.missing).to.have.members(expected.missing, "mismatch on missing");
}

describe(`TypeUtils - typeCheck`, () => {
    describe(`${Type.ExtendedTypeKind.FunctionType}`, () => {
        it(`primitive`, () => {
            const valueType: Type.Function = Type.FunctionInstance;
            const schemaType: Type.FunctionType = TypeUtils.functionTypeFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: undefined,
                    },
                ],
                Type.AnyInstance,
            );
            const actual: CheckedFunction = TypeUtils.typeCheckFunction(valueType, schemaType);
            const expected: CheckedFunction = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0],
                isReturnTypeCompatible: false,
            };
            expectEqual(expected, actual);
        });

        it(`return type`, () => {
            const valueType: Type.DefinedFunction = TypeUtils.definedFunctionFactory(
                false,
                [],
                Type.NullableTextInstance,
            );
            const schemaType: Type.FunctionType = TypeUtils.functionTypeFactory(false, [], Type.NullableTextInstance);
            const actual: CheckedFunction = TypeUtils.typeCheckFunction(valueType, schemaType);
            const expected: CheckedFunction = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [],
                isReturnTypeCompatible: true,
            };
            expectEqual(expected, actual);
        });

        it(`primitive`, () => {
            const valueType: Type.Function = Type.FunctionInstance;
            const schemaType: Type.FunctionType = TypeUtils.functionTypeFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: undefined,
                    },
                ],
                Type.AnyInstance,
            );
            const actual: CheckedFunction = TypeUtils.typeCheckFunction(valueType, schemaType);
            const expected: CheckedFunction = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0],
                isReturnTypeCompatible: false,
            };
            expectEqual(expected, actual);
        });
    });

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

    describe(`${Type.ExtendedTypeKind.TableType}`, () => {
        it(`primitive`, () => {
            const valueType: Type.Table = Type.TableInstance;
            const schemaType: Type.TableType = TypeUtils.tableTypeFactory(
                false,
                new Map<string, Type.TType>([
                    ["number", Type.NumberInstance],
                    ["text", Type.TextInstance],
                ]),
                false,
            );
            const actual: CheckedTable = TypeUtils.typeCheckTable(valueType, schemaType);
            const expected: CheckedTable = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: ["number", "text"],
            };
            expectEqual(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.DefinedTable}`, () => {
            const valueType: Type.DefinedTable = TypeUtils.definedTableFactory(
                false,
                new Map<string, Type.TType>([
                    ["number", Type.NullableNumberInstance],
                    ["nullableNumber", Type.NullableNumberInstance],
                    ["table", Type.TableInstance],
                ]),
                false,
            );
            const schemaType: Type.TableType = TypeUtils.tableTypeFactory(
                false,
                new Map<string, Type.TType>([
                    ["number", Type.NumberInstance],
                    ["nullableNumber", Type.NullableNumberInstance],
                    ["text", Type.TextInstance],
                ]),
                false,
            );
            const actual: CheckedTable = TypeUtils.typeCheckTable(valueType, schemaType);
            const expected: CheckedTable = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };
            expectEqual(actual, expected);
        });
    });
});
