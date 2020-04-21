// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Result, ResultUtils } from "../../common";
import { Ast } from "../../language";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode } from "../../parser";
import { CommonSettings } from "../../settings";
import { TypeInspector, TypeUtils } from "../../type";
import {
    KeyValuePairScopeItem,
    ParameterScopeItem,
    ScopeItemKind,
    SectionMemberScopeItem,
    TScopeItem,
} from "./scopeItem";

export type TriedScope = Result<ScopeById, CommonError.CommonError>;

export type TriedScopeForRoot = Result<ScopeItemByKey, CommonError.CommonError>;

export type ScopeById = Map<number, ScopeItemByKey>;

export type ScopeItemByKey = Map<string, TScopeItem>;

export function tryScope(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    ancestry: ReadonlyArray<TXorNode>,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: undefined | ScopeById,
): TriedScope {
    return ResultUtils.ensureResult(settings.localizationTemplates, () =>
        inspectScope(settings, nodeIdMapCollection, leafNodeIds, ancestry, maybeScopeById),
    );
}

export function tryScopeForRoot(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    ancestry: ReadonlyArray<TXorNode>,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: undefined | ScopeById,
): TriedScopeForRoot {
    if (ancestry.length === 0) {
        throw new CommonError.InvariantError(`ancestry.length should be non-zero`);
    }

    const rootId: number = ancestry[0].node.id;
    return ResultUtils.ensureResult(settings.localizationTemplates, () => {
        const inspected: ScopeById = inspectScope(settings, nodeIdMapCollection, leafNodeIds, ancestry, maybeScopeById);
        const maybeScope: undefined | ScopeItemByKey = inspected.get(rootId);
        if (maybeScope === undefined) {
            const details: {} = { rootId };
            throw new CommonError.InvariantError(`expected rootId in scope result`, details);
        }

        return maybeScope;
    });
}

function inspectScope(
    settings: CommonSettings,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    ancestry: ReadonlyArray<TXorNode>,
    // If a map is given, then it's mutated and returned. Else create and return a new instance.
    maybeScopeById: undefined | ScopeById,
): ScopeById {
    const rootId: number = ancestry[0].node.id;

    let scopeById: ScopeById;
    if (maybeScopeById !== undefined) {
        const maybeCached: undefined | ScopeItemByKey = maybeScopeById.get(rootId);
        if (maybeCached !== undefined) {
            return maybeScopeById;
        }
        scopeById = maybeScopeById;
    } else {
        scopeById = new Map();
    }

    // Store the delta between the given scope and what's found in a temporary map.
    // This will prevent mutation in the given map if an error is thrown.
    const scopeChanges: ScopeById = new Map();
    const state: ScopeInspectionState = {
        settings,
        givenScope: scopeById,
        deltaScope: scopeChanges,
        ancestry,
        nodeIdMapCollection,
        leafNodeIds,
        ancestryIndex: 0,
    };

    // Build up the scope through a top-down inspection.
    const numNodes: number = ancestry.length;
    for (let ancestryIndex: number = numNodes - 1; ancestryIndex >= 0; ancestryIndex -= 1) {
        state.ancestryIndex = ancestryIndex;
        const xorNode: TXorNode = ancestry[ancestryIndex];

        inspectNode(state, xorNode);
    }

    return state.deltaScope;
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

        case Ast.NodeKind.LetExpression:
            inspectLetExpression(state, xorNode);
            break;

        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            inspectRecordExpressionOrRecordLiteral(state, xorNode);
            break;

        case Ast.NodeKind.Section:
            inspectSection(state, xorNode);
            break;

        default:
            getOrCreateScope(state, xorNode.node.id, undefined);
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
                    kind: ScopeItemKind.Each,
                    recursive: false,
                    eachExpression: eachExpr,
                },
            ],
        ],
        undefined,
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
    const scope: ScopeItemByKey = getOrCreateScope(state, fnExpr.node.id, undefined);

    const inspectedFnExpr: TypeInspector.InspectedFunctionExpression = TypeInspector.inspectFunctionExpression(
        state.nodeIdMapCollection,
        fnExpr,
    );

    const newEntries: ReadonlyArray<[string, ParameterScopeItem]> = inspectedFnExpr.parameters.map(
        (parameter: TypeInspector.InspectedFunctionParameter) => {
            return [
                parameter.name.literal,
                {
                    kind: ScopeItemKind.Parameter,
                    recursive: false,
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
    expandChildScope(state, fnExpr, [3], newEntries, scope);
}

function inspectLetExpression(state: ScopeInspectionState, letExpr: TXorNode): void {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstNodeKind(
        letExpr,
        Ast.NodeKind.LetExpression,
    );
    if (maybeErr) {
        throw maybeErr;
    }

    // Propegates the parent's scope.
    const scope: ScopeItemByKey = getOrCreateScope(state, letExpr.node.id, undefined);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.KeyValuePair<
        Ast.Identifier
    >> = NodeIdMapIterator.letKeyValuePairs(state.nodeIdMapCollection, letExpr);

    inspectKeyValuePairs(state, scope, keyValuePairs, keyValuePairScopeItemFactory);

    // Places the assignments from the 'let' into LetExpression.expression
    const newEntries: ReadonlyArray<[string, KeyValuePairScopeItem]> = scopeItemsFromKeyValuePairs(
        keyValuePairs,
        -1,
        keyValuePairScopeItemFactory,
    );
    expandChildScope(state, letExpr, [3], newEntries, scope);
}

function inspectRecordExpressionOrRecordLiteral(state: ScopeInspectionState, record: TXorNode): void {
    const maybeErr: undefined | CommonError.InvariantError = NodeIdMapUtils.testAstAnyNodeKind(record, [
        Ast.NodeKind.RecordExpression,
        Ast.NodeKind.RecordLiteral,
    ]);
    if (maybeErr) {
        throw maybeErr;
    }

    // Propegates the parent's scope.
    const scope: ScopeItemByKey = getOrCreateScope(state, record.node.id, undefined);

    const keyValuePairs: ReadonlyArray<NodeIdMapIterator.KeyValuePair<
        Ast.GeneralizedIdentifier
    >> = NodeIdMapIterator.recordKeyValuePairs(state.nodeIdMapCollection, record);
    inspectKeyValuePairs(state, scope, keyValuePairs, keyValuePairScopeItemFactory);
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

    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, SectionMemberScopeItem]> = scopeItemsFromKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            sectionMemberScopeItemFactory,
        );
        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.maybeValue, newScopeItems, new Map());
        }
    }
}

// Expands the scope of the value portion for each key value pair.
function inspectKeyValuePairs<T extends TScopeItem, I extends Ast.GeneralizedIdentifier | Ast.Identifier>(
    state: ScopeInspectionState,
    parentScope: ScopeItemByKey,
    keyValuePairs: ReadonlyArray<NodeIdMapIterator.KeyValuePair<I>>,
    factoryFn: (keyValuePair: NodeIdMapIterator.KeyValuePair<I>, recursive: boolean) => T,
): void {
    for (const kvp of keyValuePairs) {
        if (kvp.maybeValue === undefined) {
            continue;
        }

        const newScopeItems: ReadonlyArray<[string, T]> = scopeItemsFromKeyValuePairs(
            keyValuePairs,
            kvp.key.id,
            factoryFn,
        );
        if (newScopeItems.length !== 0) {
            expandScope(state, kvp.maybeValue, newScopeItems, parentScope);
        }
    }
}

function expandScope(
    state: ScopeInspectionState,
    xorNode: TXorNode,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: undefined | ScopeItemByKey,
): void {
    const scope: ScopeItemByKey = getOrCreateScope(state, xorNode.node.id, maybeDefaultScope);
    for (const [key, value] of newEntries) {
        scope.set(key, value);
    }
}

function expandChildScope(
    state: ScopeInspectionState,
    parent: TXorNode,
    childAttributeIds: ReadonlyArray<number>,
    newEntries: ReadonlyArray<[string, TScopeItem]>,
    maybeDefaultScope: undefined | ScopeItemByKey,
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
            expandScope(state, maybeChild, newEntries, maybeDefaultScope);
        }
    }
}

// Any operation done on a scope should first invoke `scopeFor` for data integrity.
function getOrCreateScope(
    state: ScopeInspectionState,
    nodeId: number,
    maybeDefaultScope: undefined | ScopeItemByKey,
): ScopeItemByKey {
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

    if (maybeDefaultScope !== undefined) {
        const shallowCopy: ScopeItemByKey = new Map(maybeDefaultScope.entries());
        state.deltaScope.set(nodeId, shallowCopy);
        return shallowCopy;
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

function scopeItemsFromKeyValuePairs<T extends TScopeItem, I extends Ast.Identifier | Ast.GeneralizedIdentifier>(
    keyValuePairs: ReadonlyArray<NodeIdMapIterator.KeyValuePair<I>>,
    ancestorKeyNodeId: number,
    factoryFn: (keyValuePair: NodeIdMapIterator.KeyValuePair<I>, recursive: boolean) => T,
): ReadonlyArray<[string, T]> {
    return keyValuePairs
        .filter((keyValuePair: NodeIdMapIterator.KeyValuePair<I>) => keyValuePair.maybeValue !== undefined)
        .map((keyValuePair: NodeIdMapIterator.KeyValuePair<I>) => {
            const isRecursive: boolean = ancestorKeyNodeId === keyValuePair.key.id;
            return [keyValuePair.keyLiteral, factoryFn(keyValuePair, isRecursive)];
        });
}

function sectionMemberScopeItemFactory(
    keyValuePair: NodeIdMapIterator.KeyValuePair<Ast.Identifier>,
    recursive: boolean,
): SectionMemberScopeItem {
    return {
        kind: ScopeItemKind.SectionMember,
        recursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}

function keyValuePairScopeItemFactory<T extends Ast.Identifier | Ast.GeneralizedIdentifier>(
    keyValuePair: NodeIdMapIterator.KeyValuePair<T>,
    recursive: boolean,
): KeyValuePairScopeItem {
    return {
        kind: ScopeItemKind.KeyValuePair,
        recursive,
        key: keyValuePair.key,
        maybeValue: keyValuePair.maybeValue,
    };
}
