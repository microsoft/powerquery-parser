// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Language } from "../../../..";

describe(`TypeUtils.isCompatible`, () => {
    it(`${Language.Type.TypeKind.NotApplicable} should return undefined`, () => {
        const actual: boolean | undefined = Language.TypeUtils.isCompatible(
            Language.Type.NotApplicableInstance,
            Language.Type.AnyInstance,
        );
        expect(actual).to.equal(undefined, undefined);
    });

    it(`${Language.Type.TypeKind.Unknown} should return undefined`, () => {
        const actual: boolean | undefined = Language.TypeUtils.isCompatible(
            Language.Type.UnknownInstance,
            Language.Type.AnyInstance,
        );
        expect(actual).to.equal(undefined, undefined);
    });

    describe(`any`, () => {
        it(`primitives compatible with any`, () => {
            const typeKinds: ReadonlyArray<Language.Type.TypeKind> = [
                Language.Type.TypeKind.Action,
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
                Language.Type.TypeKind.Time,
                Language.Type.TypeKind.Type,
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

        it(`${Language.Type.TypeKind.None} not compatible with any`, () => {
            const actual: boolean | undefined = Language.TypeUtils.isCompatible(
                Language.TypeUtils.primitiveTypeFactory(false, Language.Type.TypeKind.None),
                Language.Type.AnyInstance,
            );
            expect(actual).to.equal(false, undefined);
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

    describe(`literals are compatible with parent type`, () => {
        describe(`${Language.Type.ExtendedTypeKind.NumberLiteral}`, () => {
            it(`1`, () => {
                expect(
                    Language.TypeUtils.isCompatible(
                        Language.TypeUtils.numberLiteralFactory(false, `1`),
                        Language.Type.NumberInstance,
                    ),
                ).to.equal(true, undefined);
            });

            it(`--1`, () => {
                expect(
                    Language.TypeUtils.isCompatible(
                        Language.TypeUtils.numberLiteralFactory(false, `--1`),
                        Language.Type.NumberInstance,
                    ),
                ).to.equal(true, undefined);
            });

            it(`+1`, () => {
                expect(
                    Language.TypeUtils.isCompatible(
                        Language.TypeUtils.numberLiteralFactory(false, `+1`),
                        Language.Type.NumberInstance,
                    ),
                ).to.equal(true, undefined);
            });
        });

        it(`"foo"`, () => {
            expect(
                Language.TypeUtils.isCompatible(
                    Language.TypeUtils.textLiteralFactory(false, `"foo"`),
                    Language.Type.TextInstance,
                ),
            ).to.equal(true, undefined);
        });
    });

    describe(`literals are compatible with literals`, () => {
        it(`1`, () => {
            expect(
                Language.TypeUtils.isCompatible(
                    Language.TypeUtils.numberLiteralFactory(false, `1`),
                    Language.TypeUtils.numberLiteralFactory(false, `1`),
                ),
            ).to.equal(true, undefined);
        });

        it(`"foo"`, () => {
            expect(
                Language.TypeUtils.isCompatible(
                    Language.TypeUtils.textLiteralFactory(false, `"foo"`),
                    Language.TypeUtils.textLiteralFactory(false, `"foo"`),
                ),
            ).to.equal(true, undefined);
        });
    });
});
