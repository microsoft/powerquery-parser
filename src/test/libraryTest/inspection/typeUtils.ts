// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import "mocha";
import { Type, TypeUtils } from "../../../type";

function isAnyUnion(value: Type.TType): value is Type.AnyUnion {
    return value.kind === Type.TypeKind.Any && value.maybeExtendedKind === Type.ExtendedTypeKind.AnyUnion;
}

function expectAnyUnion(value: Type.TType): Type.AnyUnion {
    if (isAnyUnion(value)) {
        return value;
    } else {
        throw new Error("expected given type value was expected to be an AnyUnion");
    }
}

describe(`TypeUtils`, () => {
    describe(`dedupe`, () => {
        it(`dedupe - generic, identical`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.genericFactory(Type.TypeKind.Record, false),
                TypeUtils.genericFactory(Type.TypeKind.Record, false),
            ]);
            expect(result.length).to.equal(1);
        });

        it(`dedupe - generic, mixed`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.genericFactory(Type.TypeKind.Record, false),
                TypeUtils.genericFactory(Type.TypeKind.Record, true),
            ]);
            expect(result.length).to.equal(2);
        });

        it(`dedupe - ${Type.ExtendedTypeKind.AnyUnion}, generic`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([TypeUtils.genericFactory(Type.TypeKind.Record, false)]),
                TypeUtils.anyUnionFactory([TypeUtils.genericFactory(Type.TypeKind.Record, false)]),
            ]);
            expect(result.length).to.equal(1);
            const anyUnion: Type.TType = result[0];
            if (anyUnion.kind !== Type.TypeKind.Any || anyUnion.maybeExtendedKind !== Type.ExtendedTypeKind.AnyUnion) {
                throw new Error(
                    `expected anyUnion to have kind === ${Type.TypeKind.Any} && maybeExtendedKind === ${Type.ExtendedTypeKind.AnyUnion}`,
                );
            }

            expect(anyUnion.unionedTypePairs.length).to.equal(1);
            const unionedType: Type.TType = anyUnion.unionedTypePairs[0];
            expect(unionedType.kind).to.equal(Type.TypeKind.Record);
            expect(unionedType.maybeExtendedKind).to.equal(undefined, "shouldn't have an extended type kind");
        });

        it(`dedupe - ${Type.ExtendedTypeKind.AnyUnion}, generic`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([TypeUtils.genericFactory(Type.TypeKind.Record, false)]),
                TypeUtils.anyUnionFactory([TypeUtils.genericFactory(Type.TypeKind.Record, false)]),
            ]);
            expect(result.length).to.equal(1);
            const anyUnion: Type.TType = result[0];
            if (anyUnion.kind !== Type.TypeKind.Any || anyUnion.maybeExtendedKind !== Type.ExtendedTypeKind.AnyUnion) {
                throw new Error(
                    `expected anyUnion to have kind === ${Type.TypeKind.Any} && maybeExtendedKind === ${Type.ExtendedTypeKind.AnyUnion}`,
                );
            }

            expect(anyUnion.unionedTypePairs.length).to.equal(1);

            const unionedType: Type.TType = anyUnion.unionedTypePairs[0];
            expect(unionedType.kind).to.equal(Type.TypeKind.Record);
            expect(unionedType.maybeExtendedKind).to.equal(undefined, "shouldn't have an extended type kind");
        });

        it(`dedupe - ${Type.ExtendedTypeKind.AnyUnion}, mixed nullability`, () => {
            const result: ReadonlyArray<Type.TType> = TypeUtils.dedupe([
                TypeUtils.anyUnionFactory([TypeUtils.genericFactory(Type.TypeKind.Record, false)]),
                TypeUtils.anyUnionFactory([TypeUtils.genericFactory(Type.TypeKind.Record, true)]),
            ]);
            expect(result.length).to.equal(2);
            const firstAnyUnion: Type.AnyUnion = expectAnyUnion(result[0]);
            expect(firstAnyUnion.unionedTypePairs.length).to.equal(1);
            const secondAnyUnion: Type.AnyUnion = expectAnyUnion(result[1]);
            expect(secondAnyUnion.unionedTypePairs.length).to.equal(1);
        });
    });
});
