// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Type, TypeUtils } from "../../../../language/type";
import {
    CheckedDefinedFunction,
    CheckedDefinedList,
    CheckedDefinedRecord,
    CheckedDefinedTable,
    Mismatch,
    TChecked,
} from "../../../../language/type/typeUtils";

interface AbridgedChecked<K = number | string> {
    readonly valid: ReadonlyArray<K>;
    readonly invalid: ReadonlyArray<K>;
    readonly extraneous: ReadonlyArray<K>;
    readonly missing: ReadonlyArray<K>;
}

function abridgedCheckedFactory(actual: TChecked): AbridgedChecked {
    const mismatched: ReadonlyArray<Mismatch<string | number, Type.TType | Type.FunctionParameter>> = actual.invalid;
    return {
        valid: actual.valid,
        invalid: mismatched.map(mismatch => mismatch.key),
        extraneous: actual.extraneous,
        missing: actual.missing,
    };
}

function expectEqual(actual: AbridgedChecked, expected: AbridgedChecked): void {
    expect(actual.valid).to.have.members(expected.valid, "mismatch on valid");
    expect(actual.invalid).to.have.members(expected.invalid, "mismatch on invalid");
    expect(actual.extraneous).to.have.members(expected.extraneous, "mismatch on extraneous");
    expect(actual.missing).to.have.members(expected.missing, "mismatch on missing");
}

describe(`TypeUtils - typeCheck`, () => {
    describe(`Table.RenameColumns`, () => {
        it(`list with two text elements, valid`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.TextInstance,
            ]);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [
                Type.TextInstance,
                Type.TextInstance,
            ]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list with two text elements, invalid`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.TextInstance,
                Type.TextInstance,
            ]);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [
                Type.TextInstance,
                Type.TextInstance,
            ]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [2],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, valid single list`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            ]);
            const schemaType: Type.ListType = TypeUtils.listTypeFactory(
                false,
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            );
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, valid multiple list`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            ]);
            const schemaType: Type.ListType = TypeUtils.listTypeFactory(
                false,
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            );
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0, 1, 2, 3],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, empty list`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, []);
            const schemaType: Type.ListType = TypeUtils.listTypeFactory(
                false,
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            );
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, invalid single list`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                TypeUtils.definedListFactory(false, [Type.NumberInstance, Type.TextInstance]),
            ]);
            const schemaType: Type.ListType = TypeUtils.listTypeFactory(
                false,
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            );
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [0],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, invalid multiple list`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.NumberInstance]),
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            ]);
            const schemaType: Type.ListType = TypeUtils.listTypeFactory(
                false,
                TypeUtils.definedListFactory(false, [Type.TextInstance, Type.TextInstance]),
            );
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0, 2, 3],
                invalid: [1],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Type.ExtendedTypeKind.DefinedListType}`, () => {
        it(`valid`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`invalid`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.DateInstance,
            ]);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [1],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`extraneous`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [Type.TextInstance]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [1],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`missing`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, []);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0, 1],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Type.ExtendedTypeKind.ListType}`, () => {
        it(`valid`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.TextInstance,
            ]);
            const schemaType: Type.ListType = TypeUtils.listTypeFactory(false, Type.TextInstance);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`invalid`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.DateInstance,
            ]);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [1],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`extraneous`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [Type.TextInstance]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [1],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`missing`, () => {
            const valueType: Type.DefinedList = TypeUtils.definedListFactory(false, []);
            const schemaType: Type.DefinedListType = TypeUtils.definedListTypeFactory(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            const actual: CheckedDefinedList = TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0, 1],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Type.ExtendedTypeKind.FunctionType}`, () => {
        it(`return type`, () => {
            const valueType: Type.DefinedFunction = TypeUtils.definedFunctionFactory(
                false,
                [],
                Type.NullableTextInstance,
            );
            const schemaType: Type.FunctionType = TypeUtils.functionTypeFactory(false, [], Type.NullableTextInstance);
            const actual: CheckedDefinedFunction = TypeUtils.typeCheckFunction(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Type.ExtendedTypeKind.RecordType}`, () => {
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
            const actual: CheckedDefinedRecord = TypeUtils.typeCheckRecord(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Type.ExtendedTypeKind.TableType}`, () => {
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
            const actual: CheckedDefinedTable = TypeUtils.typeCheckTable(valueType, schemaType);
            const expected: AbridgedChecked = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };
            expectEqual(abridgedCheckedFactory(actual), expected);
        });
    });
});
