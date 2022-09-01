// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Type, TypeUtils } from "../../../../powerquery-parser/language";
import { NoOpTraceManagerInstance } from "../../../../powerquery-parser/common/trace";
import { OrderedMap } from "../../../../powerquery-parser";

interface AbridgedType {
    readonly kind: Type.TypeKind;
    readonly extendedKind: Type.ExtendedTypeKind | undefined;
    readonly isNullable: boolean;
}

function abridgedPrimitiveType(kind: Type.TypeKind, isNullable: boolean): AbridgedType {
    return {
        kind,
        extendedKind: undefined,
        isNullable,
    };
}

function typeToAbridged(type: Type.TPowerQueryType): AbridgedType {
    return {
        kind: type.kind,
        extendedKind: type.extendedKind,
        isNullable: type.isNullable,
    };
}

function createAbridgedTypes(types: ReadonlyArray<Type.TPowerQueryType>): ReadonlyArray<AbridgedType> {
    return types.map(typeToAbridged);
}

const noopCreateAnyUnion: (types: ReadonlyArray<Type.TPowerQueryType>) => Type.TPowerQueryType = (
    types: ReadonlyArray<Type.TPowerQueryType>,
) => TypeUtils.createAnyUnion(types, NoOpTraceManagerInstance, undefined);

const noopNameOf: (type: Type.TPowerQueryType) => string = (type: Type.TPowerQueryType) =>
    TypeUtils.nameOf(type, NoOpTraceManagerInstance, undefined);

const noopSimplify: (types: ReadonlyArray<Type.TPowerQueryType>) => ReadonlyArray<Type.TPowerQueryType> = (
    types: ReadonlyArray<Type.TPowerQueryType>,
) => TypeUtils.simplify(types, NoOpTraceManagerInstance, undefined);

describe(`TypeUtils`, () => {
    describe(`simplify`, () => {
        it(`generic, identical nullability should reduce to single type`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.RecordInstance, Type.RecordInstance]),
            );

            const expected: ReadonlyArray<AbridgedType> = [abridgedPrimitiveType(Type.TypeKind.Record, false)];

            expect(actual.length).to.equal(1);
            expect(actual).deep.equal(expected);
        });

        it(`generic, mixed nullability should reduce to nullable`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.RecordInstance, Type.NullableRecordInstance]),
            );

            const expected: ReadonlyArray<AbridgedType> = [abridgedPrimitiveType(Type.TypeKind.Record, true)];

            expect(actual.length).to.equal(1);
            expect(actual).deep.equal(expected);
        });

        it(`early return with Any primitive`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.AnyInstance, Type.NullableRecordInstance]),
            );

            const expected: ReadonlyArray<AbridgedType> = [Type.AnyInstance];
            expect(actual).deep.equal(expected);
        });

        it(`simplify literal and primitive to primitive`, () => {
            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(
                noopSimplify([Type.NumberInstance, TypeUtils.createNumberLiteral(false, 1)]),
            );

            const expected: ReadonlyArray<AbridgedType> = [Type.NumberInstance];
            expect(actual).deep.equal(expected);
        });

        it(`retain multiple unique literals`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([
                TypeUtils.createNumberLiteral(false, 1),
                TypeUtils.createNumberLiteral(false, 2),
            ]);

            const expected: ReadonlyArray<AbridgedType> = [
                TypeUtils.createNumberLiteral(false, 1),
                TypeUtils.createNumberLiteral(false, 2),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`simplify true | false to boolean`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([Type.FalseInstance, Type.TrueInstance]);
            const expected: ReadonlyArray<AbridgedType> = [Type.LogicalInstance];
            expect(actual).deep.equal(expected);
        });

        it(`prefer nullable in boolean simplification`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([
                Type.FalseInstance,
                Type.TrueInstance,
                Type.NullableFalseInstance,
                Type.NullableTrueInstance,
            ]);

            const expected: ReadonlyArray<AbridgedType> = [Type.NullableLogicalInstance];
            expect(actual).deep.equal(expected);
        });

        it(`dedupe duplicate literals`, () => {
            const actual: ReadonlyArray<AbridgedType> = noopSimplify([
                TypeUtils.createNumberLiteral(false, 1),
                TypeUtils.createNumberLiteral(false, 1),
            ]);

            const expected: ReadonlyArray<AbridgedType> = [TypeUtils.createNumberLiteral(false, 1)];
            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single primitive type`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.RecordInstance, Type.RecordInstance]),
                noopCreateAnyUnion([Type.RecordInstance, Type.RecordInstance]),
            ]);

            expect(simplified.length).to.equal(1);

            const actual: AbridgedType = typeToAbridged(simplified[0]);
            const expected: AbridgedType = TypeUtils.createPrimitiveType(false, Type.TypeKind.Record);
            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, dedupe primitive types across AnyUnion`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.RecordInstance, Type.NullableTableInstance]),
                noopCreateAnyUnion([Type.RecordInstance, Type.NullableTableInstance]),
            ]);

            expect(simplified.length).to.equal(2);

            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(simplified);

            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, mixed nullability`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.NullableRecordInstance, Type.NullableTableInstance]),
                noopCreateAnyUnion([Type.RecordInstance, Type.TableInstance]),
            ]);

            expect(simplified.length).to.equal(4);

            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(simplified);

            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, true),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, false),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, dedupe across multi level AnyUnion`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([
                    Type.RecordInstance,
                    noopCreateAnyUnion([Type.RecordInstance, Type.NumberInstance]),
                ]),
                noopCreateAnyUnion([Type.RecordInstance]),
            ]);

            expect(simplified.length).to.equal(2);

            const actual: ReadonlyArray<AbridgedType> = createAbridgedTypes(simplified);

            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Number, false),
            ];

            expect(actual).deep.equal(expected);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, short circuit with Any primitive in AnyUnion`, () => {
            const simplified: ReadonlyArray<Type.TPowerQueryType> = noopSimplify([
                noopCreateAnyUnion([Type.RecordInstance, noopCreateAnyUnion([Type.AnyInstance, Type.NumberInstance])]),
                noopCreateAnyUnion([Type.RecordInstance]),
            ]);

            expect(simplified.length).to.equal(1);

            const actual: AbridgedType = typeToAbridged(simplified[0]);
            const expected: AbridgedType = typeToAbridged(Type.AnyInstance);
            expect(actual).deep.equal(expected);
        });
    });

    describe(`nameOf`, () => {
        describe(`non extended`, () => {
            describe("non-nullable", () => {
                it(`${Type.AnyInstance.kind}`, () => {
                    expect(noopNameOf(Type.AnyInstance)).to.equal("any");
                });

                it(`${Type.AnyNonNullInstance.kind}`, () => {
                    // tslint:disable-next-line: chai-vague-errors
                    expect(noopNameOf(Type.AnyNonNullInstance)).to.equal("anynonnull");
                });

                it(`${Type.BinaryInstance.kind}`, () => {
                    expect(noopNameOf(Type.BinaryInstance)).to.equal("binary");
                });

                it(`${Type.DateInstance.kind}`, () => {
                    expect(noopNameOf(Type.DateInstance)).to.equal("date");
                });

                it(`${Type.DateTimeInstance.kind}`, () => {
                    expect(noopNameOf(Type.DateTimeInstance)).to.equal("datetime");
                });

                it(`${Type.DateTimeZoneInstance.kind}`, () => {
                    expect(noopNameOf(Type.DateTimeZoneInstance)).to.equal("datetimezone");
                });

                it(`${Type.DurationInstance.kind}`, () => {
                    expect(noopNameOf(Type.DurationInstance)).to.equal("duration");
                });

                it(`${Type.FunctionInstance.kind}`, () => {
                    expect(noopNameOf(Type.FunctionInstance)).to.equal("function");
                });

                it(`${Type.ListInstance.kind}`, () => {
                    expect(noopNameOf(Type.ListInstance)).to.equal("list");
                });

                it(`${Type.LogicalInstance.kind}`, () => {
                    expect(noopNameOf(Type.LogicalInstance)).to.equal("logical");
                });

                it(`${Type.NoneInstance.kind}`, () => {
                    expect(noopNameOf(Type.NoneInstance)).to.equal("none");
                });

                it(`${Type.NullInstance.kind}`, () => {
                    // tslint:disable-next-line: chai-vague-errors
                    expect(noopNameOf(Type.NullInstance)).to.equal("null");
                });

                it(`${Type.NumberInstance.kind}`, () => {
                    expect(noopNameOf(Type.NumberInstance)).to.equal("number");
                });

                it(`${Type.RecordInstance.kind}`, () => {
                    expect(noopNameOf(Type.RecordInstance)).to.equal("record");
                });

                it(`${Type.TableInstance.kind}`, () => {
                    expect(noopNameOf(Type.TableInstance)).to.equal("table");
                });

                it(`${Type.TypePrimitiveInstance.kind}`, () => {
                    expect(noopNameOf(Type.TypePrimitiveInstance)).to.equal("type");
                });

                it(`${Type.ActionInstance.kind}`, () => {
                    expect(noopNameOf(Type.ActionInstance)).to.equal("action");
                });

                it(`${Type.TimeInstance.kind}`, () => {
                    expect(noopNameOf(Type.TimeInstance)).to.equal("time");
                });

                it(`${Type.NotApplicableInstance.kind}`, () => {
                    expect(noopNameOf(Type.NotApplicableInstance)).to.equal("not applicable");
                });

                it(`${Type.UnknownInstance.kind}`, () => {
                    expect(noopNameOf(Type.UnknownInstance)).to.equal("unknown");
                });
            });

            describe("nullable", () => {
                it(`${Type.NullableAnyInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableAnyInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable any");
                });

                // anynonnull can't be nullable
                it(`${Type.NullableBinaryInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableBinaryInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable binary");
                });

                it(`${Type.NullableDateInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableDateInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable date");
                });

                it(`${Type.NullableDateTimeInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableDateTimeInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable datetime");
                });

                it(`${Type.NullableDateTimeZoneInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableDateTimeZoneInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable datetimezone");
                });

                it(`${Type.NullableDurationInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableDurationInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable duration");
                });

                it(`${Type.NullableFunctionInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableFunctionInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable function");
                });

                it(`${Type.NullableListInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableListInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable list");
                });

                it(`${Type.NullableLogicalInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableLogicalInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable logical");
                });

                it(`${Type.NullableNoneInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableNoneInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable none");
                });

                it(`${Type.NullableNumberInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableNumberInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable number");
                });

                it(`${Type.NullableRecordInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableRecordInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable record");
                });

                it(`${Type.NullableTableInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableTableInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable table");
                });

                it(`${Type.NullableTypeInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableTypeInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable type");
                });

                it(`${Type.NullableActionInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableActionInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable action");
                });

                it(`${Type.NullableTimeInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableTimeInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable time");
                });

                it(`${Type.NullableNotApplicableInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableNotApplicableInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable not applicable");
                });

                it(`${Type.NullableUnknownInstance.kind}`, () => {
                    const actual: string = noopNameOf(Type.NullableUnknownInstance);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable unknown");
                });
            });
        });

        describe(`extended`, () => {
            describe(`${Type.ExtendedTypeKind.AnyUnion}`, () => {
                it(`primitives`, () => {
                    const type: Type.TPowerQueryType = noopCreateAnyUnion([Type.NumberInstance, Type.ListInstance]);

                    expect(noopNameOf(type)).to.equal(`list | number`);
                });

                it(`complex`, () => {
                    const type: Type.TPowerQueryType = noopCreateAnyUnion([
                        TypeUtils.createDefinedRecord(false, new Map([["foo", Type.NumberInstance]]), false),
                        TypeUtils.createDefinedList(false, [Type.TextInstance]),
                        TypeUtils.createDefinedTable(false, new OrderedMap([["bar", Type.TextInstance]]), true),
                    ]);

                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`{text} | [foo: number] | table [bar: text, ...]`);
                });
            });

            describe(`${Type.ExtendedTypeKind.DefinedFunction}`, () => {
                it(`() => any`, () => {
                    const type: Type.DefinedFunction = TypeUtils.createDefinedFunction(false, [], Type.AnyInstance);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`() => any`);
                });

                it(`() => nullable any`, () => {
                    const type: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                        false,
                        [],
                        Type.NullableAnyInstance,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`() => nullable any`);
                });

                it(`(param1 as number, param2 as nullable number, optional param3 as number, optional param4 as nullable number) => any`, () => {
                    const type: Type.DefinedFunction = TypeUtils.createDefinedFunction(
                        false,
                        [
                            {
                                isNullable: false,
                                isOptional: false,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param1",
                            },
                            {
                                isNullable: true,
                                isOptional: false,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param2",
                            },
                            {
                                isNullable: false,
                                isOptional: true,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param3",
                            },
                            {
                                isNullable: true,
                                isOptional: true,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param4",
                            },
                        ],
                        Type.AnyInstance,
                    );

                    const actual: string = noopNameOf(type);

                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(
                        `(param1: number, param2: nullable number, param3: optional number, param4: optional nullable number) => any`,
                    );
                });
            });

            describe(`${Type.ExtendedTypeKind.DefinedList}`, () => {
                it(`{}`, () => {
                    const type: Type.DefinedList = TypeUtils.createDefinedList(false, []);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`{}`);
                });

                it(`nullable {}`, () => {
                    const type: Type.DefinedList = TypeUtils.createDefinedList(true, []);
                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`nullable {}`);
                });

                it(`{number, nullable text}`, () => {
                    const type: Type.DefinedList = TypeUtils.createDefinedList(false, [
                        Type.NumberInstance,
                        Type.NullableTextInstance,
                    ]);

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`{number, nullable text}`);
                });
            });

            describe(`${Type.ExtendedTypeKind.DefinedListType}`, () => {
                it(`type {}`, () => {
                    const type: Type.DefinedListType = TypeUtils.createDefinedListType(false, []);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type {}`);
                });

                it(`nullable type {}`, () => {
                    const type: Type.DefinedListType = TypeUtils.createDefinedListType(true, []);
                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`nullable type {}`);
                });

                it(`type {number, nullable text}`, () => {
                    const type: Type.DefinedListType = TypeUtils.createDefinedListType(false, [
                        Type.NumberInstance,
                        Type.NullableTextInstance,
                    ]);

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`type {number, nullable text}`);
                });
            });

            describe(`${Type.ExtendedTypeKind.DefinedRecord}`, () => {
                it(`[]`, () => {
                    const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), false);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`[]`);
                });

                it(`[...]`, () => {
                    const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), true);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`[...]`);
                });

                it(`[foo = number, bar = nullable text]`, () => {
                    const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                        false,
                        new Map<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        false,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`[foo: number, bar: nullable text]`);
                });

                it(`[foo = number, bar = nullable text, ...]`, () => {
                    const type: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                        false,
                        new Map<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        true,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`[foo: number, bar: nullable text, ...]`);
                });
            });

            describe(`${Type.ExtendedTypeKind.DefinedTable}`, () => {
                it(`table []`, () => {
                    const type: Type.DefinedTable = TypeUtils.createDefinedTable(false, new OrderedMap(), false);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`table []`);
                });

                it(`table [...]`, () => {
                    const type: Type.DefinedTable = TypeUtils.createDefinedTable(false, new OrderedMap(), true);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`table [...]`);
                });

                it(`table [foo = number, bar = nullable text]`, () => {
                    const type: Type.DefinedTable = TypeUtils.createDefinedTable(
                        false,
                        new OrderedMap<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        false,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`table [foo: number, bar: nullable text]`);
                });

                it(`table [foo = number, bar = nullable text, ...]`, () => {
                    const type: Type.DefinedTable = TypeUtils.createDefinedTable(
                        false,
                        new OrderedMap<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        true,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`table [foo: number, bar: nullable text, ...]`);
                });
            });

            describe(`${Type.ExtendedTypeKind.FunctionType}`, () => {
                it(`type function () any`, () => {
                    const type: Type.FunctionType = TypeUtils.createFunctionType(false, [], Type.AnyInstance);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type function () any`);
                });

                it(`type function () any`, () => {
                    const type: Type.FunctionType = TypeUtils.createFunctionType(
                        false,
                        [
                            {
                                isNullable: false,
                                isOptional: false,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param1",
                            },
                            {
                                isNullable: true,
                                isOptional: false,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param2",
                            },
                            {
                                isNullable: false,
                                isOptional: true,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param3",
                            },
                            {
                                isNullable: true,
                                isOptional: true,
                                type: Type.TypeKind.Number,
                                nameLiteral: "param4",
                            },
                        ],
                        Type.AnyInstance,
                    );

                    const actual: string = noopNameOf(type);

                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(
                        `type function (param1: number, param2: nullable number, param3: optional number, param4: optional nullable number) any`,
                    );
                });
            });

            describe(`${Type.ExtendedTypeKind.ListType}`, () => {
                it(`type {text}`, () => {
                    const type: Type.ListType = TypeUtils.createListType(false, Type.TextInstance);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type {text}`);
                });
            });

            describe(`${Type.ExtendedTypeKind.PrimaryPrimitiveType}`, () => {
                it(`type text`, () => {
                    const type: Type.PrimaryPrimitiveType = TypeUtils.createPrimaryPrimitiveType(
                        false,
                        Type.TextInstance,
                    );

                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type text`);
                });
            });

            describe(`${Type.ExtendedTypeKind.RecordType}`, () => {
                it(`type [foo = number]`, () => {
                    const type: Type.RecordType = TypeUtils.createRecordType(
                        false,
                        new Map([["foo", Type.NumberInstance]]),
                        false,
                    );

                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type [foo: number]`);
                });

                it(`type [...]`, () => {
                    const type: Type.RecordType = TypeUtils.createRecordType(false, new Map(), true);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type [...]`);
                });

                it(`type [foo = number, bar = nullable text]`, () => {
                    const type: Type.RecordType = TypeUtils.createRecordType(
                        false,
                        new Map<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        false,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`type [foo: number, bar: nullable text]`);
                });

                it(`type [foo = number, bar = nullable text, ...]`, () => {
                    const type: Type.RecordType = TypeUtils.createRecordType(
                        false,
                        new Map<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        true,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`type [foo: number, bar: nullable text, ...]`);
                });
            });

            describe(`${Type.ExtendedTypeKind.TableType}`, () => {
                it(`type table [foo = number]`, () => {
                    const type: Type.TableType = TypeUtils.createTableType(
                        false,
                        new Map([["foo", Type.NumberInstance]]),
                        false,
                    );

                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type table [foo: number]`);
                });

                it(`type table [...]`, () => {
                    const type: Type.TableType = TypeUtils.createTableType(false, new Map(), true);
                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type table [...]`);
                });

                it(`type table [foo = number, bar = nullable text]`, () => {
                    const type: Type.TableType = TypeUtils.createTableType(
                        false,
                        new Map<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        false,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`type table [foo: number, bar: nullable text]`);
                });

                it(`type table [foo = number, bar = nullable text, ...]`, () => {
                    const type: Type.TableType = TypeUtils.createTableType(
                        false,
                        new Map<string, Type.TPowerQueryType>([
                            ["foo", Type.NumberInstance],
                            ["bar", Type.NullableTextInstance],
                        ]),
                        true,
                    );

                    const actual: string = noopNameOf(type);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal(`type table [foo: number, bar: nullable text, ...]`);
                });
            });

            describe(`${Type.ExtendedTypeKind.TableTypePrimaryExpression}`, () => {
                // Assumes `foo` is text.
                it(`type table foo`, () => {
                    const type: Type.TableTypePrimaryExpression = TypeUtils.createTableTypePrimary(
                        false,
                        Type.TextInstance,
                    );

                    const actual: string = noopNameOf(type);
                    expect(actual).to.equal(`type table text`);
                });
            });
        });
    });
});
