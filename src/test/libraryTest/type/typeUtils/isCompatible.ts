// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Type, TypeUtils } from "../../../../language/type";

describe(`TypeUtils - isCompatible`, () => {
    describe(`any`, () => {
        it(`TypeKinds expected to be true`, () => {
            const typeKinds: ReadonlyArray<Type.TypeKind> = [
                Type.TypeKind.Any,
                Type.TypeKind.AnyNonNull,
                Type.TypeKind.Binary,
                Type.TypeKind.Date,
                Type.TypeKind.DateTime,
                Type.TypeKind.DateTimeZone,
                Type.TypeKind.Duration,
                Type.TypeKind.Function,
                Type.TypeKind.List,
                Type.TypeKind.Logical,
                Type.TypeKind.Null,
                Type.TypeKind.Number,
                Type.TypeKind.Record,
                Type.TypeKind.Table,
                Type.TypeKind.Text,
                Type.TypeKind.Type,
                Type.TypeKind.Action,
                Type.TypeKind.Time,
            ];
            const expected: ReadonlyArray<[Type.TypeKind, boolean]> = typeKinds.map(typeKind => [typeKind, true]);
            const actual: ReadonlyArray<[Type.TypeKind, boolean | undefined]> = typeKinds.map(typeKind => [
                typeKind,
                TypeUtils.isCompatible(TypeUtils.primitiveTypeFactory(typeKind, false), Type.AnyInstance),
            ]);
            expect(actual).deep.equal(expected);
        });

        it(`TypeKinds expected to be false`, () => {
            const actual: boolean | undefined = TypeUtils.isCompatible(
                TypeUtils.primitiveTypeFactory(Type.TypeKind.None, false),
                Type.AnyInstance,
            );
            expect(actual).to.equal(false, undefined);
        });

        it(`TypeKinds expected to be undefined`, () => {
            const typeKinds: ReadonlyArray<Type.TypeKind> = [Type.TypeKind.NotApplicable, Type.TypeKind.Unknown];
            const expected: ReadonlyArray<[Type.TypeKind, undefined]> = typeKinds.map(typeKind => [
                typeKind,
                undefined,
            ]);
            const actual: ReadonlyArray<[Type.TypeKind, boolean | undefined]> = typeKinds.map(typeKind => [
                typeKind,
                TypeUtils.isCompatible(TypeUtils.primitiveTypeFactory(typeKind, false), Type.AnyInstance),
            ]);
            expect(actual).deep.equal(expected);
        });

        it(`AnyUnion, basic`, () => {
            const actual: boolean | undefined = TypeUtils.isCompatible(
                Type.TextInstance,
                TypeUtils.anyUnionFactory([Type.TextInstance, Type.NumberInstance]),
            );
            expect(actual).to.equal(true, undefined);
        });

        it(`AnyUnion, contains any`, () => {
            const actual: boolean | undefined = TypeUtils.isCompatible(
                Type.TextInstance,
                TypeUtils.anyUnionFactory([Type.TextInstance, Type.NumberInstance]),
            );
            expect(actual).to.equal(true, undefined);
        });
    });
});
