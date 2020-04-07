// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../../..";
import { isNever, ResultUtils } from "../../../../common";
import { Position, ScopeItemByKey, ScopeItemKind2 } from "../../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../../inspection/activeNode";
import { Ast, IParserState, NodeIdMap, ParseError, ParseOk } from "../../../../parser";
import { CommonSettings, DefaultSettings, LexSettings, ParseSettings } from "../../../../settings";
import { expectDeepEqual, expectParseErr, expectParseOk, expectTextWithPosition } from "../../../common";

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
}

interface AbridgedSectionMemberScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: ScopeItemKind2.SectionMember;
    readonly keyNodeId: number;
}

interface AbridgedUndefinedScopeItem extends IAbridgedNodeScopeItem {
    readonly kind: ScopeItemKind2.Undefined;
    readonly nodeId: number;
}

function actualFactoryFn(scopeItemByKey: ScopeItemByKey): ReadonlyArray<TAbridgedNodeScopeItem> {
    const result: TAbridgedNodeScopeItem[] = [];

    for (const [identifier, scopeItem] of scopeItemByKey.entries()) {
        let newScopeItem: TAbridgedNodeScopeItem;
        switch (scopeItem.kind) {
            case ScopeItemKind2.Each:
                newScopeItem = {
                    identifier,
                    kind: scopeItem.kind,
                    eachExpressionNodeId: scopeItem.eachExpression.node.id,
                };
                break;

            case ScopeItemKind2.KeyValuePair:
                newScopeItem = {
                    identifier,
                    kind: scopeItem.kind,
                    keyNodeId: scopeItem.key.id,
                    maybeValueNodeId: scopeItem.maybeValue !== undefined ? scopeItem.maybeValue.node.id : undefined,
                };
                break;

            case ScopeItemKind2.Parameter:
                newScopeItem = {
                    identifier,
                    kind: scopeItem.kind,
                    nameNodeId: scopeItem.name.id,
                };
                break;

            case ScopeItemKind2.SectionMember:
                newScopeItem = {
                    identifier,
                    kind: scopeItem.kind,
                    keyNodeId: scopeItem.key.id,
                };
                break;

            case ScopeItemKind2.Undefined:
                newScopeItem = {
                    identifier,
                    kind: scopeItem.kind,
                    nodeId: scopeItem.xorNode.node.id,
                };
                break;

            default:
                throw isNever(scopeItem);
        }

        result.push(newScopeItem);
    }

    return result;
}

function expectScope2ForNodeOk(
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
    return expectScope2ForNodeOk(settings, parseOk.nodeIdMapCollection, parseOk.leafNodeIds, position);
}

export function expectParseErrScope2Ok<S = IParserState>(
    settings: LexSettings & ParseSettings<S & IParserState>,
    text: string,
    position: Position,
): ScopeItemByKey {
    const parseError: ParseError.ParseError<S> = expectParseErr(settings, text);
    return expectScope2ForNodeOk(
        settings,
        parseError.state.contextState.nodeIdMapCollection,
        parseError.state.contextState.leafNodeIds,
        position,
    );
}

describe(`subset Inspection - Scope - Identifier`, () => {
    describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
        it(`|each 1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|each 1`);
            const expected: ReadonlyArray<TAbridgedNodeScopeItem> = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`each| 1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each| 1`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.EachExpression} (ParserContext)`, () => {
        it(`each|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each|`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
        it(`|(x) => z`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) => z`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`(x|, y) => z`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) => z`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`(x, y)| => z`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| => z`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`(x, y) => z|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) => z|`);
            const expected: AbridgedNodeScope = [
                {
                    identifier: "x",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 7,
                },
                {
                    identifier: "y",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 11,
                },
            ];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
        it(`|(x) =>`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) =>`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`(x|, y) =>`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) =>`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`(x, y)| =>`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| =>`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`(x, y) =>|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) =>|`);
            const expected: AbridgedNodeScope = [
                {
                    identifier: "x",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 7,
                },
                {
                    identifier: "y",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 11,
                },
            ];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
        it(`let x = 1, y = x in 1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let x = 1, y = x in 1|`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
        it(`|[a=1]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1]`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[|a=1]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1]`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[a=1|]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|]`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[a=1]|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1]|`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[a=[|b=1]]`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1]]`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
        it(`|[a=1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[|a=1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[a=|1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=|1`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[a=1|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[a=[|b=1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`[a=[b=|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[b=|`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.Section} (Ast)`, () => {
        it(`s|ection foo; x = 1; y = 2;`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `s|ection foo; x = 1; y = 2;`,
            );
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`section foo; x = 1; y = 2;|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `section foo; x = 1; y = 2;|`,
            );
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            ];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
        it(`s|ection foo; x = 1; y = 2`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `s|ection foo; x = 1; y = 2`,
            );
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
        it(`let a = 1 in |x`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |x`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`let a = 1 in x|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in x|`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`let a = |1 in x`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = |1 in x`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`let a = 1, b = 2 in x|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in x|`);
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`let a = 1|, b = 2 in x`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in x`);
            const expected: AbridgedNodeScope = [
                {
                    identifier: "b",
                    kind: ScopeItemKind2.KeyValuePair,
                    keyNodeId: 13,
                    maybeValueNodeId: 16,
                },
            ];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
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
                },
                {
                    identifier: "p2",
                    kind: ScopeItemKind2.Parameter,
                    nameNodeId: 11,
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
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`WIP let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`,
            );
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });

        it(`WIP let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
                `let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`,
            );
            const expected: AbridgedNodeScope = [];
            expectDeepEqual(expectParseOkScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    // describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
    //     it(`let a = 1 in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |`);
    //         const expected: AbridgedNodeScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1, b = 2 in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in |`);
    //         const expected: AbridgedNodeScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1|, b = 2 in`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in `);
    //         const expected: AbridgedNodeScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1, b = 2, c = 3 in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let a = 1, b = 2, c = 3 in |`,
    //         );
    //         const expected: AbridgedNodeScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "c",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let x = (let y = 1 in z|) in`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let x = (let y = 1 in z|) in`,
    //         );
    //         const expected: AbridgedNodeScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "z",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let x = (let y = 1 in z) in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let x = (let y = 1 in z) in |`,
    //         );
    //         const expected: AbridgedNodeScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "x",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });
});
