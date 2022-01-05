// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Type, TypeUtils } from "../../../../powerquery-parser/language";
import { OrderedMap } from "../../../../powerquery-parser";

describe(`TypeUtils.nameOf`, () => {
    describe(`non extended`, () => {
        describe("non-nullable", () => {
            it(`${Type.ActionInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.ActionInstance)).to.equal("action");
            });

            it(`${Type.AnyInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.AnyInstance)).to.equal("any");
            });

            it(`${Type.AnyNonNullInstance.kind}`, () => {
                // tslint:disable-next-line: chai-vague-errors
                expect(TypeUtils.nameOf(Type.AnyNonNullInstance)).to.equal("anynonnull");
            });

            it(`${Type.BinaryInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.BinaryInstance)).to.equal("binary");
            });

            it(`${Type.DateInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.DateInstance)).to.equal("date");
            });

            it(`${Type.DateTimeInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.DateTimeInstance)).to.equal("datetime");
            });

            it(`${Type.DateTimeZoneInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.DateTimeZoneInstance)).to.equal("datetimezone");
            });

            it(`${Type.DurationInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.DurationInstance)).to.equal("duration");
            });

            it(`${Type.FunctionInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.FunctionInstance)).to.equal("function");
            });

            it(`${Type.ListInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.ListInstance)).to.equal("list");
            });

            it(`${Type.LogicalInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.LogicalInstance)).to.equal("logical");
            });

            it(`${Type.LogicalInstance.kind} literal`, () => {
                // tslint:disable-next-line: chai-vague-errors
                expect(TypeUtils.nameOf(Type.TrueInstance)).to.equal("true");
            });

            it(`${Type.NoneInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.NoneInstance)).to.equal("none");
            });

            it(`${Type.NotApplicableInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.NotApplicableInstance)).to.equal("not applicable");
            });

            it(`${Type.NullInstance.kind}`, () => {
                // tslint:disable-next-line: chai-vague-errors
                expect(TypeUtils.nameOf(Type.NullInstance)).to.equal("null");
            });

            it(`${Type.NumberInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.NumberInstance)).to.equal("number");
            });

            it(`${Type.NumberInstance.kind} literal`, () => {
                expect(TypeUtils.nameOf(TypeUtils.createNumberLiteral(false, 1))).to.equal("1");
            });

            it(`${Type.RecordInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.RecordInstance)).to.equal("record");
            });

            it(`${Type.TableInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.TableInstance)).to.equal("table");
            });

            it(`${Type.TextInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.TextInstance)).to.equal("text");
            });

            it(`${Type.TextInstance.kind} literal`, () => {
                expect(TypeUtils.nameOf(TypeUtils.createTextLiteral(false, `"foo"`))).to.equal(`"foo"`);
            });

            it(`${Type.TimeInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.TimeInstance)).to.equal("time");
            });

            it(`${Type.TypePrimitiveInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.TypePrimitiveInstance)).to.equal("type");
            });

            it(`${Type.UnknownInstance.kind}`, () => {
                expect(TypeUtils.nameOf(Type.UnknownInstance)).to.equal("unknown");
            });
        });

        describe("nullable", () => {
            it(`${Type.NullableActionInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableActionInstance);
                expect(actual).to.equal("nullable action", undefined);
            });

            it(`${Type.NullableAnyInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableAnyInstance);
                expect(actual).to.equal("nullable any", undefined);
            });

            // anynonnull can't be nullable
            it(`${Type.NullableBinaryInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableBinaryInstance);
                expect(actual).to.equal("nullable binary", undefined);
            });

            it(`${Type.NullableDateInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableDateInstance);
                expect(actual).to.equal("nullable date", undefined);
            });

            it(`${Type.NullableDateTimeInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableDateTimeInstance);
                expect(actual).to.equal("nullable datetime", undefined);
            });

            it(`${Type.NullableDateTimeZoneInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableDateTimeZoneInstance);
                expect(actual).to.equal("nullable datetimezone", undefined);
            });

            it(`${Type.NullableDurationInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableDurationInstance);
                expect(actual).to.equal("nullable duration", undefined);
            });

            it(`${Type.NullableFunctionInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableFunctionInstance);
                expect(actual).to.equal("nullable function", undefined);
            });

            it(`${Type.NullableListInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableListInstance);
                expect(actual).to.equal("nullable list", undefined);
            });

            it(`${Type.NullableLogicalInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableLogicalInstance);
                expect(actual).to.equal("nullable logical", undefined);
            });

            it(`${Type.NullableNoneInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableNoneInstance);
                expect(actual).to.equal("nullable none", undefined);
            });

            it(`${Type.NullableNotApplicableInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableNotApplicableInstance);
                expect(actual).to.equal("nullable not applicable", undefined);
            });

            it(`${Type.NullableNumberInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableNumberInstance);
                expect(actual).to.equal("nullable number", undefined);
            });

            it(`${Type.NullableNumberInstance.kind} literal`, () => {
                const actual: string = TypeUtils.nameOf(TypeUtils.createNumberLiteral(true, `1`));
                expect(actual).to.equal(`nullable 1`, undefined);
            });

            it(`${Type.NullableRecordInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableRecordInstance);
                expect(actual).to.equal("nullable record", undefined);
            });

            it(`${Type.NullableTableInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableTableInstance);
                expect(actual).to.equal("nullable table", undefined);
            });

            it(`${Type.TextInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableTextInstance);
                expect(actual).to.equal("nullable text", undefined);
            });

            it(`${Type.TextInstance.kind} literal`, () => {
                const actual: string = TypeUtils.nameOf(TypeUtils.createTextLiteral(true, `"foo"`));
                expect(actual).to.equal(`nullable "foo"`, undefined);
            });

            it(`${Type.NullableTimeInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableTimeInstance);
                expect(actual).to.equal("nullable time", undefined);
            });

            it(`${Type.NullableTypeInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableTypeInstance);
                expect(actual).to.equal("nullable type", undefined);
            });

            it(`${Type.NullableUnknownInstance.kind}`, () => {
                const actual: string = TypeUtils.nameOf(Type.NullableUnknownInstance);
                expect(actual).to.equal("nullable unknown", undefined);
            });
        });
    });

    describe(`extended`, () => {
        describe(`${Type.ExtendedTypeKind.AnyUnion}`, () => {
            it(`primitives`, () => {
                const type: Type.TPowerQueryType = TypeUtils.createAnyUnion([Type.NumberInstance, Type.ListInstance]);
                expect(TypeUtils.nameOf(type)).to.equal(`list | number`);
            });

            it(`complex`, () => {
                const type: Type.TPowerQueryType = TypeUtils.createAnyUnion([
                    TypeUtils.createDefinedRecord(false, new Map([[`foo`, Type.NumberInstance]]), false),
                    TypeUtils.createDefinedList(false, [Type.TextInstance]),
                    TypeUtils.createDefinedTable(false, new OrderedMap([[`bar`, Type.TextInstance]]), true),
                ]);

                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`{text} | [foo: number] | table [bar: text, ...]`);
            });
        });

        describe(`${Type.ExtendedTypeKind.DefinedFunction}`, () => {
            it(`() => any`, () => {
                const type: Type.DefinedFunction = TypeUtils.createDefinedFunction(false, [], Type.AnyInstance);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`() => any`);
            });

            it(`() => nullable any`, () => {
                const type: Type.DefinedFunction = TypeUtils.createDefinedFunction(false, [], Type.NullableAnyInstance);
                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`() => nullable any`, undefined);
            });

            it(`(x, optional y) => 1`, () => {
                const type: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                    false,
                    [
                        {
                            isNullable: false,
                            isOptional: false,
                            maybeType: undefined,
                            nameLiteral: "x",
                        },
                        {
                            isNullable: false,
                            isOptional: true,
                            maybeType: undefined,
                            nameLiteral: "y",
                        },
                    ],
                    TypeUtils.createNumberLiteral(false, 1),
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`(x: any, y: optional any) => 1`, undefined);
            });

            it(`(param1 as number, param2 as nullable number, optional param3 as number, optional param4 as nullable number) => any`, () => {
                const type: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                    false,
                    [
                        {
                            isNullable: false,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param1",
                        },
                        {
                            isNullable: true,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param2",
                        },
                        {
                            isNullable: false,
                            isOptional: true,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param3",
                        },
                        {
                            isNullable: true,
                            isOptional: true,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param4",
                        },
                    ],
                    Type.AnyInstance,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(
                    `(param1: number, param2: nullable number, param3: optional number, param4: optional nullable number) => any`,
                    undefined,
                );
            });
        });

        describe(`${Type.ExtendedTypeKind.DefinedList}`, () => {
            it(`{}`, () => {
                const type: Type.DefinedList = TypeUtils.createDefinedList(false, []);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`{}`);
            });

            it(`nullable {}`, () => {
                const type: Type.DefinedList = TypeUtils.createDefinedList(true, []);
                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`nullable {}`, undefined);
            });

            it(`{number, nullable text}`, () => {
                const type: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    Type.NumberInstance,
                    Type.NullableTextInstance,
                ]);

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`{number, nullable text}`, undefined);
            });
        });

        describe(`${Type.ExtendedTypeKind.DefinedListType}`, () => {
            it(`type {}`, () => {
                const type: Type.DefinedListType = TypeUtils.createDefinedListType(false, []);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type {}`);
            });

            it(`nullable type {}`, () => {
                const type: Type.DefinedListType = TypeUtils.createDefinedListType(true, []);
                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`nullable type {}`, undefined);
            });

            it(`type {number, nullable text}`, () => {
                const type: Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                    Type.NumberInstance,
                    Type.NullableTextInstance,
                ]);

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`type {number, nullable text}`, undefined);
            });
        });

        describe(`${Type.ExtendedTypeKind.DefinedRecord}`, () => {
            it(`[]`, () => {
                const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), false);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`[]`);
            });

            it(`[...]`, () => {
                const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), true);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`[...]`);
            });

            it(`[foo = number, bar = nullable text]`, () => {
                const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    false,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`[foo: number, bar: nullable text]`, undefined);
            });

            it(`[foo = number, bar = nullable text, ...]`, () => {
                const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    true,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`[foo: number, bar: nullable text, ...]`, undefined);
            });
        });

        describe(`${Type.ExtendedTypeKind.DefinedTable}`, () => {
            it(`table []`, () => {
                const type: Type.DefinedTable = TypeUtils.createDefinedTable(false, new OrderedMap(), false);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`table []`);
            });

            it(`table [...]`, () => {
                const type: Type.DefinedTable = TypeUtils.createDefinedTable(false, new OrderedMap(), true);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`table [...]`);
            });

            it(`table [foo = number, bar = nullable text]`, () => {
                const type: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    false,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`table [foo: number, bar: nullable text]`, undefined);
            });

            it(`table [foo = number, bar = nullable text, ...]`, () => {
                const type: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    true,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`table [foo: number, bar: nullable text, ...]`, undefined);
            });

            it(`table [#"foo" = number, #"space space"]`, () => {
                const type: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`#"space space"`, Type.NullableTextInstance],
                    ]),
                    false,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`table [foo: number, #"space space": nullable text]`, undefined);
            });
        });

        describe(`${Type.ExtendedTypeKind.FunctionType}`, () => {
            it(`type function () any`, () => {
                const type: Type.FunctionType = TypeUtils.createFunctionType(false, [], Type.AnyInstance);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type function () any`);
            });

            it(`type function () any`, () => {
                const type: Type.FunctionType = TypeUtils.createFunctionType(
                    false,
                    [
                        {
                            isNullable: false,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param1",
                        },
                        {
                            isNullable: true,
                            isOptional: false,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param2",
                        },
                        {
                            isNullable: false,
                            isOptional: true,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param3",
                        },
                        {
                            isNullable: true,
                            isOptional: true,
                            maybeType: Type.TypeKind.Number,
                            nameLiteral: "param4",
                        },
                    ],
                    Type.AnyInstance,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(
                    `type function (param1: number, param2: nullable number, param3: optional number, param4: optional nullable number) any`,
                    undefined,
                );
            });
        });

        describe(`${Type.ExtendedTypeKind.ListType}`, () => {
            it(`type {text}`, () => {
                const type: Type.ListType = TypeUtils.createListType(false, Type.TextInstance);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type {text}`);
            });
        });

        describe(`${Type.ExtendedTypeKind.PrimaryPrimitiveType}`, () => {
            it(`type text`, () => {
                const type: Type.PrimaryPrimitiveType = TypeUtils.createPrimaryPrimitiveType(false, Type.TextInstance);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type text`);
            });
        });

        describe(`${Type.ExtendedTypeKind.RecordType}`, () => {
            it(`type [foo = number]`, () => {
                const type: Type.RecordType = TypeUtils.createRecordType(
                    false,
                    new Map([[`foo`, Type.NumberInstance]]),
                    false,
                );

                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type [foo: number]`);
            });

            it(`type [...]`, () => {
                const type: Type.RecordType = TypeUtils.createRecordType(false, new Map(), true);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type [...]`);
            });

            it(`type [foo = number, bar = nullable text]`, () => {
                const type: Type.RecordType = TypeUtils.createRecordType(
                    false,
                    new Map<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    false,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`type [foo: number, bar: nullable text]`, undefined);
            });

            it(`type [foo = number, bar = nullable text, ...]`, () => {
                const type: Type.RecordType = TypeUtils.createRecordType(
                    false,
                    new Map<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    true,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`type [foo: number, bar: nullable text, ...]`, undefined);
            });
        });

        describe(`${Type.ExtendedTypeKind.TableType}`, () => {
            it(`type table [foo = number]`, () => {
                const type: Type.TableType = TypeUtils.createTableType(
                    false,
                    new Map([[`foo`, Type.NumberInstance]]),
                    false,
                );

                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type table [foo: number]`);
            });

            it(`type table [...]`, () => {
                const type: Type.TableType = TypeUtils.createTableType(false, new Map(), true);
                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type table [...]`);
            });

            it(`type table [foo = number, bar = nullable text]`, () => {
                const type: Type.TableType = TypeUtils.createTableType(
                    false,
                    new Map<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    false,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`type table [foo: number, bar: nullable text]`, undefined);
            });

            it(`type table [foo = number, bar = nullable text, ...]`, () => {
                const type: Type.TableType = TypeUtils.createTableType(
                    false,
                    new Map<string, Type.TPowerQueryType>([
                        [`foo`, Type.NumberInstance],
                        [`bar`, Type.NullableTextInstance],
                    ]),
                    true,
                );

                const actual: string = TypeUtils.nameOf(type);

                expect(actual).to.equal(`type table [foo: number, bar: nullable text, ...]`, undefined);
            });
        });

        describe(`${Type.ExtendedTypeKind.TableTypePrimaryExpression}`, () => {
            // Assumes `foo` is text.
            it(`type table foo`, () => {
                const type: Type.TableTypePrimaryExpression = TypeUtils.createTableTypePrimary(
                    false,
                    Type.TextInstance,
                );

                const actual: string = TypeUtils.nameOf(type);
                expect(actual).to.equal(`type table text`);
            });
        });
    });
});
