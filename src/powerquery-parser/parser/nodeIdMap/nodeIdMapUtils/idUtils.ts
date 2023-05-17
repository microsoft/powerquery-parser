// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { MapUtils, TypeScriptUtils } from "../../../common";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, XorNodeUtils } from "..";
import { Trace, TraceManager } from "../../../common/trace";
import { Ast } from "../../../language";
import { Collection } from "../nodeIdMap";
import { ParseContext } from "../../context";
import { TXorNode } from "../xorNode";

// Helper functions which are related to updating / remapping nodeIds for NodeIdMap.Collection

// Builds up a list of all nodeIds under the given nodeId (including itself),
// then creates a Map<oldId, newId> such that the Ids are in a BFS ordering.
// Does not include nodeIds which remain unchanged.
export function recalculateIds(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    traceManager: TraceManager,
    correlationId: number | undefined,
): ReadonlyMap<number, number> {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, recalculateIds.name, correlationId);

    const visitedNodeIds: number[] = [];
    let currentNodeId: number | undefined = nodeId;
    let nodeIdStack: number[] = [];

    while (currentNodeId) {
        visitedNodeIds.push(currentNodeId);

        const childIdsOfCurrentNode: ReadonlyArray<number> | undefined =
            nodeIdMapCollection.childIdsById.get(currentNodeId);

        if (childIdsOfCurrentNode) {
            nodeIdStack = nodeIdStack.concat([...childIdsOfCurrentNode].reverse());
        }

        currentNodeId = nodeIdStack.pop();
    }

    const numNodeIds: number = visitedNodeIds.length;
    const sortedNodeIds: ReadonlyArray<number> = [...visitedNodeIds].sort();
    const newNodeIdByOldNodeId: Map<number, number> = new Map();

    for (let index: number = 0; index < numNodeIds; index += 1) {
        const oldNodeId: number = visitedNodeIds[index];
        const newNodeId: number = sortedNodeIds[index];

        if (oldNodeId !== newNodeId) {
            newNodeIdByOldNodeId.set(oldNodeId, newNodeId);
        }
    }

    trace.exit();

    return newNodeIdByOldNodeId;
}

// Given a mapping of (existingId) => (newId) this mutates the NodeIdMap.Collection and the TXorNodes it holds.
// Assumes the given arguments are valid as this function does no validation.
export function updateNodeIds(
    nodeIdMapCollection: Collection,
    newIdByOldId: ReadonlyMap<number, number>,
    traceManager: TraceManager,
    correlationId: number | undefined,
): void {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, updateNodeIds.name, correlationId, {
        [IdUtilsTraceConstant.MapSize]: newIdByOldId.size,
    });

    if (newIdByOldId.size === 0) {
        trace.exit();

        return;
    }

    // We'll be iterating over them twice, so grab them once.
    const xorNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterXor(nodeIdMapCollection, [
        ...newIdByOldId.keys(),
    ]);

    // Storage for the change delta which is used to mutate nodeIdMapCollection.
    const partialDelta: CollectionDelta = createDelta(
        nodeIdMapCollection,
        newIdByOldId,
        xorNodes,
        traceManager,
        trace.id,
    );

    applyDelta(nodeIdMapCollection, newIdByOldId, xorNodes, partialDelta, traceManager, trace.id);
    trace.exit();
}

const enum IdUtilsTraceConstant {
    IdUtils = "IdUtils",
    MapSize = "MapSize",
}

type CollectionDelta = Omit<Collection, "leafIds" | "rightMostLeaf" | "idsByNodeKind">;

function createDelta(
    nodeIdMapCollection: Collection,
    newIdByOldId: ReadonlyMap<number, number>,
    xorNodes: ReadonlyArray<TXorNode>,
    traceManager: TraceManager,
    correlationId: number,
): CollectionDelta {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, createDelta.name, correlationId, {
        [IdUtilsTraceConstant.MapSize]: newIdByOldId.size,
    });

    const partialCollection: CollectionDelta = {
        astNodeById: new Map(),
        contextNodeById: new Map(),

        childIdsById: new Map(),
        parentIdById: new Map(),
    };

    // Build up the change delta.
    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = MapUtils.assertGet(newIdByOldId, oldId);

        if (XorNodeUtils.isAst(xorNode)) {
            partialCollection.astNodeById.set(newId, xorNode.node);
        } else {
            partialCollection.contextNodeById.set(newId, xorNode.node);
        }

        // If the node has children and the change delta hasn't been calculated,
        // then calculate the children for the change delta.
        const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(oldId);

        if (childIds !== undefined && !partialCollection.childIdsById.has(newId)) {
            const newChildIds: ReadonlyArray<number> = childIds.map(
                (childId: number) => newIdByOldId.get(childId) ?? childId,
            );

            partialCollection.childIdsById.set(newId, newChildIds);
        }

        // If the node has a parent,
        // then calculate the updated parent for the change delta.
        const oldParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);

        if (oldParentId !== undefined) {
            const newParentId: number = newIdByOldId.get(oldParentId) ?? oldParentId;
            partialCollection.parentIdById.set(newId, newParentId);

            // If the parent has children and the change delta hasn't been calculated for the parent's children,
            // then calculate the children for the change delta.
            if (!partialCollection.childIdsById.has(newParentId)) {
                const oldChildIdsOfParent: ReadonlyArray<number> = MapUtils.assertGet(
                    nodeIdMapCollection.childIdsById,
                    oldParentId,
                );

                const newChildIdsOfParent: ReadonlyArray<number> = oldChildIdsOfParent.map(
                    (childId: number) => newIdByOldId.get(childId) ?? childId,
                );

                partialCollection.childIdsById.set(newParentId, newChildIdsOfParent);
            }
        }
    }

    trace.exit();

    return partialCollection;
}

function applyDelta(
    nodeIdMapCollection: Collection,
    newIdByOldId: ReadonlyMap<number, number>,
    xorNodes: ReadonlyArray<TXorNode>,
    delta: CollectionDelta,
    traceManager: TraceManager,
    correlationId: number,
): void {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, applyDelta.name, correlationId);

    const newIds: ReadonlySet<number> = new Set(newIdByOldId.values());
    const oldLeafIds: ReadonlySet<number> = new Set(nodeIdMapCollection.leafIds.values());

    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = MapUtils.assertGet(newIdByOldId, oldId);

        // Update nodeIds for either Ast.TNode or ParseContext.Node,
        // both in the NodeIdMap.Collection and on the node itself.
        if (XorNodeUtils.isAst(xorNode)) {
            const mutableNode: TypeScriptUtils.StripReadonly<Ast.TNode> = xorNode.node;
            mutableNode.id = newId;
            nodeIdMapCollection.astNodeById.set(newId, mutableNode);

            if (!delta.astNodeById.has(oldId)) {
                nodeIdMapCollection.astNodeById.delete(oldId);
            }
        } else {
            const mutableNode: TypeScriptUtils.StripReadonly<ParseContext.TNode> = xorNode.node;
            mutableNode.id = newId;
            nodeIdMapCollection.contextNodeById.set(newId, mutableNode);

            if (!delta.contextNodeById.has(oldId)) {
                nodeIdMapCollection.contextNodeById.delete(oldId);
            }
        }

        // If the nodeId had any children then update the links.
        const childIds: ReadonlyArray<number> | undefined = delta.childIdsById.get(newId);

        if (childIds !== undefined) {
            nodeIdMapCollection.childIdsById.set(newId, childIds);

            if (!delta.parentIdById.has(oldId)) {
                MapUtils.assertDelete(nodeIdMapCollection.childIdsById, oldId);
            }
        } else {
            nodeIdMapCollection.childIdsById.delete(newId);
        }

        if (oldLeafIds.has(oldId)) {
            nodeIdMapCollection.leafIds.add(newId);
        }

        // Delete oldId if:
        //  * another iteration doesn't update its id to oldId
        //  * OR oldId wasn't a leafId to begin with.
        if (!newIds.has(oldId) || oldLeafIds.has(oldId)) {
            nodeIdMapCollection.leafIds.delete(oldId);
        }

        const idsForSpecificNodeKind: Set<number> = MapUtils.assertGet(
            nodeIdMapCollection.idsByNodeKind,
            xorNode.node.kind,
        );

        // We need the NodeKind to check if we should do a deletion.
        // It must either be something in the delta, or something untouched in the nodeIdMapCollection.
        const oldKind: Ast.NodeKind =
            delta.astNodeById.get(oldId)?.kind ||
            delta.contextNodeById.get(oldId)?.kind ||
            NodeIdMapUtils.assertXor(nodeIdMapCollection, oldId).node.kind;

        idsForSpecificNodeKind.add(newId);

        // Delete oldId if:
        //  * another iteration doesn't update its id to oldId
        //  * OR the old node's kind doesn't match this iterations kind
        if (!newIds.has(oldId) || xorNode.node.kind !== oldKind) {
            idsForSpecificNodeKind.delete(oldId);
        }

        const parentId: number | undefined = delta.parentIdById.get(newId);

        if (parentId !== undefined) {
            nodeIdMapCollection.parentIdById.set(newId, parentId);

            if (!delta.parentIdById.has(oldId)) {
                MapUtils.assertDelete(nodeIdMapCollection.parentIdById, oldId);
            }
        } else {
            nodeIdMapCollection.parentIdById.delete(newId);
        }
    }

    trace.exit();
}
