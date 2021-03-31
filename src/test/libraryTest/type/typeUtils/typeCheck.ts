// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Language } from "../../../..";

interface AbridgedChecked<K = number | string> {
    readonly valid: ReadonlyArray<K>;
    readonly invalid: ReadonlyArray<K>;
    readonly extraneous: ReadonlyArray<K>;
    readonly missing: ReadonlyArray<K>;
}

function abridgedCheckedFactory(actual: Language.TypeUtils.TChecked): AbridgedChecked {
    const mismatched: ReadonlyArray<Language.TypeUtils.Mismatch<
        string | number,
        Language.Type.PqType | Language.Type.FunctionParameter,
        Language.Type.PqType | Language.Type.FunctionParameter
    >> = actual.invalid;
    return {
        valid: actual.valid,
        invalid: mismatched.map(mismatch => mismatch.key),
        extraneous: actual.extraneous,
        missing: actual.missing,
    };
}

function assertAbridgedEqual(actual: AbridgedChecked, expected: AbridgedChecked): void {
    expect(actual.valid).to.have.members(expected.valid, "mismatch on valid");
    expect(actual.invalid).to.have.members(expected.invalid, "mismatch on invalid");
    expect(actual.extraneous).to.have.members(expected.extraneous, "mismatch on extraneous");
    expect(actual.missing).to.have.members(expected.missing, "mismatch on missing");
}

describe(`TypeUtils.typeCheck`, () => {
    describe(`typeCheckInvocation`, () => {
        it(`extraneous parameter`, () => {
            const args: ReadonlyArray<Language.Type.PqType> = [Language.Type.ActionInstance];
            const definedFunction: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [],
                Language.Type.ActionInstance,
            );
            const actual: Language.TypeUtils.CheckedInvocation = Language.TypeUtils.typeCheckInvocation(
                args,
                definedFunction,
            );
            const expected: Language.TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: [],
                extraneous: [0],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`missing required parameter`, () => {
            const args: ReadonlyArray<Language.Type.PqType> = [];
            const definedFunction: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Number,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );
            const actual: Language.TypeUtils.CheckedInvocation = Language.TypeUtils.typeCheckInvocation(
                args,
                definedFunction,
            );
            const expected: Language.TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`missing optional parameter`, () => {
            const args: ReadonlyArray<Language.Type.PqType> = [];
            const definedFunction: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: true,
                        maybeType: Language.Type.TypeKind.Number,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );
            const actual: Language.TypeUtils.CheckedInvocation = Language.TypeUtils.typeCheckInvocation(
                args,
                definedFunction,
            );
            const expected: Language.TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`valid parameter`, () => {
            const args: ReadonlyArray<Language.Type.PqType> = [Language.TypeUtils.numberLiteralFactory(false, "1")];
            const definedFunction: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Number,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );
            const actual: Language.TypeUtils.CheckedInvocation = Language.TypeUtils.typeCheckInvocation(
                args,
                definedFunction,
            );
            const expected: Language.TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`valid multiple parameters`, () => {
            const args: ReadonlyArray<Language.Type.PqType> = [
                Language.TypeUtils.numberLiteralFactory(false, "1"),
                Language.TypeUtils.textLiteralFactory(false, `"cat"`),
            ];
            const definedFunction: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Number,
                        nameLiteral: "foo",
                    },
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Text,
                        nameLiteral: "bar",
                    },
                ],
                Language.Type.ActionInstance,
            );
            const actual: Language.TypeUtils.CheckedInvocation = Language.TypeUtils.typeCheckInvocation(
                args,
                definedFunction,
            );
            const expected: Language.TypeUtils.CheckedInvocation = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`invalid parameter`, () => {
            const args: ReadonlyArray<Language.Type.PqType> = [Language.TypeUtils.textLiteralFactory(false, `""`)];
            const definedFunction: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Number,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );
            const actual: Language.TypeUtils.CheckedInvocation = Language.TypeUtils.typeCheckInvocation(
                args,
                definedFunction,
            );
            const expected: Language.TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: [
                    {
                        key: 0,
                        actual: args[0],
                        expected: definedFunction.parameters[0],
                    },
                ],
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`invalid multiple parameter`, () => {
            const args: ReadonlyArray<Language.Type.PqType> = [
                Language.Type.LogicalInstance,
                Language.Type.FunctionInstance,
            ];
            const definedFunction: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Number,
                        nameLiteral: "foo",
                    },
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Text,
                        nameLiteral: "bar",
                    },
                ],
                Language.Type.ActionInstance,
            );
            const actual: Language.TypeUtils.CheckedInvocation = Language.TypeUtils.typeCheckInvocation(
                args,
                definedFunction,
            );
            const expected: Language.TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: [
                    {
                        key: 0,
                        actual: args[0],
                        expected: definedFunction.parameters[0],
                    },
                    {
                        key: 1,
                        actual: args[1],
                        expected: definedFunction.parameters[1],
                    },
                ],
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });
    });

    describe(`Table.RenameColumns`, () => {
        it(`list with two text elements, valid`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list with two text elements, invalid`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [2],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, valid single list`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            ]);
            const schemaType: Language.Type.ListType = Language.TypeUtils.listTypeFactory(
                false,
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, valid multiple list`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            ]);
            const schemaType: Language.Type.ListType = Language.TypeUtils.listTypeFactory(
                false,
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0, 1, 2, 3],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, empty list`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, []);
            const schemaType: Language.Type.ListType = Language.TypeUtils.listTypeFactory(
                false,
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, invalid single list`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.TypeUtils.definedListFactory(false, [
                    Language.Type.NumberInstance,
                    Language.Type.TextInstance,
                ]),
            ]);
            const schemaType: Language.Type.ListType = Language.TypeUtils.listTypeFactory(
                false,
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [0],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`list of list with two text elements, invalid multiple list`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                Language.TypeUtils.definedListFactory(false, [
                    Language.Type.TextInstance,
                    Language.Type.NumberInstance,
                ]),
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            ]);
            const schemaType: Language.Type.ListType = Language.TypeUtils.listTypeFactory(
                false,
                Language.TypeUtils.definedListFactory(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0, 2, 3],
                invalid: [1],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.DefinedListType}`, () => {
        it(`valid`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`invalid`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.DateInstance,
            ]);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [1],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`extraneous`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [1],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`missing`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, []);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0, 1],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.ListType}`, () => {
        it(`valid`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);
            const schemaType: Language.Type.ListType = Language.TypeUtils.listTypeFactory(
                false,
                Language.Type.TextInstance,
            );
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`invalid`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.DateInstance,
            ]);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [1],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`extraneous`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [1],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });

        it(`missing`, () => {
            const valueType: Language.Type.DefinedList = Language.TypeUtils.definedListFactory(false, []);
            const schemaType: Language.Type.DefinedListType = Language.TypeUtils.definedListTypeFactory(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);
            const actual: Language.TypeUtils.CheckedDefinedList = Language.TypeUtils.typeCheckListWithDefinedListType(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0, 1],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.FunctionType}`, () => {
        it(`return type`, () => {
            const valueType: Language.Type.DefinedFunction = Language.TypeUtils.definedFunctionFactory(
                false,
                [],
                Language.Type.NullableTextInstance,
            );
            const schemaType: Language.Type.FunctionType = Language.TypeUtils.functionTypeFactory(
                false,
                [],
                Language.Type.NullableTextInstance,
            );
            const actual: Language.TypeUtils.CheckedDefinedFunction = Language.TypeUtils.typeCheckFunction(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.RecordType}`, () => {
        it(`${Language.Type.ExtendedTypeKind.DefinedRecord}`, () => {
            const valueType: Language.Type.DefinedRecord = Language.TypeUtils.definedRecordFactory(
                false,
                new Map<string, Language.Type.PqType>([
                    ["number", Language.Type.NullableNumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["table", Language.Type.TableInstance],
                ]),
                false,
            );
            const schemaType: Language.Type.RecordType = Language.TypeUtils.recordTypeFactory(
                false,
                new Map<string, Language.Type.PqType>([
                    ["number", Language.Type.NumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["text", Language.Type.TextInstance],
                ]),
                false,
            );
            const actual: Language.TypeUtils.CheckedDefinedRecord = Language.TypeUtils.typeCheckRecord(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.TableType}`, () => {
        it(`${Language.Type.ExtendedTypeKind.DefinedTable}`, () => {
            const valueType: Language.Type.DefinedTable = Language.TypeUtils.definedTableFactory(
                false,
                new Map<string, Language.Type.PqType>([
                    ["number", Language.Type.NullableNumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["table", Language.Type.TableInstance],
                ]),
                false,
            );
            const schemaType: Language.Type.TableType = Language.TypeUtils.tableTypeFactory(
                false,
                new Map<string, Language.Type.PqType>([
                    ["number", Language.Type.NumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["text", Language.Type.TextInstance],
                ]),
                false,
            );
            const actual: Language.TypeUtils.CheckedDefinedTable = Language.TypeUtils.typeCheckTable(
                valueType,
                schemaType,
            );
            const expected: AbridgedChecked = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };
            assertAbridgedEqual(abridgedCheckedFactory(actual), expected);
        });
    });
});
