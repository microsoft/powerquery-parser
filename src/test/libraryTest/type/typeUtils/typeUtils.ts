// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Language } from "../../../..";
// import { primitiveTypeFactory } from "../../../../powerquery-parser/language/type/typeUtils";

interface AbridgedType {
    readonly kind: Language.Type.TypeKind;
    readonly maybeExtendedKind: Language.Type.ExtendedTypeKind | undefined;
    readonly isNullable: boolean;
}

function abridgedPrimitiveType(kind: Language.Type.TypeKind, isNullable: boolean): AbridgedType {
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

function assertIsAnyUnion(type: Language.Type.TType): asserts type is Language.Type.AnyUnion {
    expect(type.maybeExtendedKind).to.equal(Language.Type.ExtendedTypeKind.AnyUnion);
}

function typeToAbridged(type: Language.Type.TType): AbridgedType {
    return {
        kind: type.kind,
        maybeExtendedKind: type.maybeExtendedKind,
        isNullable: type.isNullable,
    };
}

function abridgedTypesFactory(types: ReadonlyArray<Language.Type.TType>): ReadonlyArray<AbridgedType> {
    return types.map(typeToAbridged);
}

describe(`TypeUtils`, () => {
    describe(`dedupe`, () => {
        it(`generic, identical`, () => {
            const expected: AbridgedType = abridgedPrimitiveType(Language.Type.TypeKind.Record, false);
            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(
                Language.TypeUtils.dedupe([Language.Type.RecordInstance, Language.Type.RecordInstance]),
            );
            expect(actual.length).to.equal(1);
            assertGetAbridgedType(expected, actual[0]);
        });

        it(`generic, mixed`, () => {
            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(
                Language.TypeUtils.dedupe([Language.Type.RecordInstance, Language.Type.NullableRecordInstance]),
            );
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Language.Type.TypeKind.Record, false),
                abridgedPrimitiveType(Language.Type.TypeKind.Record, true),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`early return with any primitive`, () => {
            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(
                Language.TypeUtils.dedupe([Language.Type.AnyInstance, Language.Type.NullableRecordInstance]),
            );
            const expected: ReadonlyArray<AbridgedType> = [Language.Type.AnyInstance];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Language.Type.ExtendedTypeKind.AnyUnion}, combine into a single primitive type`, () => {
            const deduped: ReadonlyArray<Language.Type.TType> = Language.TypeUtils.dedupe([
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance, Language.Type.RecordInstance]),
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance, Language.Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);

            const actual: AbridgedType = typeToAbridged(deduped[0]);
            const expected: AbridgedType = Language.TypeUtils.primitiveTypeFactory(
                false,
                Language.Type.TypeKind.Record,
            );
            assertGetAbridgedType(expected, actual);
        });

        it(`${Language.Type.ExtendedTypeKind.AnyUnion}, combine into a single AnyUnion`, () => {
            const deduped: ReadonlyArray<Language.Type.TType> = Language.TypeUtils.dedupe([
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance, Language.Type.NullableTableInstance]),
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance, Language.Type.NullableTableInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Language.Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Language.Type.TypeKind.Record, false),
                abridgedPrimitiveType(Language.Type.TypeKind.Table, true),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Language.Type.ExtendedTypeKind.AnyUnion}, combine into a single AnyUnion, mixed nullability`, () => {
            const deduped: ReadonlyArray<Language.Type.TType> = Language.TypeUtils.dedupe([
                Language.TypeUtils.anyUnionFactory([
                    Language.Type.NullableRecordInstance,
                    Language.Type.NullableTableInstance,
                ]),
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance, Language.Type.TableInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Language.Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Language.Type.TypeKind.Record, true),
                abridgedPrimitiveType(Language.Type.TypeKind.Table, true),
                abridgedPrimitiveType(Language.Type.TypeKind.Record, false),
                abridgedPrimitiveType(Language.Type.TypeKind.Table, false),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Language.Type.ExtendedTypeKind.AnyUnion}, flatten multi level AnyUnion to single AnyUnion`, () => {
            const deduped: ReadonlyArray<Language.Type.TType> = Language.TypeUtils.dedupe([
                Language.TypeUtils.anyUnionFactory([
                    Language.Type.RecordInstance,
                    Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance, Language.Type.NumberInstance]),
                ]),
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Language.Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Language.Type.TypeKind.Record, false),
                abridgedPrimitiveType(Language.Type.TypeKind.Number, false),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Language.Type.ExtendedTypeKind.AnyUnion}, flatten multi level AnyUnion to single AnyUnion`, () => {
            const deduped: ReadonlyArray<Language.Type.TType> = Language.TypeUtils.dedupe([
                Language.TypeUtils.anyUnionFactory([
                    Language.Type.RecordInstance,
                    Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance, Language.Type.NumberInstance]),
                ]),
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Language.Type.TType = deduped[0];
            assertIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Language.Type.TypeKind.Record, false),
                abridgedPrimitiveType(Language.Type.TypeKind.Number, false),
            ];
            assertGetAbridgedTypes(expected, actual);
        });

        it(`${Language.Type.ExtendedTypeKind.AnyUnion}, early return with any primitive`, () => {
            const deduped: ReadonlyArray<Language.Type.TType> = Language.TypeUtils.dedupe([
                Language.TypeUtils.anyUnionFactory([
                    Language.Type.RecordInstance,
                    Language.TypeUtils.anyUnionFactory([Language.Type.AnyInstance, Language.Type.NumberInstance]),
                ]),
                Language.TypeUtils.anyUnionFactory([Language.Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Language.Type.TType = deduped[0];

            const actual: AbridgedType = typeToAbridged(ttype);
            const expected: AbridgedType = typeToAbridged(Language.Type.AnyInstance);
            assertGetAbridgedType(expected, actual);
        });
    });
});
