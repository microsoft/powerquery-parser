// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { Inspection } from "../../../..";
import { isNever, ResultUtils } from "../../../../common";
import { Position, ScopeById, ScopeItemKind2, ScopeItemByKey } from "../../../../inspection";
import { ActiveNode, ActiveNodeUtils } from "../../../../inspection/activeNode";
import { Ast, IParserState, NodeIdMap, ParseOk, ParseError } from "../../../../parser";
import { DefaultSettings, LexSettings, ParseSettings, CommonSettings } from "../../../../settings";
import { expectDeepEqual, expectParseOk, expectTextWithPosition, expectParseErr } from "../../../common";

export type TAbridgedScopeItem =
    | AbridgedEachScopeItem
    | AbridgedKeyValuePairScopeItem
    | AbridgedParameterScopeItem
    | AbridgedSectionMemberScopeItem
    | AbridgedUndefinedScopeItem;

type AbridgedNodeScope = ReadonlyArray<TAbridgedScopeItem>;

interface IAbridgedScopeItem {
    readonly identifier: string;
    readonly kind: ScopeItemKind2;
}

interface AbridgedEachScopeItem extends IAbridgedScopeItem {
    readonly kind: ScopeItemKind2.Each;
    readonly eachExpressionNodeId: number;
}

interface AbridgedKeyValuePairScopeItem extends IAbridgedScopeItem {
    readonly kind: ScopeItemKind2.KeyValuePair;
    readonly keyNodeId: number;
    readonly maybeValueNodeId: undefined | number;
}

interface AbridgedParameterScopeItem extends IAbridgedScopeItem {
    readonly kind: ScopeItemKind2.Parameter;
    readonly nameNodeId: number;
}

interface AbridgedSectionMemberScopeItem extends IAbridgedScopeItem {
    readonly kind: ScopeItemKind2.SectionMember;
    readonly keyNodeId: number;
}

interface AbridgedUndefinedScopeItem extends IAbridgedScopeItem {
    readonly kind: ScopeItemKind2.Undefined;
    readonly nodeId: number;
}

function actualFactoryFn(scopeItemByKey: ScopeItemByKey): ReadonlyArray<TAbridgedScopeItem> {
    const result: TAbridgedScopeItem[] = [];

    for (const [identifier, scopeItem] of scopeItemByKey.entries()) {
        let newScopeItem: TAbridgedScopeItem;
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
        throw new Error(`AssertFailed: maybeActiveNode !== undefined`);
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

describe(`Inspection - Scope - Identifier`, () => {
    describe(`${Ast.NodeKind.EachExpression} (Ast)`, () => {
        it(`|each 1`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|each 1`);
            const expected: ReadonlyArray<TAbridgedScopeItem> = [];
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

        it(`abc123 each |`, () => {
            const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`each |`);
            const expected: AbridgedNodeScope = [
                {
                    identifier: "_",
                    kind: ScopeItemKind2.Each,
                    eachExpressionNodeId: 3,
                },
            ];
            expectDeepEqual(expectParseErrScope2Ok(DefaultSettings, text, position), expected, actualFactoryFn);
        });
    });

    // describe(`${Ast.NodeKind.FunctionExpression} (Ast)`, () => {
    //     it(`|(x) => z`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) => z`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`(x|, y) => z`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) => z`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`(x, y)| => z`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| => z`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`(x, y) => z|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) => z|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "z",
    //             },
    //             {
    //                 kind: ScopeItemKind.Parameter,
    //                 key: "x",
    //             },
    //             {
    //                 kind: ScopeItemKind.Parameter,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.FunctionExpression} (ParserContext)`, () => {
    //     it(`|(x) =>`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|(x) =>`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`(x|, y) =>`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x|, y) =>`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`(x, y)| =>`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y)| =>`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`(x, y) =>|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`(x, y) =>|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Parameter,
    //                 key: "x",
    //             },
    //             {
    //                 kind: ScopeItemKind.Parameter,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.IdentifierExpression} (Ast)`, () => {
    //     it(`|foo`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`f|oo`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`f|oo`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "foo",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "foo",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`|@foo`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|@foo`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`@|foo`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@|foo`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "@foo",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`@f|oo`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@f|oo`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "@foo",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`@foo|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`@foo|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "@foo",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.InvokeExpression} (Ast)`, () => {
    //     it(`|foo(x)`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo(x)`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo(x, y|)`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y|)`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo(x, y)|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y)|`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[x](y|)`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[x](y|)`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo(|)`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|)`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.InvokeExpression} (ParserContext)`, () => {
    //     it(`|foo(x`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|foo(x`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo(x, y|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, y|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo(|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(|`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo(x,|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x,|`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`foo(x, |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`foo(x, |`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[x](y|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[x](y|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.ListExpression} (ParserContext)`, () => {
    //     it(`|{1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|{1`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`{|1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{|1`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`{1|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{1|`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`{{|1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`{{|1`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.RecordExpression} (Ast)`, () => {
    //     it(`|[a=1]`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1]`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[|a=1]`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1]`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=1|]`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|]`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=1, b=2|]`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|]`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=1, b=2|, c=3]`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3]`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "c",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=1]|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1]|`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=[|b=1]]`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1]]`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.RecordExpression} (ParserContext)`, () => {
    //     it(`|[a=1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`|[a=1`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[|a=1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[|a=1`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=|1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=|1`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=1|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1|`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=1, b=|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=1, b=2|, c=3`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=1, b=2|, c=3`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "c",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=[|b=1`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[|b=1`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`[a=[b=|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`[a=[b=|`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.SectionMember} (Ast)`, () => {
    //     it(`s|ection foo; x = 1; y = 2;`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `s|ection foo; x = 1; y = 2;`,
    //         );
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`section foo; x = 1|; y = 2;`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `section foo; x = 1|; y = 2;`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.SectionMember,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`section foo; x = 1; y = 2|;`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `section foo; x = 1; y = 2|;`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.SectionMember,
    //                 key: "x",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`section foo; x = 1; y = 2;|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `section foo; x = 1; y = 2;|`,
    //         );
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`section foo; x = 1; y = 2; z = let a = 1 in |b;`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `section foo; x = 1; y = 2; z = let a = 1 in |b;`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.SectionMember,
    //                 key: "x",
    //             },
    //             {
    //                 kind: ScopeItemKind.SectionMember,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.SectionMember} (ParserContext)`, () => {
    //     it(`s|ection foo; x = 1; y = 2`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `s|ection foo; x = 1; y = 2`,
    //         );
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`section foo; x = 1|; y = 2`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `section foo; x = 1|; y = 2`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.SectionMember,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`section foo; x = 1; y = 2|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `section foo; x = 1; y = 2|`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.SectionMember,
    //                 key: "x",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`section foo; x = 1; y = () => 10|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `section foo; x = 1; y = () => 10|`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.SectionMember,
    //                 key: "x",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.LetExpression} (Ast)`, () => {
    //     it(`let a = 1 in |x`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |x`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1 in x|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in x|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "x",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = |1 in x`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = |1 in x`);
    //         const expected: AbridgedScope = [];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1, b = 2 in x|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in x|`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "x",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1|, b = 2 in x`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in x`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`(p1, p2) => let a = 1, b = 2, c = 3| in c`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `(p1, p2) => let a = 1, b = 2, c = 3| in c`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //             {
    //                 kind: ScopeItemKind.Parameter,
    //                 key: "p1",
    //             },
    //             {
    //                 kind: ScopeItemKind.Parameter,
    //                 key: "p2",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let eggs = let ham = 0 in 1, foo = 2, bar = 3 in 4|`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "eggs",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "foo",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "bar",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let eggs = let ham = 0 in |1, foo = 2, bar = 3 in 4`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "ham",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "foo",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "bar",
    //             },
    //         ];
    //         expectDeepEqual(expectParseOkInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });

    // describe(`${Ast.NodeKind.LetExpression} (ParserContext)`, () => {
    //     it(`let a = 1 in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1 in |`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1, b = 2 in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1, b = 2 in |`);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "a",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1|, b = 2 in`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(`let a = 1|, b = 2 in `);
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "b",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let a = 1, b = 2, c = 3 in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let a = 1, b = 2, c = 3 in |`,
    //         );
    //         const expected: AbridgedScope = [
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
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let x = (let y = 1 in z|) in`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let x = (let y = 1 in z|) in`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.Undefined,
    //                 key: "z",
    //             },
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "y",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });

    //     it(`let x = (let y = 1 in z) in |`, () => {
    //         const [text, position]: [string, Inspection.Position] = expectTextWithPosition(
    //             `let x = (let y = 1 in z) in |`,
    //         );
    //         const expected: AbridgedScope = [
    //             {
    //                 kind: ScopeItemKind.KeyValuePair,
    //                 key: "x",
    //             },
    //         ];
    //         expectDeepEqual(expectParseErrInspectionOk(DefaultSettings, text, position), expected, actualFactoryFn);
    //     });
    // });
});
