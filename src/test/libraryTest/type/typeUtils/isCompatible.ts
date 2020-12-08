// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Language } from "../../../..";

describe(`TypeUtils - isCompatible`, () => {
    describe(`any`, () => {
        it(`TypeKinds expected to be true`, () => {
            const typeKinds: ReadonlyArray<Language.Type.TypeKind> = [
                Language.Type.TypeKind.Any,
                Language.Type.TypeKind.AnyNonNull,
                Language.Type.TypeKind.Binary,
                Language.Type.TypeKind.Date,
                Language.Type.TypeKind.DateTime,
                Language.Type.TypeKind.DateTimeZone,
                Language.Type.TypeKind.Duration,
                Language.Type.TypeKind.Function,
                Language.Type.TypeKind.List,
                Language.Type.TypeKind.Logical,
                Language.Type.TypeKind.Null,
                Language.Type.TypeKind.Number,
                Language.Type.TypeKind.Record,
                Language.Type.TypeKind.Table,
                Language.Type.TypeKind.Text,
                Language.Type.TypeKind.Type,
                Language.Type.TypeKind.Action,
                Language.Type.TypeKind.Time,
            ];
            const expected: ReadonlyArray<[Language.Type.TypeKind, boolean]> = typeKinds.map(typeKind => [
                typeKind,
                true,
            ]);
            const actual: ReadonlyArray<[Language.Type.TypeKind, boolean | undefined]> = typeKinds.map(typeKind => [
                typeKind,
                Language.TypeUtils.isCompatible(
                    Language.TypeUtils.primitiveTypeFactory(false, typeKind),
                    Language.Type.AnyInstance,
                ),
            ]);
            expect(actual).deep.equal(expected);
        });

        it(`TypeKinds expected to be false`, () => {
            const actual: boolean | undefined = Language.TypeUtils.isCompatible(
                Language.TypeUtils.primitiveTypeFactory(false, Language.Type.TypeKind.None),
                Language.Type.AnyInstance,
            );
            expect(actual).to.equal(false, undefined);
        });

        it(`TypeKinds expected to be undefined`, () => {
            const typeKinds: ReadonlyArray<Language.Type.TypeKind> = [
                Language.Type.TypeKind.NotApplicable,
                Language.Type.TypeKind.Unknown,
            ];
            const expected: ReadonlyArray<[Language.Type.TypeKind, undefined]> = typeKinds.map(typeKind => [
                typeKind,
                undefined,
            ]);
            const actual: ReadonlyArray<[Language.Type.TypeKind, boolean | undefined]> = typeKinds.map(typeKind => [
                typeKind,
                Language.TypeUtils.isCompatible(
                    Language.TypeUtils.primitiveTypeFactory(false, typeKind),
                    Language.Type.AnyInstance,
                ),
            ]);
            expect(actual).deep.equal(expected);
        });

        it(`AnyUnion, basic`, () => {
            const actual: boolean | undefined = Language.TypeUtils.isCompatible(
                Language.Type.TextInstance,
                Language.TypeUtils.anyUnionFactory([Language.Type.TextInstance, Language.Type.NumberInstance]),
            );
            expect(actual).to.equal(true, undefined);
        });

        it(`AnyUnion, contains any`, () => {
            const actual: boolean | undefined = Language.TypeUtils.isCompatible(
                Language.Type.TextInstance,
                Language.TypeUtils.anyUnionFactory([Language.Type.TextInstance, Language.Type.NumberInstance]),
            );
            expect(actual).to.equal(true, undefined);
        });
    });
});
