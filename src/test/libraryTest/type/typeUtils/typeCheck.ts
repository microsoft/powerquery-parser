// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { CheckedDefinedList, CheckedInvocation } from "../../../../powerquery-parser/language/type/typeUtils";
import { Type, TypeUtils } from "../../../../powerquery-parser/language";
import { Language } from "../../../..";
import { NoOpTraceManagerInstance } from "../../../../powerquery-parser/common/trace";
import { OrderedMap } from "../../../../powerquery-parser";

interface AbridgedChecked<K = number | string> {
    readonly valid: ReadonlyArray<K>;
    readonly invalid: ReadonlyArray<K>;
    readonly extraneous: ReadonlyArray<K>;
    readonly missing: ReadonlyArray<K>;
}

function createAbridgedChecked(actual: TypeUtils.TChecked): AbridgedChecked {
    return {
        valid: actual.valid,
        invalid: [...actual.invalid.keys()],
        extraneous: actual.extraneous,
        missing: actual.missing,
    };
}

function assertAbridgedEqual(actual: AbridgedChecked, expected: AbridgedChecked): void {
    expect(actual).to.deep.equal(expected);
}

const localTypeCheckInvocation: (
    args: ReadonlyArray<Type.TPowerQueryType>,
    definedFunction: Type.DefinedFunction,
) => CheckedInvocation = (args: ReadonlyArray<Type.TPowerQueryType>, definedFunction: Type.DefinedFunction) =>
    TypeUtils.typeCheckInvocation(args, definedFunction, NoOpTraceManagerInstance, undefined);

const localTypeCheckListWithDefinedListType: (
    valueType: Type.DefinedList,
    schemaType: Type.DefinedListType,
) => CheckedDefinedList = (valueType: Type.DefinedList, schemaType: Type.DefinedListType) =>
    TypeUtils.typeCheckListWithDefinedListType(valueType, schemaType, NoOpTraceManagerInstance, undefined);

const localTypeCheckListWithListType: (valueType: Type.DefinedList, schemaType: Type.ListType) => CheckedDefinedList = (
    valueType: Type.DefinedList,
    schemaType: Type.ListType,
) => TypeUtils.typeCheckListWithListType(valueType, schemaType, NoOpTraceManagerInstance, undefined);

describe(`TypeUtils.typeCheck`, () => {
    describe(`typeCheckInvocation`, () => {
        it(`extraneous parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [Language.Type.ActionInstance];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
                false,
                [],
                Language.Type.ActionInstance,
            );

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: new Map(),
                extraneous: [0],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`missing required parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: new Map(),
                extraneous: [],
                missing: [0],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`missing optional parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: new Map(),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`maybeType === null translates to any`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [Language.Type.NumberInstance];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
                false,
                [
                    {
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: new Map(),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`paramter.maybeType === any allows any type`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [Language.Type.NumberInstance];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Any,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: new Map(),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`an any argument allowed for non-any parameters`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [Language.Type.AnyInstance];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
                false,
                [
                    {
                        isNullable: false,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Text,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: new Map(),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`valid parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [TypeUtils.createNumberLiteral(false, 1)];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: new Map(),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`valid multiple parameters`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [
                TypeUtils.createNumberLiteral(false, 1),
                TypeUtils.createTextLiteral(false, `"cat"`),
            ];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [0, 1],
                invalid: new Map(),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`invalid parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [TypeUtils.createTextLiteral(false, `""`)];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: new Map([
                    [
                        0,
                        {
                            actual: args[0],
                            expected: definedFunction.parameters[0],
                        },
                    ],
                ]),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`allow null for nullable parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [Language.Type.NullInstance];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
                false,
                [
                    {
                        isNullable: true,
                        isOptional: false,
                        maybeType: Language.Type.TypeKind.Number,
                        nameLiteral: "foo",
                    },
                ],
                Language.Type.ActionInstance,
            );

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [0],
                invalid: new Map(),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`disallow null for non-nullable parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [Language.Type.NullInstance];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: new Map([[0, { actual: args[0], expected: definedFunction.parameters[0] }]]),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`disallow nullable for non-nullable parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [Language.Type.NullableTextInstance];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: new Map([[0, { actual: args[0], expected: definedFunction.parameters[0] }]]),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });

        it(`invalid multiple parameter`, () => {
            const args: ReadonlyArray<Language.Type.TPowerQueryType> = [
                Language.Type.LogicalInstance,
                Language.Type.FunctionInstance,
            ];

            const definedFunction: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
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

            const actual: TypeUtils.CheckedInvocation = localTypeCheckInvocation(args, definedFunction);

            const expected: TypeUtils.CheckedInvocation = {
                valid: [],
                invalid: new Map([
                    [
                        0,
                        {
                            actual: args[0],
                            expected: definedFunction.parameters[0],
                        },
                    ],
                    [
                        1,
                        {
                            actual: args[1],
                            expected: definedFunction.parameters[1],
                        },
                    ],
                ]),
                extraneous: [],
                missing: [],
            };

            expect(actual).to.deep.equal(expected);
        });
    });

    describe(`Table.RenameColumns`, () => {
        it(`list with two text elements, valid`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`list with two text elements, invalid`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [2],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`list of list with two text elements, valid single list`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            ]);

            const schemaType: Language.Type.ListType = TypeUtils.createListType(
                false,
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`list of list with two text elements, valid multiple list`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            ]);

            const schemaType: Language.Type.ListType = TypeUtils.createListType(
                false,
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0, 1, 2, 3],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`list of list with two text elements, empty list`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, []);

            const schemaType: Language.Type.ListType = TypeUtils.createListType(
                false,
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`list of list with two text elements, invalid single list`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                TypeUtils.createDefinedList(false, [Language.Type.NumberInstance, Language.Type.TextInstance]),
            ]);

            const schemaType: Language.Type.ListType = TypeUtils.createListType(
                false,
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [],
                invalid: [0],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`list of list with two text elements, invalid multiple list`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.NumberInstance]),
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            ]);

            const schemaType: Language.Type.ListType = TypeUtils.createListType(
                false,
                TypeUtils.createDefinedList(false, [Language.Type.TextInstance, Language.Type.TextInstance]),
            );

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0, 2, 3],
                invalid: [1],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.DefinedListType}`, () => {
        it(`valid`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`invalid`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.DateInstance,
            ]);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [1],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`extraneous`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [1],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`missing`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, []);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0, 1],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.ListType}`, () => {
        it(`valid`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.TextInstance,
            ]);

            const schemaType: Language.Type.ListType = TypeUtils.createListType(false, Language.Type.TextInstance);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0, 1],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`invalid`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.DateInstance,
            ]);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [1],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`extraneous`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [0],
                invalid: [],
                extraneous: [1],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });

        it(`missing`, () => {
            const valueType: Language.Type.DefinedList = TypeUtils.createDefinedList(false, []);

            const schemaType: Language.Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                Language.Type.TextInstance,
                Language.Type.NumberInstance,
            ]);

            const actual: TypeUtils.CheckedDefinedList = localTypeCheckListWithDefinedListType(valueType, schemaType);

            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [0, 1],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.FunctionType}`, () => {
        it(`return type`, () => {
            const valueType: Language.Type.DefinedFunction = TypeUtils.createDefinedFunction(
                false,
                [],
                Language.Type.NullableTextInstance,
            );

            const schemaType: Language.Type.FunctionType = TypeUtils.createFunctionType(
                false,
                [],
                Language.Type.NullableTextInstance,
            );

            const actual: TypeUtils.CheckedDefinedFunction = TypeUtils.typeCheckFunction(
                valueType,
                schemaType,
                NoOpTraceManagerInstance,
                undefined,
            );

            const expected: AbridgedChecked = {
                valid: [],
                invalid: [],
                extraneous: [],
                missing: [],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.RecordType}`, () => {
        it(`${Language.Type.ExtendedTypeKind.DefinedRecord}`, () => {
            const valueType: Language.Type.DefinedRecord = TypeUtils.createDefinedRecord(
                false,
                new Map<string, Language.Type.TPowerQueryType>([
                    ["number", Language.Type.NullableNumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["table", Language.Type.TableInstance],
                ]),
                false,
            );

            const schemaType: Language.Type.RecordType = TypeUtils.createRecordType(
                false,
                new Map<string, Language.Type.TPowerQueryType>([
                    ["number", Language.Type.NumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["text", Language.Type.TextInstance],
                ]),
                false,
            );

            const actual: TypeUtils.CheckedDefinedRecord = TypeUtils.typeCheckRecord(
                valueType,
                schemaType,
                NoOpTraceManagerInstance,
                undefined,
            );

            const expected: AbridgedChecked = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });
    });

    describe(`${Language.Type.ExtendedTypeKind.TableType}`, () => {
        it(`${Language.Type.ExtendedTypeKind.DefinedTable}`, () => {
            const valueType: Language.Type.DefinedTable = TypeUtils.createDefinedTable(
                false,
                new OrderedMap<string, Language.Type.TPowerQueryType>([
                    ["number", Language.Type.NullableNumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["table", Language.Type.TableInstance],
                ]),
                false,
            );

            const schemaType: Language.Type.TableType = TypeUtils.createTableType(
                false,
                new Map<string, Language.Type.TPowerQueryType>([
                    ["number", Language.Type.NumberInstance],
                    ["nullableNumber", Language.Type.NullableNumberInstance],
                    ["text", Language.Type.TextInstance],
                ]),
                false,
            );

            const actual: TypeUtils.CheckedDefinedTable = TypeUtils.typeCheckTable(
                valueType,
                schemaType,
                NoOpTraceManagerInstance,
                undefined,
            );

            const expected: AbridgedChecked = {
                valid: ["nullableNumber"],
                invalid: ["number"],
                extraneous: ["table"],
                missing: ["text"],
            };

            assertAbridgedEqual(createAbridgedChecked(actual), expected);
        });
    });
});
