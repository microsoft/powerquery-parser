// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../../..";
import { DefaultSettings } from "../../../../settings";
import { Type } from "../../../../type";
import { expectDeepEqual, expectParseOkInspectionOk, expectTextWithPosition } from "../../../common";

type AbridgedScopeType = ReadonlyArray<AbridgedScopeTypeElement | undefined>;

interface AbridgedScopeTypeElement {
    readonly key: string;
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
        .sort();
}

function expectExpressionType(expression: string, kind: Type.TypeKind, isNullable: boolean): void {
    const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = ${expression} in x|`);
    const expected: AbridgedScopeType = [
        {
            key: "x",
            kind,
            maybeExtendedKind: undefined,
            isNullable,
        },
    ];
    expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
}

describe(`Inspection - Scope - Type`, () => {
    describe("literal", () => {
        it(`true`, () => {
            expectExpressionType("true", Type.TypeKind.Logical, false);
        });
        it(`false`, () => {
            expectExpressionType("false", Type.TypeKind.Logical, false);
        });
        it(`1`, () => {
            expectExpressionType("1", Type.TypeKind.Number, false);
        });
        it(`null`, () => {
            expectExpressionType("null", Type.TypeKind.Null, true);
        });
    });

    describe("BinOpExpression", () => {
        it(`1 + 1`, () => {
            expectExpressionType(`1 + 1`, Type.TypeKind.Number, false);
        });

        it(`true and false`, () => {
            expectExpressionType(`true and false`, Type.TypeKind.Logical, false);
        });

        it(`"hello" & "world"`, () => {
            expectExpressionType(`"hello" & "world"`, Type.TypeKind.Text, false);
        });

        it(`true + 1`, () => {
            expectExpressionType(`true + 1`, Type.TypeKind.None, false);
        });
    });
});
