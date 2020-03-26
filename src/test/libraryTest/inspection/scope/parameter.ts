// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../../..";
import { ScopeItemKind } from "../../../../inspection";
import { Ast } from "../../../../parser";
import { DefaultSettings } from "../../../../settings";
import { expectDeepEqual, expectParseOkInspectionOk, expectTextWithPosition } from "../../../common";

type AbridgedScope = ReadonlyArray<AbridgedParameterItem | undefined>;

interface AbridgedParameterItem {
    readonly key: string;
    readonly isOptional: boolean;
    readonly isNullable: boolean;
    readonly maybeType: Ast.TConstantKind | undefined;
}

function actualFactoryFn(inspected: Inspection.Inspected): AbridgedScope {
    const abridgedScopeItems: AbridgedParameterItem[] = [];

    for (const [key, scopeItem] of inspected.scope.entries()) {
        if (scopeItem.kind === ScopeItemKind.Parameter) {
            abridgedScopeItems.push({
                key,
                isOptional: scopeItem.isOptional,
                isNullable: scopeItem.isNullable,
                maybeType: scopeItem.maybeType,
            });
        }
    }

    return abridgedScopeItems;
}

describe(`Inspection - Scope - Parameter`, () => {
    it(`(a, b as number, c as nullable function, optional d, optional e as table) => 1|`, () => {
        const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
            `(a, b as number, c as nullable function, optional d, optional e as table) => 1|`,
        );
        const expected: AbridgedScope = [
            {
                key: "a",
                isOptional: false,
                isNullable: true,
                maybeType: undefined,
            },
            {
                key: "b",
                isOptional: false,
                isNullable: false,
                maybeType: Ast.PrimitiveTypeConstantKind.Number,
            },
            {
                key: "c",
                isOptional: false,
                isNullable: true,
                maybeType: Ast.PrimitiveTypeConstantKind.Function,
            },
            {
                key: "d",
                isOptional: true,
                isNullable: true,
                maybeType: undefined,
            },
            {
                key: "e",
                isOptional: true,
                isNullable: false,
                maybeType: Ast.PrimitiveTypeConstantKind.Table,
            },
        ];
        expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    });
});
