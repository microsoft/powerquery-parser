// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../..";
import { CommonError, Result, ResultUtils } from "../../../common";
import { Position, ScopeItemByKey, ScopeTypeMap, TriedScopeType } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast } from "../../../language";
import { IParserState, NodeIdMap, ParseError, ParseOk } from "../../../parser";
import { CommonSettings, DefaultSettings } from "../../../settings";
import { Type } from "../../../type";
import { expectDeepEqual, expectParseErr, expectParseOk, expectTextWithPosition } from "../../common";

type AbridgedScopeType = ReadonlyArray<[string, Type.TType] | undefined>;

function expectScopeTypeOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): ScopeTypeMap {
    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        nodeIdMapCollection,
        leafNodeIds,
        position,
    );
    if (!(maybeActiveNode !== undefined)) {
        throw new Error(`AssertedFailed: maybeActiveNode !== undefined`);
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const triedScope: Result<ScopeItemByKey, CommonError.CommonError> = Inspection.tryScopeForRoot(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        activeNode.ancestry,
        undefined,
    );
    if (!ResultUtils.isOk(triedScope)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedScope) - ${triedScope.error}`);
    }

    const triedScopeType: TriedScopeType = Inspection.tryScopeType(settings, nodeIdMapCollection, triedScope.value);
    if (!ResultUtils.isOk(triedScopeType)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedScopeType) - ${triedScopeType.error}`);
    }

    return triedScopeType.value;
}

function actualFactoryFn(inspected: ScopeTypeMap): AbridgedScopeType {
    return [...inspected.entries()].sort();
}

function wrapExpression(expression: string): string {
    return `let __ignore = ${expression} in |_`;
}

function expectParseOkTypeOk(expression: string, expected: AbridgedScopeType): void {
    const [text, position]: [string, Inspection.Position] = expectTextWithPosition(wrapExpression(expression));
    const parseOk: ParseOk<IParserState> = expectParseOk(DefaultSettings, text);
    const scopeTypeMap: ScopeTypeMap = expectTypeOk(
        DefaultSettings,
        parseOk.nodeIdMapCollection,
        parseOk.leafNodeIds,
        position,
    );
    expectDeepEqual(scopeTypeMap, expected, actualFactoryFn);
}

function expectParseErrTypeOk(expression: string, expected: AbridgedScopeType): void {
    const [text, position]: [string, Inspection.Position] = expectTextWithPosition(wrapExpression(expression));
    const parseErr: ParseError.ParseError<IParserState> = expectParseErr(DefaultSettings, text);
    const scopeTypeMap: ScopeTypeMap = expectTypeOk(
        DefaultSettings,
        parseErr.state.contextState.nodeIdMapCollection,
        parseErr.state.contextState.leafNodeIds,
        position,
    );
    expectDeepEqual(scopeTypeMap, expected, actualFactoryFn);
}

function expectTypeOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): ScopeTypeMap {
    return expectScopeTypeOk(settings, nodeIdMapCollection, leafNodeIds, position);
}

function expectSimpleExpressionType(expression: string, kind: Type.TypeKind, isNullable: boolean): void {
    const expected: AbridgedScopeType = [
        [
            "__ignore",
            {
                kind,
                maybeExtendedKind: undefined,
                isNullable,
            },
        ],
    ];
    expectParseOkTypeOk(expression, expected);
}

describe(`Inspection - Scope - Type`, () => {
    describe("BinOpExpression", () => {
        it(`1 + 1`, () => {
            expectSimpleExpressionType(`1 + 1`, Type.TypeKind.Number, false);
        });

        it(`true and false`, () => {
            expectSimpleExpressionType(`true and false`, Type.TypeKind.Logical, false);
        });

        it(`"hello" & "world"`, () => {
            expectSimpleExpressionType(`"hello" & "world"`, Type.TypeKind.Text, false);
        });

        it(`true + 1`, () => {
            expectSimpleExpressionType(`true + 1`, Type.TypeKind.None, false);
        });
    });

    describe(`${Ast.NodeKind.LiteralExpression}`, () => {
        it(`true`, () => {
            expectSimpleExpressionType("true", Type.TypeKind.Logical, false);
        });

        it(`false`, () => {
            expectSimpleExpressionType("false", Type.TypeKind.Logical, false);
        });

        it(`1`, () => {
            expectSimpleExpressionType("1", Type.TypeKind.Number, false);
        });

        it(`null`, () => {
            expectSimpleExpressionType("null", Type.TypeKind.Null, true);
        });

        it(`{}`, () => {
            expectSimpleExpressionType("{}", Type.TypeKind.List, false);
        });

        it(`[]`, () => {
            expectSimpleExpressionType("[]", Type.TypeKind.Record, false);
        });
    });

    describe(`WIP ${Ast.NodeKind.IfExpression}`, () => {
        it(`if true then 1 else false`, () => {
            const expression: string = `if true then 1 else false`;
            const expected: AbridgedScopeType = [
                [
                    "__ignore",
                    {
                        kind: Type.TypeKind.Any,
                        maybeExtendedKind: Type.ExtendedTypeKind.AnyUnion,
                        isNullable: false,
                        unionedTypePairs: [
                            {
                                kind: Type.TypeKind.Number,
                                maybeExtendedKind: undefined,
                                isNullable: false,
                            },
                            {
                                kind: Type.TypeKind.Logical,
                                maybeExtendedKind: undefined,
                                isNullable: false,
                            },
                        ],
                    },
                ],
            ];
            expectParseOkTypeOk(expression, expected);
        });

        it(`if if true then true else false then 1 else 0`, () => {
            const expression: string = `if if true then true else false then 1 else 0`;
            const expected: AbridgedScopeType = [];
            expectParseOkTypeOk(expression, expected);
        });

        it(`if`, () => {
            const expression: string = `if`;
            const expected: AbridgedScopeType = [];
            expectParseErrTypeOk(expression, expected);
        });

        it(`if true then 1`, () => {
            const expression: string = `if true then 1`;
            const expected: AbridgedScopeType = [];
            expectParseErrTypeOk(expression, expected);
        });
    });

    describe(`${Ast.NodeKind.UnaryExpression}`, () => {
        it(`+1`, () => {
            expectSimpleExpressionType(`+1`, Type.TypeKind.Number, false);
        });

        it(`-1`, () => {
            expectSimpleExpressionType(`-1`, Type.TypeKind.Number, false);
        });

        it(`not true`, () => {
            expectSimpleExpressionType(`not true`, Type.TypeKind.Logical, false);
        });

        it(`not false`, () => {
            expectSimpleExpressionType(`not false`, Type.TypeKind.Logical, false);
        });

        it(`not 1`, () => {
            expectSimpleExpressionType(`not 1`, Type.TypeKind.None, false);
        });

        it(`+true`, () => {
            expectSimpleExpressionType(`+true`, Type.TypeKind.None, false);
        });
    });
});
