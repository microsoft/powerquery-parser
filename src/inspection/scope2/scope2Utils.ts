// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "../../common";
import { AncestryUtils, Ast, NodeIdMap, NodeIdMapUtils, TXorNode } from "../../parser";
import { ActiveNode } from "../activeNode";
import { ScopeById, ScopeItemByKey } from "./scope2";
import { TScopeItem2 } from "./scopeItem2";

export function filterByPosition(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeById: ScopeById,
    activeNode: ActiveNode,
): ScopeById {
    const ancestorNodeIds: ReadonlyArray<number> = activeNode.ancestry.map((xorNode: TXorNode) => xorNode.node.id);
    const missingNodeIds: ReadonlyArray<number> = ancestorNodeIds.filter((nodeId: number) => !scopeById.has(nodeId));

    if (missingNodeIds.length) {
        const details: {} = { missingNodeIds };
        throw new CommonError.InvariantError(
            `${filterByPosition.name}: activeNode has nodeIds that are not in scopeById`,
            details,
        );
    }

    const state: ScopeFilterState = {
        nodeIdMapCollection,
        activeNode: activeNode,
        ancestorNodeIds,
        ancestorIndex: -1,
        givenScope: scopeById,
        filteredScope: new Map(),
    };

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;
    const numAncestors: number = ancestry.length;
    for (let ancestorIndex: number = 0; ancestorIndex < numAncestors; ancestorIndex += 1) {
        const xorNode: TXorNode = ancestry[ancestorIndex];
        state.ancestorIndex = ancestorIndex;
        filterNode(state, xorNode);
        ensureScope(state, xorNode.node.id);
    }

    return state.filteredScope;
}

interface ScopeFilterState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly activeNode: ActiveNode;
    readonly ancestorNodeIds: ReadonlyArray<number>;
    ancestorIndex: number;
    readonly givenScope: ScopeById;
    readonly filteredScope: ScopeById;
}

function filterNode(state: ScopeFilterState, xorNode: TXorNode): void {
    switch (xorNode.node.kind) {
        case Ast.NodeKind.EachExpression:
            filterEachExpression(state, xorNode);
            break;

        default:
            break;
    }
}

function filterEachExpression(state: ScopeFilterState, eachExpr: TXorNode): void {
    const activeNode: ActiveNode = state.activeNode;
    const previousAncestor: TXorNode = AncestryUtils.expectPreviousXorNode(activeNode.ancestry, state.ancestorIndex);
    if (previousAncestor.node.maybeAttributeIndex !== 1) {
        return;
    }

    removeOrReplaceScopeItem(
        state,
        previousAncestor.node.id,
        "_",
        maybeParentScopeItem(state, activeNode.ancestry[state.ancestorIndex], "_"),
    );
}

function ensureScope(state: ScopeFilterState, nodeId: number): void {
    scopeFor(state, nodeId);
}

function scopeFor(state: ScopeFilterState, nodeId: number): ScopeItemByKey {
    const maybeScope: undefined | ScopeItemByKey = state.filteredScope.get(nodeId);
    if (maybeScope !== undefined) {
        return maybeScope;
    }

    const scopeItemByKey: ScopeItemByKey = state.givenScope.get(nodeId) ?? new Map();
    state.filteredScope.set(nodeId, scopeItemByKey);
    return scopeItemByKey;
}

function removeOrReplaceScopeItem(
    state: ScopeFilterState,
    nodeId: number,
    key: string,
    maybeReplacement: undefined | TScopeItem2,
): void {
    const scopeItemByKey: ScopeItemByKey = scopeFor(state, nodeId);

    if (maybeReplacement !== undefined) {
        scopeFor(state, nodeId).set(key, maybeReplacement);
        return;
    }

    if (!scopeItemByKey.delete(key)) {
        const details: {} = {
            nodeId,
            key,
        };
        throw new CommonError.InvariantError(
            `${removeOrReplaceScopeItem.name} expected key to be in scopeItemByKey`,
            details,
        );
    }

    if (scopeItemByKey.size === 0 && state.ancestorNodeIds.indexOf(nodeId) === -1) {
        if (!state.filteredScope.delete(nodeId)) {
            const details: {} = {
                nodeId,
                key,
            };
            throw new CommonError.InvariantError(
                `${removeOrReplaceScopeItem.name}: expected nodeId to be in filteredScope`,
                details,
            );
        }
    }
}

function maybeParentScopeItem(state: ScopeFilterState, child: TXorNode, key: string): undefined | TScopeItem2 {
    const maybeParent: undefined | TXorNode = NodeIdMapUtils.maybeParentXorNode(
        state.nodeIdMapCollection,
        child.node.id,
        undefined,
    );
    if (maybeParent === undefined) {
        return undefined;
    }
    const parent: TXorNode = maybeParent;

    return scopeFor(state, parent.node.id).get(key);
}

// function removeScopeItem(state: ScopeFilterState, nodeId: number, key: string): void {
//     const maybeDeltaScopeItemByKey: undefined | ScopeItemByKey = state.filteredScope.get(nodeId);
//     if (maybeDeltaScopeItemByKey === undefined) {
//         const maybeOriginalScopeItemByKey: undefined | ScopeItemByKey = state.givenScope.get(nodeId);
//         if (maybeOriginalScopeItemByKey === undefined) {
//             const details: {} = { nodeId };
//             throw new CommonError.InvariantError(`expected the nodeId to be in the original ScopeById`, details);
//         }

//         const newDeltaScopeItemByKey: ScopeItemByKey = new Map([...maybeOriginalScopeItemByKey.entries()]);
//         state.filteredScope.set(nodeId, newDeltaScopeItemByKey);
//     } else {
//         if (!maybeDeltaScopeItemByKey.delete(key)) {
//             const details: {} = { key };
//             throw new CommonError.InvariantError(`failed to delete key`, details);
//         }

//         if (maybeDeltaScopeItemByKey.size === 0) {
//             state.filteredScope.delete(nodeId);
//         }
//     }
// }

// function expectAncestryIndex(activeNode: ActiveNode, xorNode: TXorNode): number {
//     const ancestryIndex: number = activeNode.ancestry
//         .map((ancestor: TXorNode) => ancestor.node.id)
//         .indexOf(xorNode.node.id);
//     if (ancestryIndex === -1) {
//         const details: {} = { xorNodeId: xorNode.node.id };
//         throw new CommonError.InvariantError(`expected xorNode's id to be present in the ancestry`, details);
//     }

//     return ancestryIndex;
// }
