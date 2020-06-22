// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import "mocha";
import { Type, TypeUtils } from "../../../type";

function isAnyUnion(value: Type.TType): value is Type.AnyUnion {
    return value.kind === Type.TypeKind.Any && value.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion;
}

function expectGenericType(value: Type.TType, kind: Type.TypeKind): void {
    if (value.kind !== kind) {
        throw new Error(`expected ${kind} but found ${value.kind}`);
    }
}

function expectGenericUnionedTypes(
    actual: ReadonlyArray<Type.TType>,
    expected: ReadonlyArray<ReadonlyArray<Type.TypeKind>>,
): void {
    const simplifiedActual: Type.TypeKind[][] = [];

    for (const type of actual) {
        if (!isAnyUnion(type)) {
            throw new Error(`all values in actual were expected to to be of type ${Type.ExtendedTypeKind.AnyUnion}`);
        }
        simplifiedActual.push(type.unionedTypePairs.map((value: Type.TType) => value.kind));
    }

    expect(simplifiedActual).deep.equal(expected);
}

describe(`TypeUtils`, () => {
    describe(`dedupe`, () => {
        it(`dedupe - generic, identical`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
                TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
            ]);
            expect(result.length).to.equal(1);
        });

        it(`dedupe - generic, mixed`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
                TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, true),
            ]);
            expect(result.length).to.equal(2);
        });

        it(`dedupe - ${Type.ExtendedTypeKind.AnyUnion}, generic`, () => {
            const actual: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Table, false),
                ]),
                TypeUtils.anyUnionFactory([
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Table, false),
                ]),
            ]);
            expect(actual.length).to.equal(1);
            expectGenericUnionedTypes(actual, [[Type.TypeKind.Record, Type.TypeKind.Table]]);
        });

        it(`dedupe - ${Type.ExtendedTypeKind.AnyUnion}, mixed nullability`, () => {
            const actual: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, true),
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Table, true),
                ]),
                TypeUtils.anyUnionFactory([
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false),
                    TypeUtils.primitiveTypeFactory(Type.TypeKind.Table, false),
                ]),
            ]);
            expect(actual.length).to.equal(2);
            expectGenericUnionedTypes(actual, [
                [Type.TypeKind.Record, Type.TypeKind.Table],
                [Type.TypeKind.Record, Type.TypeKind.Table],
            ]);
        });

        it(`dedupe - simplify single AnyUnion.unionedTypes to TType`, () => {
            const actual: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false)]),
                TypeUtils.anyUnionFactory([TypeUtils.primitiveTypeFactory(Type.TypeKind.Record, false)]),
            ]);
            expect(actual.length).to.equal(1);
            expectGenericType(actual[0], Type.TypeKind.Record);
        });
    });
});
