// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultKind, ResultUtils } from "../../common";
import { Ast, NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode } from "../../parser";
import { CommonSettings } from "../../settings";
import { TypeInspector, TypeUtils } from "../../type";
import {
    KeyValuePairScopeItem2,
    ParameterScopeItem2,
    ScopeItemKind2,
    SectionMemberScopeItem2,
    TScopeItem2,
} from "./scopeItem2";

export type TriedScopeInspection = Result<ScopeById, CommonError.CommonError>;

export type TriedNodeScopeInspection = Result<ScopeItemByKey, CommonError.CommonError>;

export type ScopeById = Map<number, ScopeItemByKey>;

export type ScopeItemByKey = Map<string, TScopeItem2>;

export function tryInspectScope2(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    rootId: number,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: undefined | ScopeById,
): TriedScopeInspection {
    let scopeById: ScopeById;
    if (maybeScopeById !== undefined) {
        const maybeCached: undefined | ScopeItemByKey = maybeScopeById.get(rootId);
        if (maybeCached !== undefined) {
            return ResultUtils.okFactory(maybeScopeById);
        }
        scopeById = maybeScopeById;
    } else {
        scopeById = new Map();
    }

    // Store the delta between the given scope and what's found in a temporary map.
    // This will prevent mutation in the given map if an error is thrown.
    const scopeChanges: ScopeById = new Map();
    const ancestry: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectAncestry(nodeIdMapCollection, rootId);
    const state: ScopeInspectionState = {
        settings,
        givenScope: scopeById,
        deltaScope: scopeChanges,
        ancestry,
        nodeIdMapCollection,
        leafNodeIds,
        ancestryIndex: 0,
    };

    try {
        // Build up the scope through a top-down inspection.
        const numNodes: number = ancestry.length;
        for (let ancestryIndex: number = numNodes - 1; ancestryIndex >= 0; ancestryIndex -= 1) {
            state.ancestryIndex = ancestryIndex;
            const xorNode: TXorNode = ancestry[ancestryIndex];

            inspectNode(state, xorNode);
        }

        return ResultUtils.okFactory(state.deltaScope);
    } catch (err) {
        return {
            kind: ResultKind.Err,
            error: CommonError.ensureCommonError(state.settings.localizationTemplates, err),
        };
    }
}

export function tryInspectScope2ForNode(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    nodeId: number,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: undefined | ScopeById,
): TriedNodeScopeInspection {
    const triedScopeInspection: TriedScopeInspection = tryInspectScope2(
        settings,
        nodeIdMapCollection,
        leafNodeIds,
        nodeId,
        maybeScopeById,
    );

    if (ResultUtils.isErr(triedScopeInspection)) {
        return triedScopeInspection;
    }

    const maybeScope: undefined | ScopeItemByKey = triedScopeInspection.value.get(nodeId);
    if (maybeScope === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(
            `${tryInspectScope2ForNode.name}: expected nodeId in ${tryInspectScope2.name} result`,
            details,
        );
    }

    return ResultUtils.okFactory(maybeScope);
}

interface ScopeInspectionState {
    readonly settings: CommonSettings;
    readonly givenScope: ScopeById;
    readonly deltaScope: ScopeById;
    readonly ancestry: ReadonlyArray<TXorNode>;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    ancestryIndex: number;
}

function inspectNode(state: ScopeInspectionState, xorNode: TXorNode): void {
    switch (xorNode.node.kind) {
        case Ast.NodeKind.EachExpression:
            inspectEachExpression(state, xorNode);
            break;

        case Ast.NodeKind.FunctionExpression:
            inspectFunctionExpression(state, xorNode);
            break;

        // case Ast.NodeKind.LetExpression:
        //     inspectLetExpression(state, xorNode);
        //     break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrRecordLiteral(state, xorNode);
            break;

        case Ast.NodeKind.Section:
            inspectSection(state, xorNode);
            break;

        default:
            getOrCreateScope(state, xorNode.node.id);
            break;
    }
}

function inspectEachExpression(state: ScopeInspectionState, eachExpr: TXorNode): void {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        eachExpr,
        Ast.NodeKind.EachExpression,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    expandChildScope(
        state,
        eachExpr,
        [1],
        [
            [
                "_",
                {
                    kind: ScopeItemKind2.Each,
                    eachExpression: eachExpr,
                },
            ],
        ],
    );
}

function inspectFunctionExpression(state: ScopeInspectionState, fnExpr: TXorNode): void {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        fnExpr,
        Ast.NodeKind.FunctionExpression,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    // Propegates the parent's scope.
    getOrCreateScope(state, fnExpr.node.id);

    const inspectedFnExpr: TypeInspector.InspectedFunctionExpression = TypeInspector.inspectFunctionExpression(
        state.nodeIdMapCollection,
        fnExpr,
    );

    const newEntries: ReadonlyArray<[string, ParameterScopeItem2]> = inspectedFnExpr.parameters.map(
        (parameter: TypeInspector.InspectedFunctionParameter) => {
            return [
                parameter.name.literal,
                {
                    kind: ScopeItemKind2.Parameter,
                    name: parameter.name,
                    isOptional: parameter.isOptional,
                    isNullable: parameter.isNullable,
                    maybeType:
                        parameter.maybeType !== undefined
                            ? TypeUtils.maybePrimitiveTypeConstantKindFromTypeKind(parameter.maybeType)
                            : undefined,
                },
            ];
        },
    );
    expandChildScope(state, fnExpr, [3], newEntries);
}

// // If position is to the right of an equals sign,
// // then add all keys to the scope EXCEPT for the key that the position is under.
// function inspectLetExpression(state: ScopeInspectionState, letExpr: TXorNode): void {
//     const maybePreviousAttributeIndex: number | undefined = AncestorUtils.expectPreviousXorNode(
//         state.ancestry,
//         state.nodeIndex,
//     ).node.maybeAttributeIndex;
//     if (maybePreviousAttributeIndex !== 3 && !InspectionUtils.isInKeyValuePairAssignment(state)) {
//         return;
//     }

//     const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

//     let maybeAncestorKeyValuePair: TXorNode | undefined;
//     // If ancestor is an expression
//     if (maybePreviousAttributeIndex === 3) {
//         maybeAncestorKeyValuePair = undefined;
//     } else {
//         maybeAncestorKeyValuePair = AncestorUtils.expectPreviousXorNode(state.ancestry, state.nodeIndex, 3, [
//             Ast.NodeKind.IdentifierPairedExpression,
//         ]);
//     }

//     for (const kvp of NodeIdMapIterator.letKeyValuePairs(nodeIdMapCollection, letExpr)) {
//         if (maybeAncestorKeyValuePair && maybeAncestorKeyValuePair.node.id === kvp.source.node.id) {
//             continue;
//         }

//         const keyValuePairId: number = kvp.source.node.id;
//         const maybeKey: Ast.Identifier | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
//             nodeIdMapCollection,
//             keyValuePairId,
//             0,
//             [Ast.NodeKind.Identifier],
//         ) as Ast.Identifier;
//         if (maybeKey === undefined) {
//             continue;
//         }
//         const key: Ast.Identifier = maybeKey;
//         const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
//             nodeIdMapCollection,
//             keyValuePairId,
//             2,
//             undefined,
//         );
//         mightUpdateScope(state, key.literal, {
//             kind: ScopeItemKind2.KeyValuePair,
//             key,
//             maybeValue,
//         });
//     }
// }

// If position is to the right of an equals sign,
// then add all keys to scope EXCEPT for the one the that position is under.
function inspectRecordExpressionOrRecordLiteral(state: ScopeInspectionState, record: TXorNode): void {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstAnyNodeKind(record, [
        Ast.NodeKind.RecordExpression,
        Ast.NodeKind.RecordLiteral,
    ]);
    if (maybeErr) {
        throw maybeErr;
    }

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.KeyValuePair<
        Ast.GeneralizedIdentifier
    >> = NodeIdMapIterator.recordKeyValuePairs(state.nodeIdMapCollection, record);
    const unfilteredNewEntries: ReadonlyArray<[string, KeyValuePairScopeItem2]> = keyValuePairs.map(
        (kvp: NodeIdMapIterator.KeyValuePair<Ast.GeneralizedIdentifier>) => {
            return [
                kvp.key.literal,
                {
                    kind: ScopeItemKind2.KeyValuePair,
                    key: kvp.key,
                    maybeValue: kvp.maybeValue,
                },
            ];
        },
    );

    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const filteredNewEntries: ReadonlyArray<[string, KeyValuePairScopeItem2]> = unfilteredNewEntries.filter(
            (pair: [string, KeyValuePairScopeItem2]) => {
                return pair[1].key.id !== kvp.key.id;
            },
        );
        expandScope(state, kvp.maybeValue, filteredNewEntries);
    }
}

function inspectSection(state: ScopeInspectionState, section: TXorNode): void {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        section,
        Ast.NodeKind.Section,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.KeyValuePair<
        Ast.Identifier
    >> = NodeIdMapIterator.sectionMemberKeyValuePairs(state.nodeIdMapCollection, section);
    const unfilteredNewEntries: ReadonlyArray<[string, SectionMemberScopeItem2]> = keyValuePairs.map(
        (kvp: NodeIdMapIterator.KeyValuePair<Ast.Identifier>) => {
            return [
                kvp.key.literal,
                {
                    kind: ScopeItemKind2.SectionMember,
                    key: kvp.key,
                    maybeValue: kvp.maybeValue,
                },
            ];
        },
    );

    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const filteredNewEntries: ReadonlyArray<[string, SectionMemberScopeItem2]> = unfilteredNewEntries.filter(
            (pair: [string, SectionMemberScopeItem2]) => {
                return pair[1].key.id !== kvp.key.id;
            },
        );
        expandScope(state, kvp.maybeValue, filteredNewEntries);
    }
}

// function inspectSectionMember(state: ScopeInspectionState, sectionMember: TXorNode): void {
//     if (!InspectionUtils.isInKeyValuePairAssignment(state)) {
//         return;
//     }

//     const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
//     const sectionMemberArray: TXorNode = AncestorUtils.expectNextXorNode(state.ancestry, state.nodeIndex, 1, [
//         Ast.NodeKind.ArrayWrapper,
//     ]);
//     const sectionMembers: ReadonlyArray<TXorNode> = NodeIdMapIterator.expectXorChildren(
//         nodeIdMapCollection,
//         sectionMemberArray.node.id,
//     );
//     for (const iterSectionMember of sectionMembers) {
//         // Ignore if it's the current SectionMember.
//         if (iterSectionMember.node.id === sectionMember.node.id) {
//             continue;
//         }

//         const maybeKeyValuePair:
//             | TXorNode
//             | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
//             nodeIdMapCollection,
//             iterSectionMember.node.id,
//             2,
//             [Ast.NodeKind.IdentifierPairedExpression],
//         );
//         if (maybeKeyValuePair === undefined) {
//             continue;
//         }
//         const keyValuePair: TXorNode = maybeKeyValuePair;

//         // Add name to scope.
//         const maybeName: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
//             nodeIdMapCollection,
//             keyValuePair.node.id,
//             0,
//             [Ast.NodeKind.Identifier],
//         );
//         if (maybeName === undefined || maybeName.kind === XorNodeKind.Context) {
//             continue;
//         }
//         const name: Ast.Identifier = maybeName.node as Ast.Identifier;

//         const maybeValue: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
//             nodeIdMapCollection,
//             keyValuePair.node.id,
//             2,
//             undefined,
//         );

//         mightUpdateScope(state, name.literal, {
//             kind: ScopeItemKind2.SectionMember,
//             key: name,
//             maybeValue,
//         });
//     }
// }

// function expectedNodeKindError(xorNode: TXorNode, expected: Ast.NodeKind): CommonError.InvariantError {
//     const details: {} = {
//         xorNodeId: xorNode.node.id,
//         expectedNodeKind: expected,
//         actualNodeKind: xorNode.node.kind,
//     };
//     return new CommonError.InvariantError(`expected xorNode to be of kind ${expected}`, details);
// }

// function isParentOfNodeKind(state: ScopeInspectionState, parentNodeKind: Ast.NodeKind): boolean {
//     const maybeParent: TXorNode | undefined = AncestorUtils.maybeNextXorNode(state.ancestry, state.nodeIndex);
//     return maybeParent !== undefined ? maybeParent.node.kind === parentNodeKind : false;
// }

// function mightUpdateScope(state: ScopeInspectionState, key: string, scopeItem: TScopeItem2): void {
//     const scopeBy;

//     state.scopeById.set(key, scopeItem);
//     const unsafeScope: Map<string, TScopeItem2> = state.result.scope as Map<string, TScopeItem2>;
//     const maybeScopeItem: TScopeItem2 | undefined = unsafeScope.get(key);
//     const isUpdateNeeded: boolean =
//         maybeScopeItem === undefined ||
//         (maybeScopeItem.kind === ScopeItemKind2.Undefined && scopeItem.kind !== ScopeItemKind2.Undefined);

//     if (isUpdateNeeded) {
//         unsafeScope.set(key, scopeItem);
//     }
// }

function expandScope(
    state: ScopeInspectionState,
    xorNode: TXorNode,
    newEntries: ReadonlyArray<[string, TScopeItem2]>,
): void {
    const scope: ScopeItemByKey = getOrCreateScope(state, xorNode.node.id);
    for (const [key, value] of newEntries) {
        scope.set(key, value);
    }
}

function expandChildScope(
    state: ScopeInspectionState,
    parent: TXorNode,
    childAttributeIds: ReadonlyArray<number>,
    newEntries: ReadonlyArray<[string, TScopeItem2]>,
): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const parentId: number = parent.node.id;

    // TODO: optimize this
    for (const attributeId of childAttributeIds) {
        const maybeChild: undefined | TXorNode = NodeIdMapUtils.maybeXorChildByAttributeIndex(
            nodeIdMapCollection,
            parentId,
            attributeId,
            undefined,
        );
        if (maybeChild !== undefined) {
            expandScope(state, maybeChild, newEntries);
        }
    }
}

// Any operation done on a scope should first invoke `scopeFor` for data integrity.
function getOrCreateScope(state: ScopeInspectionState, nodeId: number): ScopeItemByKey {
    // If scopeFor has already been called then there should be a nodeId in the deltaScope.
    const maybeDeltaScope: undefined | ScopeItemByKey = state.deltaScope.get(nodeId);
    if (maybeDeltaScope !== undefined) {
        return maybeDeltaScope;
    }

    // If given a scope with an existing value then assume it's valid.
    // Cache and return.
    const maybeGivenScope: undefined | ScopeItemByKey = state.givenScope.get(nodeId);
    if (maybeGivenScope !== undefined) {
        state.deltaScope.set(nodeId, { ...maybeGivenScope });
        return maybeGivenScope;
    }

    // Default to a parent's scope if the node has a parent.
    const maybeParent: undefined | TXorNode = NodeIdMapUtils.maybeParentXorNode(
        state.nodeIdMapCollection,
        nodeId,
        undefined,
    );
    if (maybeParent !== undefined) {
        const parentNodeId: number = maybeParent.node.id;

        const maybeParentDeltaScope: undefined | ScopeItemByKey = state.deltaScope.get(parentNodeId);
        if (maybeParentDeltaScope !== undefined) {
            const shallowCopy: ScopeItemByKey = new Map(maybeParentDeltaScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            return shallowCopy;
        }

        const maybeParentGivenScope: undefined | ScopeItemByKey = state.givenScope.get(parentNodeId);
        if (maybeParentGivenScope !== undefined) {
            const shallowCopy: ScopeItemByKey = new Map(maybeParentGivenScope.entries());
            state.deltaScope.set(nodeId, shallowCopy);
            return shallowCopy;
        }
    }

    // The node has no parent or it hasn't been visited.
    const newScope: ScopeItemByKey = new Map();
    state.deltaScope.set(nodeId, newScope);
    return newScope;
}
