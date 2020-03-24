// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../../..";
import { Ast } from "../../../../parser";
import { DefaultSettings } from "../../../../settings";
import { Type } from "../../../../type";
import { expectDeepEqual, expectParseOkInspectionOk, expectTextWithPosition } from "../../../common";

type AbridgedScopeType = ReadonlyArray<AbridgedScopeTypeElement | undefined>;

interface AbridgedScopeTypeElement {
    readonly key: number;
    readonly kind: Type.TypeKind;
    readonly maybeExtendedKind: undefined | Type.ExtendedTypeKind;
    readonly isNullable: boolean;
}

function actualFactoryFn(inspected: Inspection.Inspected): AbridgedScopeType {
    return [...inspected.scopeTypeMap.entries()]
        .map(([key, type]) => {
            return {
                key,
                ...type,
            };
        })
        .sort((left, right) => {
            return left.key < right.key ? -1 : 0;
        });
}

function expectTypeConstant(constantKind: Ast.TConstantKind, typeKind: Type.TypeKind, isNullable: boolean): void {
    const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
        `let x = type ${constantKind} in y|`,
    );
    const expected: AbridgedScopeType = [];
    expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
}

describe(`Inspection - Scope - Type`, () => {
    describe(`Constant`, () => {
        it(`action`, () => {
            expectTypeConstant(Ast.PrimitiveTypeConstantKind.Action, Type.TypeKind.Action, false);
        });

        // it(`any`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Any, Type.TypeKind.Any, true);
        // });

        // it(`anynonnull`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.AnyNonNull, Type.TypeKind.AnyNonNull, false);
        // });

        // it(`binary`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Binary, Type.TypeKind.Binary, false);
        // });

        // it(`date`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Date, Type.TypeKind.Date, false);
        // });

        // it(`datetime`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.DateTime, Type.TypeKind.DateTime, false);
        // });

        // it(`datetimezone`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.DateTimeZone, Type.TypeKind.DateTimeZone, false);
        // });

        // it(`duration`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Duration, Type.TypeKind.Duration, false);
        // });

        // it(`function`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Function, Type.TypeKind.Function, false);
        // });

        // it(`list`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.List, Type.TypeKind.List, false);
        // });

        // it(`logical`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Logical, Type.TypeKind.Logical, false);
        // });

        // it(`none`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.None, Type.TypeKind.None, false);
        // });

        // it(`null`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Null, Type.TypeKind.Null, true);
        // });

        // it(`number`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Number, Type.TypeKind.Number, false);
        // });

        // it(`record`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Record, Type.TypeKind.Record, false);
        // });

        // it(`table`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Table, Type.TypeKind.Table, false);
        // });

        // it(`text`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Text, Type.TypeKind.Text, false);
        // });

        // it(`time`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Time, Type.TypeKind.Time, false);
        // });

        // it(`type`, () => {
        //     expectTypeConstant(Ast.PrimitiveTypeConstantKind.Type, Type.TypeKind.Type, false);
        // });
    });

    describe("literal", () => {
        // it(`true`, () => {
        //     const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`true|`);
        //     const expected: AbridgedScopeType = [
        //         {
        //             key: 2,
        //             kind: Type.TypeKind.Logical,
        //             maybeExtendedKind: undefined,
        //             isNullable: false,
        //         },
        //     ];
        //     expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        // });
        // it(`false`, () => {
        //     const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`false|`);
        //     const expected: AbridgedScopeType = [
        //         {
        //             key: 2,
        //             kind: Type.TypeKind.Logical,
        //             maybeExtendedKind: undefined,
        //             isNullable: false,
        //         },
        //     ];
        //     expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        // });
        // it(`1`, () => {
        //     const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`1|`);
        //     const expected: AbridgedScopeType = [
        //         {
        //             key: 2,
        //             kind: Type.TypeKind.Number,
        //             maybeExtendedKind: undefined,
        //             isNullable: false,
        //         },
        //     ];
        //     expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        // });
        // it(`null`, () => {
        //     const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`null|`);
        //     const expected: AbridgedScopeType = [
        //         {
        //             key: 2,
        //             kind: Type.TypeKind.Null,
        //             maybeExtendedKind: undefined,
        //             isNullable: false,
        //         },
        //     ];
        //     expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        // });
    });

    // describe("BinOpExpression", () => {
    //     it(`1 + 1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`1 + 1|`);
    //         const expected: AbridgedScopeType = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });
});
