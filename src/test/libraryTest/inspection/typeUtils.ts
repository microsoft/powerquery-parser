// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import "mocha";
import { Type, TypeUtils } from "../../../language/type";
import { primitiveTypeFactory } from "../../../language/type/typeUtils";

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

function expectAbridgedType(expected: AbridgedType, actual: AbridgedType): void {
    expect(actual).deep.equal(expected);
}

function expectAbridgedTypes(expected: ReadonlyArray<AbridgedType>, actual: ReadonlyArray<AbridgedType>): void {
    expect(actual).deep.equal(expected);
}

function assertTypeIsAnyUnion(type: Type.TType): asserts type is Type.AnyUnion {
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
            expectAbridgedType(expected, actual[0]);
        });

        it(`generic, mixed`, () => {
            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(
                TypeUtils.dedupe([Type.RecordInstance, Type.NullableRecordInstance]),
            );
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Record, true),
            ];
            expectAbridgedTypes(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single primitive type`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.RecordInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.RecordInstance]),
            ]);

            expect(deduped.length).to.equal(1);

            const actual: AbridgedType = typeToAbridged(deduped[0]);
            const expected: AbridgedType = primitiveTypeFactory(Type.TypeKind.Record, false);
            expectAbridgedType(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single AnyUnion`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NullableTableInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NullableTableInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Type.TType = deduped[0];
            assertTypeIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
            ];
            expectAbridgedTypes(expected, actual);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, combine into a single AnyUnion, mixed nullability`, () => {
            const deduped: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.NullableRecordInstance, Type.NullableTableInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.TableInstance]),
            ]);

            expect(deduped.length).to.equal(1);
            const ttype: Type.TType = deduped[0];
            assertTypeIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, true),
                abridgedPrimitiveType(Type.TypeKind.Table, true),
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Table, false),
            ];
            expectAbridgedTypes(expected, actual);
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
            assertTypeIsAnyUnion(ttype);

            const actual: ReadonlyArray<AbridgedType> = abridgedTypesFactory(ttype.unionedTypePairs);
            const expected: ReadonlyArray<AbridgedType> = [
                abridgedPrimitiveType(Type.TypeKind.Record, false),
                abridgedPrimitiveType(Type.TypeKind.Number, false),
            ];
            expectAbridgedTypes(expected, actual);
        });
    });
});
