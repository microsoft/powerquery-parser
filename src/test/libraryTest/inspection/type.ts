// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../..";
import { CommonError, Result, ResultUtils } from "../../../common";
import { Position, ScopeItemByKey, ScopeTypeMap, TriedInspectScopeType } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { IParserState, NodeIdMap, ParseOk } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { Type } from "../../../type";
import { expectDeepEqual, expectParseOk, expectTextWithPosition } from "../../common";

type AbridgedScopeType = ReadonlyArray<AbridgedScopeTypeElement | undefined>;

interface AbridgedScopeTypeElement {
    readonly key: string;
    readonly kind: Type.TypeKind;
    readonly maybeExtendedKind: undefined | Type.ExtendedTypeKind;
    readonly isNullable: boolean;
}

function expectScopeTypeOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): ScopeTypeMap {
    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (!(maybeActiveNode !== undefined)) {
        throw new Error(`AssertedFailed: maybeActiveNode !== undefined`);
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const triedScope: Result<ScopeItemByKey, CommonError.CommonError> = Inspection.tryInspectScopeForRoot(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        activeNode.ancestry,
        undefined,
    );
    if (!ResultUtils.isOk(triedScope)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedScope) - ${triedScope.error}`);
    }

    const triedScopeType: TriedInspectScopeType = Inspection.tryInspectScopeType(
        settings,
        nodeIdMapCollection,
        triedScope.value,
    );
    if (!ResultUtils.isOk(triedScopeType)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedScopeType) - ${triedScopeType.error}`);
    }

    return triedScopeType.value;
}

function expectParseOkScopeTypeOk<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position,
): ScopeTypeMap {
    const parseOk: ParseOk<S> = expectParseOk(settings, text);
    return expectScopeTypeOk(settings, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, position);
}

// function expectParseErrScopeTypeOk<S = IParserState>(
//     settings: LexSettings & ParseSettings<S & IParserState>,
//     text: string,
//     position: Position,
// ): ScopeTypeMap {
//     const parseError: ParseError.ParseError<S> = expectParseErr(settings, text);
//     return expectScopeTypeOk(
//         settings,
//         parseError.state.contextState.nodeIdMapCollection,
//         parseError.state.contextState.leafNodeIds,
//         position,
//     );
// }

function actualFactoryFn(inspected: ScopeTypeMap): AbridgedScopeType {
    return [...inspected.entries()]
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
    expectDeepEqual(expectParseOkScopeTypeOk(DefaultSettings, text, position), expected, actualFactoryFn);
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

        it(`{}`, () => {
            expectExpressionType("{}", Type.TypeKind.List, false);
        });

        it(`[]`, () => {
            expectExpressionType("[]", Type.TypeKind.Record, false);
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

    describe("UnaryExpression", () => {
        it(`+1`, () => {
            expectExpressionType(`+1`, Type.TypeKind.Number, false);
        });

        it(`-1`, () => {
            expectExpressionType(`-1`, Type.TypeKind.Number, false);
        });

        it(`not true`, () => {
            expectExpressionType(`not true`, Type.TypeKind.Logical, false);
        });

        it(`not false`, () => {
            expectExpressionType(`not false`, Type.TypeKind.Logical, false);
        });

        it(`not 1`, () => {
            expectExpressionType(`not 1`, Type.TypeKind.None, false);
        });

        it(`+true`, () => {
            expectExpressionType(`+true`, Type.TypeKind.None, false);
        });
    });
});
