// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../../..";
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

describe(`Inspection - Scope - Type`, () => {
    describe(`Constant`, () => {
        it(`action`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`type action|`);
            const expected: AbridgedScopeType = [
                {
                    key: 5,
                    kind: Type.TypeKind.Action,
                    maybeExtendedKind: undefined,
                    isNullable: false,
                },
            ];
            expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`any`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`type any|`);
            const expected: AbridgedScopeType = [
                {
                    key: 5,
                    kind: Type.TypeKind.Any,
                    maybeExtendedKind: undefined,
                    isNullable: true,
                },
            ];
            expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`anynonnull`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`type anynonnull|`);
            const expected: AbridgedScopeType = [
                {
                    key: 5,
                    kind: Type.TypeKind.AnyNonNull,
                    maybeExtendedKind: undefined,
                    isNullable: false,
                },
            ];
            expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`true`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`true|`);
            const expected: AbridgedScopeType = [
                {
                    key: 2,
                    kind: Type.TypeKind.Logical,
                    maybeExtendedKind: undefined,
                    isNullable: false,
                },
            ];
            expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`false`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`false|`);
            const expected: AbridgedScopeType = [
                {
                    key: 2,
                    kind: Type.TypeKind.Logical,
                    maybeExtendedKind: undefined,
                    isNullable: false,
                },
            ];
            expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });
});
