// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../..";
import { ResultUtils } from "../../../common";
import { ScopeItemKind } from "../../../inspection";
import { Ast } from "../../../parser";
import { expectDeepEqual, expectParseOkInspection, expectTextWithPosition } from "../../common";

type AbridgedScope = ReadonlyArray<AbridgedParameterItem | undefined>;

interface AbridgedParameterItem {
    readonly key: string;
    readonly isNullable: boolean;
    readonly maybeType: Ast.TConstantKind | undefined;
}

function actualFactoryFn(triedInspection: Inspection.TriedInspection): AbridgedScope {
    if (!ResultUtils.isOk(triedInspection)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedInspection): ${triedInspection.error.message}`);
    }
    const inspected: Inspection.Inspected = triedInspection.value;

    const abridgedScopeItems: AbridgedParameterItem[] = [];
    for (const [key, scopeItem] of inspected.scope.entries()) {
        if (scopeItem.kind === ScopeItemKind.Parameter) {
            abridgedScopeItems.push({
                key,
                isNullable: scopeItem.isOptional,
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
                isNullable: true,
                maybeType: undefined,
            },
            {
                key: "b",
                isNullable: true,
                maybeType: Ast.PrimitiveTypeConstantKind.Number,
            },
            {
                key: "c",
                isNullable: true,
                maybeType: Ast.PrimitiveTypeConstantKind.Function,
            },
            {
                key: "d",
                isNullable: false,
                maybeType: undefined,
            },
            {
                key: "e",
                isNullable: false,
                maybeType: Ast.PrimitiveTypeConstantKind.Table,
            },
        ];
        expectDeepEqual(expectParseOkInspection(text, position), expected, actualFactoryFn);
    });
});
