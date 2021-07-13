// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { Type, TypeUtils } from "../../../../powerquery-parser/language";

describe(`TypeUtils.isCompatible`, () => {
    it(`${Type.TypeKind.NotApplicable} should return undefined`, () => {
        const actual: boolean | undefined = TypeUtils.isCompatible(Type.NotApplicableInstance, Type.AnyInstance);
        expect(actual).to.equal(undefined, undefined);
    });

    it(`${Type.TypeKind.Unknown} should return undefined`, () => {
        const actual: boolean | undefined = TypeUtils.isCompatible(Type.UnknownInstance, Type.AnyInstance);
        expect(actual).to.equal(undefined, undefined);
    });

    describe(`any`, () => {
        it(`primitives compatible with any`, () => {
            const typeKinds: ReadonlyArray<Type.TypeKind> = [
                Type.TypeKind.Action,
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
                Type.TypeKind.Time,
                Type.TypeKind.Type,
            ];
            const expected: ReadonlyArray<[Type.TypeKind, boolean]> = typeKinds.map(typeKind => [typeKind, true]);
            const actual: ReadonlyArray<[Type.TypeKind, boolean | undefined]> = typeKinds.map(typeKind => [
                typeKind,
                TypeUtils.isCompatible(TypeUtils.createPrimitiveType(false, typeKind), Type.AnyInstance),
            ]);
            expect(actual).deep.equal(expected);
        });

        it(`${Type.TypeKind.None} not compatible with any`, () => {
            const actual: boolean | undefined = TypeUtils.isCompatible(
                TypeUtils.createPrimitiveType(false, Type.TypeKind.None),
                Type.AnyInstance,
            );
            expect(actual).to.equal(false, undefined);
        });

        it(`AnyUnion, basic`, () => {
            const actual: boolean | undefined = TypeUtils.isCompatible(
                Type.TextInstance,
                TypeUtils.createAnyUnion([Type.TextInstance, Type.NumberInstance]),
            );
            expect(actual).to.equal(true, undefined);
        });

        it(`AnyUnion, contains any`, () => {
            const actual: boolean | undefined = TypeUtils.isCompatible(
                Type.TextInstance,
                TypeUtils.createAnyUnion([Type.TextInstance, Type.NumberInstance]),
            );
            expect(actual).to.equal(true, undefined);
        });
    });

    describe(`${Type.ExtendedTypeKind.DefinedList}`, () => {
        it(`identical`, () => {
            const definedList: Type.DefinedList = TypeUtils.createDefinedList(false, [
                Type.TextInstance,
                Type.NumberInstance,
            ]);
            expect(TypeUtils.isCompatible(definedList, definedList)).to.equal(true, undefined);
        });

        describe(`literal element is compatible with parent type`, () => {
            it(`${Type.ExtendedTypeKind.LogicalLiteral}`, () => {
                const left: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createLogicalLiteral(false, "true"),
                ]);
                const right: Type.DefinedList = TypeUtils.createDefinedList(false, [Type.LogicalInstance]);

                expect(TypeUtils.isCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.NumberLiteral}`, () => {
                const left: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createNumberLiteral(false, `1`),
                ]);
                const right: Type.DefinedList = TypeUtils.createDefinedList(false, [Type.NumberInstance]);

                expect(TypeUtils.isCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.TextLiteral}`, () => {
                const left: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createTextLiteral(false, `"foo"`),
                ]);
                const right: Type.DefinedList = TypeUtils.createDefinedList(false, [Type.TextInstance]);

                expect(TypeUtils.isCompatible(left, right)).to.equal(true, undefined);
            });
        });
    });

    describe(`literals are compatible with parent type`, () => {
        describe(`${Type.ExtendedTypeKind.NumberLiteral}`, () => {
            it(`1`, () => {
                expect(TypeUtils.isCompatible(TypeUtils.createNumberLiteral(false, `1`), Type.NumberInstance)).to.equal(
                    true,
                    undefined,
                );
            });

            it(`--1`, () => {
                expect(
                    TypeUtils.isCompatible(TypeUtils.createNumberLiteral(false, `--1`), Type.NumberInstance),
                ).to.equal(true, undefined);
            });

            it(`+1`, () => {
                expect(
                    TypeUtils.isCompatible(TypeUtils.createNumberLiteral(false, `+1`), Type.NumberInstance),
                ).to.equal(true, undefined);
            });
        });

        it(`"foo"`, () => {
            expect(TypeUtils.isCompatible(TypeUtils.createTextLiteral(false, `"foo"`), Type.TextInstance)).to.equal(
                true,
                undefined,
            );
        });
    });

    describe(`literals are compatible with literals`, () => {
        it(`1`, () => {
            expect(
                TypeUtils.isCompatible(
                    TypeUtils.createNumberLiteral(false, `1`),
                    TypeUtils.createNumberLiteral(false, `1`),
                ),
            ).to.equal(true, undefined);
        });

        it(`"foo"`, () => {
            expect(
                TypeUtils.isCompatible(
                    TypeUtils.createTextLiteral(false, `"foo"`),
                    TypeUtils.createTextLiteral(false, `"foo"`),
                ),
            ).to.equal(true, undefined);
        });
    });
});
