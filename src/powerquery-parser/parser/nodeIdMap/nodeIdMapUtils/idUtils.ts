// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, MapUtils, TypeScriptUtils } from "../../../common";
import { NodeIdMap, NodeIdMapIterator, XorNodeUtils } from "..";
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

type CollectionDelta = Omit<Collection, "rightMostLeaf">;

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

    const collectionDelta: CollectionDelta = {
        astNodeById: new Map(),
        contextNodeById: new Map(),

        parentIdById: new Map(),
        childIdsById: new Map(),

        idsByNodeKind: new Map(),

        leafIds: new Set([...nodeIdMapCollection.leafIds].map((oldId: number) => newIdByOldId.get(oldId) ?? oldId)),
    };

    // Build up the change delta.
    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = MapUtils.assertGet(newIdByOldId, oldId);

        if (XorNodeUtils.isAst(xorNode)) {
            collectionDelta.astNodeById.set(newId, xorNode.node);
        } else {
            collectionDelta.contextNodeById.set(newId, xorNode.node);
        }

        // If the node has children and the change delta hasn't been calculated,
        // then calculate the children for the change delta.
        const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(oldId);

        if (childIds !== undefined && !collectionDelta.childIdsById.has(newId)) {
            const newChildIds: ReadonlyArray<number> = childIds.map(
                (childId: number) => newIdByOldId.get(childId) ?? childId,
            );

            collectionDelta.childIdsById.set(newId, newChildIds);
        }

        // If the node has a parent,
        // then calculate the updated parent for the change delta.
        const oldParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);

        if (oldParentId !== undefined) {
            const newParentId: number = newIdByOldId.get(oldParentId) ?? oldParentId;
            collectionDelta.parentIdById.set(newId, newParentId);

            // If the parent has children and the change delta hasn't been calculated for the parent's children,
            // then calculate the children for the change delta.
            if (!collectionDelta.childIdsById.has(newParentId)) {
                const oldChildIdsOfParent: ReadonlyArray<number> = MapUtils.assertGet(
                    nodeIdMapCollection.childIdsById,
                    oldParentId,
                );

                const newChildIdsOfParent: ReadonlyArray<number> = oldChildIdsOfParent.map(
                    (childId: number) => newIdByOldId.get(childId) ?? childId,
                );

                collectionDelta.childIdsById.set(newParentId, newChildIdsOfParent);
            }
        }

        // We either:
        // - never encountered this NodeKind, so generate a delta entry for idsByNodeKind
        // - else have encountered this NodeKind before, so we don't need to do anything
        const newIdsByNodeKind: Set<number> | undefined = collectionDelta.idsByNodeKind.get(xorNode.node.kind);

        if (newIdsByNodeKind === undefined) {
            const oldIdsForNodeKind: ReadonlySet<number> = MapUtils.assertGet(
                nodeIdMapCollection.idsByNodeKind,
                xorNode.node.kind,
                "expected node kind to exist in idsByNodeKind",
                {
                    nodeId: xorNode.node.id,
                    nodeKind: xorNode.node.kind,
                },
            );

            const updatedIdsForNodeKind: Set<number> = new Set(
                [...oldIdsForNodeKind].map((id: number) => newIdByOldId.get(id) ?? id),
            );

            Assert.isTrue(
                oldIdsForNodeKind.size === updatedIdsForNodeKind.size,
                "expected oldIdsByNodeKind and updatedIdsByNodeKind to have the same size",
                {
                    oldIdsByNodeKindSize: oldIdsForNodeKind.size,
                    updatedIdsByNodeKindSize: updatedIdsForNodeKind.size,
                },
            );

            nodeIdMapCollection.idsByNodeKind.set(xorNode.node.kind, updatedIdsForNodeKind);
        }
    }

    trace.exit();

    return collectionDelta;
}

function applyDelta(
    nodeIdMapCollection: Collection,
    newIdByOldId: ReadonlyMap<number, number>,
    xorNodes: ReadonlyArray<TXorNode>,
    collectionDelta: CollectionDelta,
    traceManager: TraceManager,
    correlationId: number,
): void {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, applyDelta.name, correlationId);

    const newNodeIds: ReadonlySet<number> = new Set(newIdByOldId.values());

    // First, mutate the TXorNodes to their new nodeIds.
    // This does not modify the NodeIdMap.Collection.
    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = MapUtils.assertGet(newIdByOldId, oldId);

        const mutableNode: TypeScriptUtils.StripReadonly<Ast.TNode | ParseContext.TNode> = xorNode.node;
        mutableNode.id = newId;
    }

    // Second, mutate NodeIdMap.Collection by way of the spread operator.
    // We merge all the old values which don't have a corresponding value in the delta, along with the delta.
    const mutableCollection: TypeScriptUtils.StripReadonly<Collection> = nodeIdMapCollection;

    mutableCollection.astNodeById = new Map([
        ...MapUtils.filter(mutableCollection.astNodeById, (nodeId: number, _: Ast.TNode) => !newNodeIds.has(nodeId)),
        ...collectionDelta.astNodeById,
    ]);

    mutableCollection.contextNodeById = new Map([
        ...MapUtils.filter(
            mutableCollection.contextNodeById,
            (nodeId: number, _: ParseContext.TNode) => !newNodeIds.has(nodeId),
        ),
        ...collectionDelta.contextNodeById,
    ]);

    mutableCollection.parentIdById = new Map([
        ...MapUtils.filter(mutableCollection.parentIdById, (parentId: number, _: number) => !newNodeIds.has(parentId)),
        ...collectionDelta.parentIdById,
    ]);

    mutableCollection.childIdsById = new Map([
        ...MapUtils.filter(
            mutableCollection.childIdsById,
            (nodeId: number, _: ReadonlyArray<number>) => !newNodeIds.has(nodeId),
        ),
        ...collectionDelta.childIdsById,
    ]);

    mutableCollection.idsByNodeKind = new Map([...mutableCollection.idsByNodeKind, ...collectionDelta.idsByNodeKind]);
    mutableCollection.leafIds = collectionDelta.leafIds;

    trace.exit();
}
