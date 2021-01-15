// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";

import { DefaultLocale } from "../../../../powerquery-parser";
import { Type, TypeUtils } from "../../../../powerquery-parser/language";

interface AbridgedType {
    readonly kind: Type.TypeKind;
    readonly maybeExtendedKind: Type.ExtendedTypeKind | undefined;
    readonly isNullable: boolean;
}

function abridgedPrimitiveType(kind: Type.TypeKind, isNullable: boolean): AbridgedType {
    return {
        kind,
        maybeExtendedKind: undefined,
        isNullable,
    };
}

function assertGetAbridgedType(expected: AbridgedType, actual: AbridgedType): void {
    expect(actual).deep.equal(expected);
}

function assertGetAbridgedTypes(expected: ReadonlyArray<AbridgedType>, actual: ReadonlyArray<AbridgedType>): void {
    expect(actual).deep.equal(expected);
}

function assertIsAnyUnion(type: Type.TType): asserts type is Type.AnyUnion {
    expect(type.maybeExtendedKind).to.equal(Type.ExtendedTypeKind.AnyUnion);
}

function typeToAbridged(type: Type.TType): AbridgedType {
    return {
        kind: type.kind,
        maybeExtendedKind: type.maybeExtendedKind,
        isNullable: type.isNullable,
    };
}

function abridgedTypesFactory(types: ReadonlyArray<Type.TType>): ReadonlyArray<AbridgedType> {
    return types.map(typeToAbridged);
}

describe(`TypeUtils`, () => {
    describe(`dedupe`, () => {
        it(`generic, identical`, () => {
            const expected: AbridgedType = abridgedPrimitiveType(Type.TypeKind.Record, false);
            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(
                TypeUtils.dedupe([Type.RecordInstance, Type.RecordInstance]),
            );
            expect(actual.length).to.equal(1);
            assertGetAbridgedType(expected, actual[0]);
        });

        it(`generic, mixed`, () => {
            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(
                TypeUtils.dedupe([Type.RecordInstance, Type.NullableRecordInstance]),
            );
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Record, true),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`early return with any primitive`, () => {
            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(
                TypeUtils.dedupe([Type.AnyInstance, Type.NullableRecordInstance]),
            );
            const expected: ReadonlyArray<AbridgedType> = [Type.AnyInstance];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single primitive type`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.RecordInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);

            const actual: AbridgedType = typeToAbridged(deduped[0]);
            const expected: AbridgedType = TypeUtils.primitiveTypeFactory(false, Type.TypeKind.Record);
            assertGetAbridgedType(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single AnyUnion`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NullableTableInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NullableTableInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single AnyUnion, mixed nullability`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.NullableRecordInstance, Type.NullableTableInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.TableInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, true),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, false),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, flatten multi level AnyUnion to single AnyUnion`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([
                    Type.RecordInstance,
                    TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NumberInstance]),
                ]),
                TypeUtils.anyUnionFactory([Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Number, false),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, flatten multi level AnyUnion to single AnyUnion`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([
                    Type.RecordInstance,
                    TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NumberInstance]),
                ]),
                TypeUtils.anyUnionFactory([Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Number, false),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, early return with any primitive`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([
                    Type.RecordInstance,
                    TypeUtils.anyUnionFactory([Type.AnyInstance, Type.NumberInstance]),
                ]),
                TypeUtils.anyUnionFactory([Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Type.TType = deduped[0];

            const actual: AbridgedType = typeToAbridged(ttype);
            const expected: AbridgedType = typeToAbridged(Type.AnyInstance);
            assertGetAbridgedType(expected, actual);
        });
    });

    describe(`nameOf`, () => {
        describe(`non extended`, () => {
            describe("non-nullable", () => {
                it(`${Type.AnyInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.AnyInstance, DefaultLocale)).to.equal("any");
                });
                it(`${Type.AnyNonNullInstance.kind}`, () => {
                    // tslint:disable-next-line: chai-vague-errors
                    expect(TypeUtils.nameOf(Type.AnyNonNullInstance, DefaultLocale)).to.equal("anynonnull");
                });
                it(`${Type.BinaryInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.BinaryInstance, DefaultLocale)).to.equal("binary");
                });
                it(`${Type.DateInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.DateInstance, DefaultLocale)).to.equal("date");
                });
                it(`${Type.DateTimeInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.DateTimeInstance, DefaultLocale)).to.equal("datetime");
                });
                it(`${Type.DateTimeZoneInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.DateTimeZoneInstance, DefaultLocale)).to.equal("datetimezone");
                });
                it(`${Type.DurationInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.DurationInstance, DefaultLocale)).to.equal("duration");
                });
                it(`${Type.FunctionInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.FunctionInstance, DefaultLocale)).to.equal("function");
                });
                it(`${Type.ListInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.ListInstance, DefaultLocale)).to.equal("list");
                });
                it(`${Type.LogicalInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.LogicalInstance, DefaultLocale)).to.equal("logical");
                });
                it(`${Type.NoneInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.NoneInstance, DefaultLocale)).to.equal("none");
                });
                it(`${Type.NullInstance.kind}`, () => {
                    // tslint:disable-next-line: chai-vague-errors
                    expect(TypeUtils.nameOf(Type.NullInstance, DefaultLocale)).to.equal("null");
                });
                it(`${Type.NumberInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.NumberInstance, DefaultLocale)).to.equal("number");
                });
                it(`${Type.RecordInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.RecordInstance, DefaultLocale)).to.equal("record");
                });
                it(`${Type.TableInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.TableInstance, DefaultLocale)).to.equal("table");
                });
                it(`${Type.TypePrimitiveInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.TypePrimitiveInstance, DefaultLocale)).to.equal("type");
                });

                it(`${Type.ActionInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.ActionInstance, DefaultLocale)).to.equal("action");
                });
                it(`${Type.TimeInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.TimeInstance, DefaultLocale)).to.equal("time");
                });

                it(`${Type.NotApplicableInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.NotApplicableInstance, DefaultLocale)).to.equal("not applicable");
                });
                it(`${Type.UnknownInstance.kind}`, () => {
                    expect(TypeUtils.nameOf(Type.UnknownInstance, DefaultLocale)).to.equal("unknown");
                });
            });

            describe("nullable", () => {
                it(`${Type.NullableAnyInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableAnyInstance, DefaultLocale);
                    expect(actual).to.equal("any");
                });
                // anynonnull can't be nullable
                it(`${Type.NullableBinaryInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableBinaryInstance, DefaultLocale);
                    expect(actual).to.equal("binary");
                });
                it(`${Type.NullableDateInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableDateInstance, DefaultLocale);
                    expect(actual).to.equal("date");
                });
                it(`${Type.NullableDateTimeInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableDateTimeInstance, DefaultLocale);
                    expect(actual).to.equal("datetime");
                });
                it(`${Type.NullableDateTimeZoneInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableDateTimeZoneInstance, DefaultLocale);
                    expect(actual).to.equal("datetimezone");
                });
                it(`${Type.NullableDurationInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableDurationInstance, DefaultLocale);
                    expect(actual).to.equal("duration");
                });
                it(`${Type.NullableFunctionInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableFunctionInstance, DefaultLocale);
                    expect(actual).to.equal("function");
                });
                it(`${Type.NullableListInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableListInstance, DefaultLocale);
                    expect(actual).to.equal("list");
                });
                it(`${Type.NullableLogicalInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableLogicalInstance, DefaultLocale);
                    expect(actual).to.equal("logical");
                });
                it(`${Type.NullableNoneInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableNoneInstance, DefaultLocale);
                    expect(actual).to.equal("none");
                });
                it(`${Type.NullableNullInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableNullInstance, DefaultLocale);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("null");
                });
                it(`${Type.NullableNumberInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableNumberInstance, DefaultLocale);
                    expect(actual).to.equal("number");
                });
                it(`${Type.NullableRecordInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableRecordInstance, DefaultLocale);
                    expect(actual).to.equal("record");
                });
                it(`${Type.NullableTableInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableTableInstance, DefaultLocale);
                    expect(actual).to.equal("table");
                });
                it(`${Type.NullableTypeInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableTypeInstance, DefaultLocale);
                    expect(actual).to.equal("type");
                });

                it(`${Type.NullableActionInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableActionInstance, DefaultLocale);
                    expect(actual).to.equal("action");
                });
                it(`${Type.NullableTimeInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableTimeInstance, DefaultLocale);
                    expect(actual).to.equal("time");
                });

                it(`${Type.NullableNotApplicableInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableNotApplicableInstance, DefaultLocale);
                    // tslint:disable-next-line: chai-vague-errors
                    expect(actual).to.equal("nullable not applicable");
                });
                it(`${Type.NullableUnknownInstance.kind}`, () => {
                    const actual: string = TypeUtils.nameOf(Type.NullableUnknownInstance, DefaultLocale);
                    expect(actual).to.equal("unknown");
                });
            });
        });

        describe(`extended`, () => {
            describe(`${Type.ExtendedTypeKind.AnyUnion}`, () => {
                it(`primitives`, () => {
                    const type: Type.TType = TypeUtils.anyUnionFactory([Type.NumberInstance, Type.ListInstance]);
                    expect(TypeUtils.nameOf(type, DefaultLocale)).to.equal(`number | list`);
                });
                it(`complex`, () => {
                    const type: Type.TType = TypeUtils.anyUnionFactory([
                        TypeUtils.definedRecordFactory(false, new Map([["foo", Type.NumberInstance]]), false),
                        TypeUtils.definedListFactory(false, [Type.TextInstance]),
                        TypeUtils.definedTableFactory(false, new Map([["bar", Type.TextInstance]]), true),
                    ]);
                    const actual: string = TypeUtils.nameOf(type, DefaultLocale);
                    expect(actual).to.equal(`[foo: number] | {text} | table [bar: text, ...]`);
                });
            });
        });
    });
});
