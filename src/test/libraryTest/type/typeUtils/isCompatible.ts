// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { Type, TypeUtils } from "../../../../powerquery-parser/language";
import { NoOpTraceManagerInstance } from "../../../../powerquery-parser/common/trace";
import { OrderedMap } from "../../../../powerquery-parser";
import { TypeKind } from "../../../../powerquery-parser/language/type/type";

const noopCreateAnyUnion: (unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>) => Type.TPowerQueryType = (
    unionedTypePairs: ReadonlyArray<Type.TPowerQueryType>,
) => TypeUtils.createAnyUnion(unionedTypePairs, NoOpTraceManagerInstance, undefined);

const noopIsCompatible: (left: Type.TPowerQueryType, right: Type.TPowerQueryType) => boolean | undefined = (
    left: Type.TPowerQueryType,
    right: Type.TPowerQueryType,
) => TypeUtils.isCompatible(left, right, NoOpTraceManagerInstance, undefined);

describe(`localIsCompatible`, () => {
    describe(`${Type.TypeKind.AnyNonNull}`, () => {
        it(`null is not compatible`, () => {
            expect(noopIsCompatible(Type.NullInstance, Type.AnyNonNullInstance)).to.equal(false, undefined);
        });

        it(`nullable is not compatible`, () => {
            expect(noopIsCompatible(Type.NullableTextInstance, Type.AnyNonNullInstance)).to.equal(false, undefined);
        });

        it(`text is compatible`, () => {
            expect(noopIsCompatible(Type.TextInstance, Type.AnyNonNullInstance)).to.equal(true, undefined);
        });
    });

    it(`${Type.TypeKind.NotApplicable} should return undefined`, () => {
        const actual: boolean | undefined = noopIsCompatible(Type.NotApplicableInstance, Type.AnyInstance);
        expect(actual).to.equal(undefined, undefined);
    });

    it(`${Type.TypeKind.Unknown} should return undefined`, () => {
        const actual: boolean | undefined = noopIsCompatible(Type.UnknownInstance, Type.AnyInstance);
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
                Type.TypeKind.Number,
                Type.TypeKind.Record,
                Type.TypeKind.Table,
                Type.TypeKind.Text,
                Type.TypeKind.Time,
                Type.TypeKind.Type,
            ];

            const expected: ReadonlyArray<[Type.TypeKind, boolean]> = typeKinds.map((typeKind: TypeKind) => [
                typeKind,
                true,
            ]);

            const actual: ReadonlyArray<[Type.TypeKind, boolean | undefined]> = typeKinds.map((typeKind: TypeKind) => [
                typeKind,
                noopIsCompatible(TypeUtils.createPrimitiveType(false, typeKind), Type.AnyInstance),
            ]);

            expect(actual).deep.equal(expected);
        });

        it(`${Type.TypeKind.None} not compatible with any`, () => {
            const actual: boolean | undefined = noopIsCompatible(
                TypeUtils.createPrimitiveType(false, Type.TypeKind.None),
                Type.AnyInstance,
            );

            expect(actual).to.equal(false, undefined);
        });

        it(`AnyUnion, basic`, () => {
            const actual: boolean | undefined = noopIsCompatible(
                Type.TextInstance,
                noopCreateAnyUnion([Type.TextInstance, Type.NumberInstance]),
            );

            expect(actual).to.equal(true, undefined);
        });

        it(`AnyUnion, contains any`, () => {
            const actual: boolean | undefined = noopIsCompatible(
                Type.TextInstance,
                noopCreateAnyUnion([Type.TextInstance, Type.NumberInstance]),
            );

            expect(actual).to.equal(true, undefined);
        });
    });

    describe(`${Type.ExtendedTypeKind.DefinedList}`, () => {
        describe(`identity`, () => {
            it(`empty`, () => {
                const definedList: Type.DefinedList = TypeUtils.createDefinedList(false, []);
                expect(noopIsCompatible(definedList, definedList)).to.equal(true, undefined);
            });

            it(`non-empty`, () => {
                const definedList: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    Type.TextInstance,
                    Type.NumberInstance,
                ]);

                expect(noopIsCompatible(definedList, definedList)).to.equal(true, undefined);
            });
        });

        describe(`list item literal is compatible with parent type`, () => {
            it(`${Type.ExtendedTypeKind.LogicalLiteral}`, () => {
                const left: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createLogicalLiteral(false, true),
                ]);

                const right: Type.DefinedList = TypeUtils.createDefinedList(false, [Type.LogicalInstance]);

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.NumberLiteral}`, () => {
                const left: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createNumberLiteral(false, `1`),
                ]);

                const right: Type.DefinedList = TypeUtils.createDefinedList(false, [Type.NumberInstance]);

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.TextLiteral}`, () => {
                const left: Type.DefinedList = TypeUtils.createDefinedList(false, [
                    TypeUtils.createTextLiteral(false, `"foo"`),
                ]);

                const right: Type.DefinedList = TypeUtils.createDefinedList(false, [Type.TextInstance]);

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });
        });

        describe(`null`, () => {
            it(`null is not compatible with non-nullable`, () => {
                const definedList: Type.DefinedList = TypeUtils.createDefinedList(false, []);
                expect(noopIsCompatible(Type.NullInstance, definedList)).to.equal(false, undefined);
            });

            it(`non-nullable is not compatible with null`, () => {
                const definedList: Type.DefinedList = TypeUtils.createDefinedList(false, []);
                expect(noopIsCompatible(definedList, Type.NullInstance)).to.equal(false, undefined);
            });

            it(`null is compatible with nullable`, () => {
                const definedList: Type.DefinedList = TypeUtils.createDefinedList(true, []);
                expect(noopIsCompatible(Type.NullInstance, definedList)).to.equal(true, undefined);
            });
        });
    });

    describe(`${Type.ExtendedTypeKind.DefinedRecord}`, () => {
        describe(`identity`, () => {
            it(`empty`, () => {
                const definedRecord: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), false);
                expect(noopIsCompatible(definedRecord, definedRecord)).to.equal(true, undefined);
            });

            it(`non-empty`, () => {
                const definedRecord: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["number", Type.NumberInstance]]),
                    false,
                );

                expect(noopIsCompatible(definedRecord, definedRecord)).to.equal(true, undefined);
            });
        });

        describe(`field member literal is compatible with parent type`, () => {
            it(`${Type.ExtendedTypeKind.LogicalLiteral}`, () => {
                const left: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["logical", TypeUtils.createLogicalLiteral(false, true)]]),
                    false,
                );

                const right: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["logical", Type.LogicalInstance]]),
                    false,
                );

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.NumberLiteral}`, () => {
                const left: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["number", TypeUtils.createNumberLiteral(false, 1)]]),
                    false,
                );

                const right: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["number", Type.NumberInstance]]),
                    false,
                );

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.TextLiteral}`, () => {
                const left: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["text", TypeUtils.createTextLiteral(false, `""`)]]),
                    false,
                );

                const right: Type.DefinedRecord = TypeUtils.createDefinedRecord(
                    false,
                    new Map([["text", Type.TextInstance]]),
                    false,
                );

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });
        });

        describe(`null`, () => {
            it(`null is not compatible with non-nullable`, () => {
                const definedRecord: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), false);
                expect(noopIsCompatible(Type.NullInstance, definedRecord)).to.equal(false, undefined);
            });

            it(`non-nullable is not compatible with null`, () => {
                const definedRecord: Type.DefinedRecord = TypeUtils.createDefinedRecord(false, new Map(), false);
                expect(noopIsCompatible(definedRecord, Type.NullInstance)).to.equal(false, undefined);
            });

            it(`null is compatible with nullable`, () => {
                const definedRecord: Type.DefinedRecord = TypeUtils.createDefinedRecord(true, new Map(), false);
                expect(noopIsCompatible(Type.NullInstance, definedRecord)).to.equal(true, undefined);
            });
        });
    });

    describe(`${Type.ExtendedTypeKind.DefinedTable}`, () => {
        describe(`identity`, () => {
            it(`empty`, () => {
                const definedTable: Type.DefinedTable = TypeUtils.createDefinedTable(false, new OrderedMap(), false);
                expect(noopIsCompatible(definedTable, definedTable)).to.equal(true, undefined);
            });

            it(`non-empty`, () => {
                const definedTable: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap([["number", Type.NumberInstance]]),
                    false,
                );

                expect(noopIsCompatible(definedTable, definedTable)).to.equal(true, undefined);
            });
        });

        describe(`field member literal is compatible with parent type`, () => {
            it(`${Type.ExtendedTypeKind.LogicalLiteral}`, () => {
                const left: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap([["logical", TypeUtils.createLogicalLiteral(false, true)]]),
                    false,
                );

                const right: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap([["logical", Type.LogicalInstance]]),
                    false,
                );

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.NumberLiteral}`, () => {
                const left: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap([["number", TypeUtils.createNumberLiteral(false, 1)]]),
                    false,
                );

                const right: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap([["number", Type.NumberInstance]]),
                    false,
                );

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });

            it(`${Type.ExtendedTypeKind.TextLiteral}`, () => {
                const left: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap([["text", TypeUtils.createTextLiteral(false, `""`)]]),
                    false,
                );

                const right: Type.DefinedTable = TypeUtils.createDefinedTable(
                    false,
                    new OrderedMap([["text", Type.TextInstance]]),
                    false,
                );

                expect(noopIsCompatible(left, right)).to.equal(true, undefined);
            });
        });

        describe(`null`, () => {
            it(`null is not compatible with non-nullable`, () => {
                const definedTable: Type.DefinedTable = TypeUtils.createDefinedTable(false, new OrderedMap(), false);
                expect(noopIsCompatible(Type.NullInstance, definedTable)).to.equal(false, undefined);
            });

            it(`non-nullable is not compatible with null`, () => {
                const definedTable: Type.DefinedTable = TypeUtils.createDefinedTable(false, new OrderedMap(), false);
                expect(noopIsCompatible(definedTable, Type.NullInstance)).to.equal(false, undefined);
            });

            it(`null is compatible with nullable`, () => {
                const definedTable: Type.DefinedTable = TypeUtils.createDefinedTable(true, new OrderedMap(), false);
                expect(noopIsCompatible(Type.NullInstance, definedTable)).to.equal(true, undefined);
            });
        });
    });

    describe(`literals are compatible with parent type`, () => {
        describe(`${Type.ExtendedTypeKind.LogicalLiteral}`, () => {
            it(`true`, () =>
                expect(noopIsCompatible(Type.TrueInstance, Type.LogicalInstance)).to.equal(true, undefined));

            it(`false`, () =>
                expect(noopIsCompatible(Type.FalseInstance, Type.LogicalInstance)).to.equal(true, undefined));
        });

        describe(`${Type.ExtendedTypeKind.NumberLiteral}`, () => {
            it(`1`, () => {
                expect(noopIsCompatible(TypeUtils.createNumberLiteral(false, `1`), Type.NumberInstance)).to.equal(
                    true,
                    undefined,
                );
            });

            it(`--1`, () => {
                expect(noopIsCompatible(TypeUtils.createNumberLiteral(false, `--1`), Type.NumberInstance)).to.equal(
                    true,
                    undefined,
                );
            });

            it(`+1`, () => {
                expect(noopIsCompatible(TypeUtils.createNumberLiteral(false, `+1`), Type.NumberInstance)).to.equal(
                    true,
                    undefined,
                );
            });
        });

        it(`${Type.ExtendedTypeKind.TextLiteral}`, () => {
            expect(noopIsCompatible(TypeUtils.createTextLiteral(false, `"foo"`), Type.TextInstance)).to.equal(
                true,
                undefined,
            );
        });
    });

    describe(`literals are compatible with literals`, () => {
        it(`1`, () => {
            expect(
                noopIsCompatible(TypeUtils.createNumberLiteral(false, `1`), TypeUtils.createNumberLiteral(false, `1`)),
            ).to.equal(true, undefined);
        });

        it(`"foo"`, () => {
            expect(
                noopIsCompatible(
                    TypeUtils.createTextLiteral(false, `"foo"`),
                    TypeUtils.createTextLiteral(false, `"foo"`),
                ),
            ).to.equal(true, undefined);
        });
    });
});
