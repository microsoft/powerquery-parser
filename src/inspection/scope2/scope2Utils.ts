// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError } from "../../common";
import { AncestryUtils, NodeIdMap, TXorNode } from "../../parser";
import { ActiveNode } from "../activeNode";
import { ScopeById, ScopeItemByKey } from "./scope2";
import { EachScopeItem2, ScopeItemKind2, TScopeItem2 } from "./scopeItem2";

export function filterByPosition(
    nodeIdMapCollection: NodeIdMap.Collection,
    scopeById: ScopeById,
    activeNode: ActiveNode,
): ScopeById {
    const missingNodeIds: ReadonlyArray<number> = activeNode.ancestry
        .filter((xorNode: TXorNode) => !scopeById.has(xorNode.node.id))
        .map((xorNode: TXorNode) => xorNode.node.id);

    if (missingNodeIds.length) {
        const details: {} = { missingNodeIds };
        throw new CommonError.InvariantError(`activeNode has nodeIds that are not in scopeById`, details);
    }

    const state: ScopeFilterState = {
        nodeIdMapCollection,
        original: scopeById,
        delta: new Map(),
        activeNode: activeNode,
        currentNodeId: -1,
        currentKey: "",
    };

    for (const ancestor of activeNode.ancestry) {
        const nodeId: number = ancestor.node.id;
        state.currentNodeId = nodeId;
        for (const [key, scopeItem] of scopeById.get(nodeId)!.entries()) {
            state.currentKey = key;
            visitScopeItem(state, scopeItem);
        }
    }

    const result: ScopeById = state.delta;
    for (const [nodeId, scopeItemByKey] of scopeById.entries()) {
        if (!result.has(nodeId)) {
            result.set(nodeId, scopeItemByKey);
        }
    }

    return result;
}

interface ScopeFilterState {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly original: ScopeById;
    readonly delta: ScopeById;
    readonly activeNode: ActiveNode;
    currentNodeId: number;
    currentKey: string;
}

function visitScopeItem(state: ScopeFilterState, scopeItem: TScopeItem2): void {
    switch (scopeItem.kind) {
        case ScopeItemKind2.Each:
            visitEachScopeItem(state, scopeItem);
            break;

        default:
            break;
    }
}

function visitEachScopeItem(state: ScopeFilterState, scopeItem: EachScopeItem2): void {
    const activeNode: ActiveNode = state.activeNode;
    const ancestryIndex: number = expectAncestryIndex(activeNode, scopeItem.eachExpression);
    const previousAncestor: TXorNode = AncestryUtils.expectPreviousXorNode(activeNode.ancestry, ancestryIndex);
    if (previousAncestor.node.maybeAttributeIndex !== 1) {
        return;
    }

    removeScopeItem(state);
}

function removeScopeItem(state: ScopeFilterState): void {
    const maybeDeltaScopeItemByKey: undefined | ScopeItemByKey = state.delta.get(state.currentNodeId);
    if (maybeDeltaScopeItemByKey === undefined) {
        const maybeOriginalScopeItemByKey: undefined | ScopeItemByKey = state.original.get(state.currentNodeId);
        if (maybeOriginalScopeItemByKey === undefined) {
            const details: {} = { currentNodeId: state.currentNodeId };
            throw new CommonError.InvariantError(`expected the currentNodeId to be in the original ScopeById`, details);
        }

        const newDeltaScopeItemByKey: ScopeItemByKey = new Map([...maybeOriginalScopeItemByKey.entries()]);
        state.delta.set(state.currentNodeId, newDeltaScopeItemByKey);
    } else {
        if (!maybeDeltaScopeItemByKey.delete(state.currentKey)) {
            const details: {} = { currentKey: state.currentKey };
            throw new CommonError.InvariantError(`failed to delete currentKey`, details);
        }

        if (maybeDeltaScopeItemByKey.size === 0) {
            state.delta.delete(state.currentNodeId);
        }
    }
}

function expectAncestryIndex(activeNode: ActiveNode, xorNode: TXorNode): number {
    const ancestryIndex: number = activeNode.ancestry
        .map((ancestor: TXorNode) => ancestor.node.id)
        .indexOf(xorNode.node.id);
    if (ancestryIndex === -1) {
        const details: {} = { xorNodeId: xorNode.node.id };
        throw new CommonError.InvariantError(`expected xorNode's id to be present in the ancestry`, details);
    }

    return ancestryIndex;
}
