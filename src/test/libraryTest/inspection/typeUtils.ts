// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import "mocha";
import { Type, TypeUtils } from "../../../type";

function expectGenericType(value: Type.TType, kind: Type.TypeKind): void {
    if (value.kind !== kind) {
        throw new Error(`expected ${kind} but found ${value.kind}`);
    }
}

function expectGenericUnionedTypes(
    actual: ReadonlyArray<Type.TType>,
    expected: ReadonlyArray<[Type.TypeKind, boolean]>,
): void {
    if (actual.length !== 1) {
        throw new Error(`did you forget to call dedupe 'actual'?`);
    } else if (actual[0].maybeExtendedKind !== Type.ExtendedTypeKind.AnyUnion) {
        throw new Error(`actual isn't an AnyUnion`);
    }

    const simplifiedActual: [Type.TypeKind, boolean][] = actual[0].unionedTypePairs.map((value: Type.TType) => [
        value.kind,
        value.isNullable,
    ]);
    expect(simplifiedActual.sort()).deep.equal([...expected].sort());
}

describe(`TypeUtils`, () => {
    describe(`dedupe`, () => {
        it(`generic, identical`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([Type.RecordInstance, Type.RecordInstance]);
            expect(result.length).to.equal(1);
        });

        it(`generic, mixed`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                Type.RecordInstance,
                Type.NullableRecordInstance,
            ]);
            expect(result.length).to.equal(2);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, generic`, () => {
            const actual: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NullableTableInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NullableTableInstance]),
            ]);
            expectGenericUnionedTypes(actual, [
                [Type.TypeKind.Record, false],
                [Type.TypeKind.Table, true],
            ]);
        });

        it(`${Type.ExtendedTypeKind.AnyUnion}, mixed nullability`, () => {
            const actual: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.NullableRecordInstance, Type.NullableTableInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NullableTableInstance]),
            ]);
            expectGenericUnionedTypes(actual, [
                [Type.TypeKind.Record, true],
                [Type.TypeKind.Table, true],
                [Type.TypeKind.Record, false],
            ]);
        });

        it(`simplify single AnyUnion.unionedTypes to TType`, () => {
            const actual: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([Type.RecordInstance]),
                TypeUtils.anyUnionFactory([Type.RecordInstance]),
            ]);
            expect(actual.length).to.equal(1);
            expectGenericType(actual[0], Type.TypeKind.Record);
        });

        it(`WIP flatten multi level AnyUnion to single AnyUnion`, () => {
            const actual: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([
                    Type.RecordInstance,
                    TypeUtils.anyUnionFactory([Type.RecordInstance, Type.NumberInstance]),
                ]),
                TypeUtils.anyUnionFactory([Type.RecordInstance]),
            ]);
            expectGenericUnionedTypes(actual, [
                [Type.TypeKind.Record, false],
                [Type.TypeKind.Number, false],
                [Type.TypeKind.Record, false],
            ]);
        });
    });

    it(`simplify anyUnionFactory`, () => {
        const actual: Type.TType = TypeUtils.anyUnionFactory([Type.RecordInstance]) as Type.AnyUnion;
        expectGenericType(actual, Type.TypeKind.Record);
    });
});
