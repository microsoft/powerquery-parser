// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../..";
import { isNever, ResultUtils } from "../../../common";
import { Position, ScopeItemByKey, ScopeItemKind2, ParameterScopeItem2 } from "../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../inspection/activeNode";
import { Ast, IParserState, NodeIdMap, ParseError, ParseOk } from "../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../settings";
import { expectDeepEqual, expectParseErr, expectParseOk, expectTextWithPosition } from "../../common";

export type TAbridgedNodeScopeItem =
    | AbridgedEachScopeItem
    | AbridgedKeyValuePairScopeItem
    | AbridgedParameterScopeItem
    | AbridgedSectionMemberScopeItem
    | AbridgedUndefinedScopeItem;

type AbridgedNodeScope = ReadonlyArray<TAbridgedNodeScopeItem>;

interface IAbridgedNodeScopeItem {
    readonly identifier: string;
    readonly kind: ScopeItemKind2;
}

interface AbridgedEachScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: ScopeItemKind2.Each;
    readonly eachExpressionNodeId: number;
}

interface AbridgedKeyValuePairScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: ScopeItemKind2.KeyValuePair;
    readonly keyNodeId: number;
    readonly maybeValueNodeId: undefined | number;
}

interface AbridgedParameterScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: ScopeItemKind2.Parameter;
    readonly nameNodeId: number;
    readonly isNullable: boolean;
    readonly isOptional: boolean;
    readonly maybeType: Ast.PrimitiveTypeConstantKind | undefined;
}

interface AbridgedSectionMemberScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: ScopeItemKind2.SectionMember;
    readonly keyNodeId: number;
}

interface AbridgedUndefinedScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: ScopeItemKind2.Undefined;
    readonly nodeId: number;
}

function abridgedScopeItemFrom(identifier: string, scopeItem: Inspection.TScopeItem2): TAbridgedNodeScopeItem {
    switch (scopeItem.kind) {
        case ScopeItemKind2.Each:
            return {
                identifier,
                kind: scopeItem.kind,
                eachExpressionNodeId: scopeItem.eachExpression.node.id,
            };

        case ScopeItemKind2.KeyValuePair:
            return {
                identifier,
                kind: scopeItem.kind,
                keyNodeId: scopeItem.key.id,
                maybeValueNodeId: scopeItem.maybeValue !== undefined ? scopeItem.maybeValue.node.id : undefined,
            };

        case ScopeItemKind2.Parameter:
            return {
                identifier,
                kind: scopeItem.kind,
                nameNodeId: scopeItem.name.id,
                isNullable: scopeItem.isNullable,
                isOptional: scopeItem.isOptional,
                maybeType: scopeItem.maybeType,
            };

        case ScopeItemKind2.SectionMember:
            return {
                identifier,
                kind: scopeItem.kind,
                keyNodeId: scopeItem.key.id,
            };

        case ScopeItemKind2.Undefined:
            return {
                identifier,
                kind: scopeItem.kind,
                nodeId: scopeItem.xorNode.node.id,
            };

        default:
            throw isNever(scopeItem);
    }
}

function actualScopeFactoryFn(scopeItemByKey: ScopeItemByKey): ReadonlyArray<TAbridgedNodeScopeItem> {
    const result: TAbridgedNodeScopeItem[] = [];

    for (const [identifier, scopeItem] of scopeItemByKey.entries()) {
        result.push(abridgedScopeItemFrom(identifier, scopeItem));
    }

    return result;
}

function actualParameterFactoryFn(scopeItemByKey: ScopeItemByKey): ReadonlyArray<AbridgedParameterScopeItem> {
    const result: AbridgedParameterScopeItem[] = [];

    for (const [identifier, scopeItem] of scopeItemByKey.entries()) {
        const abridged: TAbridgedNodeScopeItem = abridgedScopeItemFrom(identifier, scopeItem);
        if (abridged.kind === ScopeItemKind2.Parameter) {
            result.push(abridged);
        }
    }

    return result;
}

function expectScopeForNodeOk(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): ScopeItemByKey {
    const maybeActiveNode: undefined | ActiveNode = ActiveNodeUtils.maybeActiveNode(
        position,
        nodeIdMapCollection,
        leafNodeIds,
    );
    if (maybeActiveNode === undefined) {
        return new Map();
    }
    const activeNode: ActiveNode = maybeActiveNode;

    const triedScopeInspection: Inspection.TriedNodeScopeInspection = Inspection.tryInspectScope2ForNode(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        activeNode.ancestry[0].node.id,
        undefined,
    );
    if (!ResultUtils.isOk(triedScopeInspection)) {
        throw new Error(`AssertFailed: ResultUtils.isOk(triedScopeInspection): ${triedScopeInspection.error.message}`);
    }
    return triedScopeInspection.value;
}

export function expectParseOkScope2Ok<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position,
): ScopeItemByKey {
    const parseOk: ParseOk<S> = expectParseOk(settings, text);
    return expectScopeForNodeOk(settings, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, position);
}

export function expectParseErrScope2Ok<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position,
): ScopeItemByKey {
    const parseError: ParseError.ParseError<S> = expectParseErr(settings, text);
    return expectScopeForNodeOk(
        settings,
        parseError.state.contextState.nodeIdMapCollection,
        parseError.state.contextState.leafNodeIds,
        position,
    );
}

describe(`subset Inspection - Scope - Identifier`, () => {
    describe(`Scope`, () => {
        describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
            it(`|each 1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|each 1`);
                const expected: ReadonlyArray<TAbridgedNodeScopeItem> = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`each| 1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each| 1`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`each |1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each |1`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        kind: ScopeItemKind2.Each,
                        eachExpressionNodeId: 1,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`each 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each 1|`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        kind: ScopeItemKind2.Each,
                        eachExpressionNodeId: 1,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`each each 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each each 1|`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        kind: ScopeItemKind2.Each,
                        eachExpressionNodeId: 3,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });
        });

        describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
            it(`each|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each|`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`each |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each |`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "_",
                        kind: ScopeItemKind2.Each,
                        eachExpressionNodeId: 1,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
            it(`|(x) => z`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) => z`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`(x|, y) => z`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) => z`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`(x, y)| => z`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| => z`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`(x, y) => z|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) => z|`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.Parameter,
                        nameNodeId: 7,
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                    {
                        identifier: "y",
                        kind: ScopeItemKind2.Parameter,
                        nameNodeId: 11,
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });
        });

        describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
            it(`|(x) =>`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) =>`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`(x|, y) =>`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) =>`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`(x, y)| =>`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| =>`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`(x, y) =>|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) =>|`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.Parameter,
                        nameNodeId: 7,
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                    {
                        identifier: "y",
                        kind: ScopeItemKind2.Parameter,
                        nameNodeId: 11,
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });
        });

        describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
            it(`let x = 1, y = x in 1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = 1, y = x in 1|`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 9,
                    },
                    {
                        identifier: "y",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 13,
                        maybeValueNodeId: 16,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
            it(`|[a=1]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1]`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`[|a=1]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1]`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`[a=1|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|]`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`[a=1, b=2|]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|]`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 7,
                        maybeValueNodeId: 10,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`[a=1, b=2|, c=3]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3]`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 7,
                        maybeValueNodeId: 10,
                    },
                    {
                        identifier: "c",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 21,
                        maybeValueNodeId: 24,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`[a=1]|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1]|`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`[a=[|b=1]]`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1]]`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });
        });

        describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
            it(`|[a=1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`[|a=1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`[a=|1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=|1`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`[a=1|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`[a=1, b=|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=|`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 7,
                        maybeValueNodeId: 9,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`[a=1, b=2|, c=3`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 7,
                        maybeValueNodeId: 9,
                    },
                    {
                        identifier: "c",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 19,
                        maybeValueNodeId: 21,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`[a=[|b=1`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`[a=[b=|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[b=|`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });
        });

        describe(`${Ast.NodeKind.Section} (Ast)`, () => {
            it(`s|ection foo; x = 1; y = 2;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `s|ection foo; x = 1; y = 2;`,
                );
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`section foo; x = 1|; y = 2;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1|; y = 2;`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "y",
                        kind: ScopeItemKind2.SectionMember,
                        keyNodeId: 15,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`section foo; x = 1; y = 2|;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2|;`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.SectionMember,
                        keyNodeId: 8,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`section foo; x = 1; y = 2;|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2;|`,
                );
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`section foo; x = 1; y = 2; z = let a = 1 in |b;`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2; z = let a = 1 in |b;`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.SectionMember,
                        keyNodeId: 8,
                    },
                    {
                        identifier: "y",
                        kind: ScopeItemKind2.SectionMember,
                        keyNodeId: 15,
                    },
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 29,
                        maybeValueNodeId: 32,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });
        });

        describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
            it(`s|ection foo; x = 1; y = 2`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `s|ection foo; x = 1; y = 2`,
                );
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`section foo; x = 1|; y = 2`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1|; y = 2`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "y",
                        kind: ScopeItemKind2.SectionMember,
                        keyNodeId: 15,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`section foo; x = 1; y = 2|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = 2|`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.SectionMember,
                        keyNodeId: 8,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`section foo; x = 1; y = () => 10|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `section foo; x = 1; y = () => 10|`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.SectionMember,
                        keyNodeId: 8,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
            it(`let a = 1 in |x`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |x`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 9,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`let a = 1 in x|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in x|`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 9,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`let a = |1 in x`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = |1 in x`);
                const expected: AbridgedNodeScope = [];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`let a = 1, b = 2 in x|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let a = 1, b = 2 in x|`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 9,
                    },
                    {
                        identifier: "b",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 13,
                        maybeValueNodeId: 16,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`let a = 1|, b = 2 in x`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let a = 1|, b = 2 in x`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "b",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 13,
                        maybeValueNodeId: 16,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `(p1, p2) => let a = 1, b = 2, c = 3| in c`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "p1",
                        kind: ScopeItemKind2.Parameter,
                        nameNodeId: 7,
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                    {
                        identifier: "p2",
                        kind: ScopeItemKind2.Parameter,
                        nameNodeId: 11,
                        isNullable: true,
                        isOptional: false,
                        maybeType: undefined,
                    },
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 19,
                        maybeValueNodeId: 22,
                    },
                    {
                        identifier: "b",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 26,
                        maybeValueNodeId: 29,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "eggs",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 8,
                    },
                    {
                        identifier: "foo",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 23,
                        maybeValueNodeId: 26,
                    },
                    {
                        identifier: "bar",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 30,
                        maybeValueNodeId: 33,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });

            it(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "foo",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 23,
                        maybeValueNodeId: 26,
                    },
                    {
                        identifier: "bar",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 30,
                        maybeValueNodeId: 33,
                    },
                    {
                        identifier: "ham",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 13,
                        maybeValueNodeId: 16,
                    },
                ];
                expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualScopeFactoryFn);
            });
        });

        describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
            it(`let a = 1 in |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 9,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`let a = 1, b = 2 in |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in |`);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "a",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 9,
                    },
                    {
                        identifier: "b",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 13,
                        maybeValueNodeId: 16,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`let a = 1|, b = 2 in`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in `);
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "b",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 13,
                        maybeValueNodeId: 16,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`let x = (let y = 1 in z|) in`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = (let y = 1 in z|) in`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "y",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 16,
                        maybeValueNodeId: 19,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });

            it(`let x = (let y = 1 in z) in |`, () => {
                const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                    `let x = (let y = 1 in z) in |`,
                );
                const expected: AbridgedNodeScope = [
                    {
                        identifier: "x",
                        kind: ScopeItemKind2.KeyValuePair,
                        keyNodeId: 6,
                        maybeValueNodeId: 9,
                    },
                ];
                expectDeepEqual(
                    expectParseErrScope2Ok(DefaultSettings, text, position),
                    expected,
                    actualScopeFactoryFn,
                );
            });
        });
    });

    describe(`Parameter`, () => {
        it(`(a, b as number, c as nullable function, optional d, optional e as table) => 1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `(a, b as number, c as nullable function, optional d, optional e as table) => 1|`,
            );
            const expected: ReadonlyArray<AbridgedParameterScopeItem> = [
                {
                    identifier: "a",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 7,
                    isNullable: true,
                    isOptional: false,
                    maybeType: undefined,
                },
                {
                    identifier: "b",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 11,
                    isNullable: false,
                    isOptional: false,
                    maybeType: Ast.PrimitiveTypeConstantKind.Number,
                },
                {
                    identifier: "c",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 19,
                    isNullable: true,
                    isOptional: false,
                    maybeType: Ast.PrimitiveTypeConstantKind.Function,
                },
                {
                    identifier: "d",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 30,
                    isNullable: true,
                    isOptional: true,
                    maybeType: undefined,
                },
                {
                    identifier: "e",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 35,
                    isNullable: false,
                    isOptional: true,
                    maybeType: Ast.PrimitiveTypeConstantKind.Table,
                },
            ];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualParameterFactoryFn);
        });
    });
});
