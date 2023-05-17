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

    const encounteredIds: number[] = [];
    let currentId: number | undefined = nodeId;
    let idQueue: number[] = [];

    while (currentId) {
        encounteredIds.push(currentId);

        const childIdsOfCurrentNode: ReadonlyArray<number> | undefined =
            nodeIdMapCollection.childIdsById.get(currentId);

        if (childIdsOfCurrentNode) {
            idQueue = childIdsOfCurrentNode.concat(idQueue);
        }

        currentId = idQueue.shift();
    }

    const numIds: number = encounteredIds.length;
    const sortedIds: ReadonlyArray<number> = [...encounteredIds].sort();
    const newIdByOldId: Map<number, number> = new Map();

    for (let index: number = 0; index < numIds; index += 1) {
        const oldId: number = encounteredIds[index];
        const newId: number = sortedIds[index];

        if (oldId !== newId) {
            newIdByOldId.set(oldId, newId);
        }
    }

    trace.exit();

    return newIdByOldId;
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

    // We'll be iterating over them twice (creating delta, applying delta) we'll grab them once.
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

    applySmallDelta(nodeIdMapCollection, newIdByOldId, xorNodes, partialDelta, traceManager, trace.id);
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

            collectionDelta.idsByNodeKind.set(xorNode.node.kind, updatedIdsForNodeKind);
        }
    }

    trace.exit();

    return collectionDelta;
}

function applySmallDelta(
    nodeIdMapCollection: Collection,
    newIdByOldId: ReadonlyMap<number, number>,
    xorNodes: ReadonlyArray<TXorNode>,
    collectionDelta: CollectionDelta,
    traceManager: TraceManager,
    correlationId: number,
): void {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, applySmallDelta.name, correlationId);

    const newNodeIds: Set<number> = new Set<number>(newIdByOldId.values());

    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = MapUtils.assertGet(newIdByOldId, oldId);

        // First, mutate the TXorNode's Id to their new Id.
        const mutableNode: TypeScriptUtils.StripReadonly<Ast.TNode | ParseContext.TNode> = xorNode.node;
        mutableNode.id = newId;

        // Second:
        //  - update the TXorNode's Id in the nodeIdMapCollection
        //  - potentially clean up the old reference when they're not being overwritten by another iteration
        if (XorNodeUtils.isAst(xorNode)) {
            nodeIdMapCollection.astNodeById.set(newId, xorNode.node);

            if (!collectionDelta.astNodeById.has(oldId) || collectionDelta.contextNodeById.has(oldId)) {
                nodeIdMapCollection.astNodeById.delete(oldId);
            }
        } else {
            nodeIdMapCollection.contextNodeById.set(newId, xorNode.node);

            if (collectionDelta.astNodeById.has(oldId) || !collectionDelta.contextNodeById.has(oldId)) {
                nodeIdMapCollection.contextNodeById.delete(oldId);
            }
        }

        // Third, update the parent linkage.
        const newParentId: number | undefined = collectionDelta.parentIdById.get(newId);

        if (newParentId !== undefined) {
            nodeIdMapCollection.parentIdById.set(newId, newParentId);

            // When there exists a grandparent <-> parent <-> child relationship
            // it's possible that the parent and child are having their Ids updated while the grandparent isn't touched,
            // meaning the grandparent isn't in newIdByOldId and thus isn't iterated over.
            // However, the grandparent is still expected to have a delta childIdsById entry.
            if (!newNodeIds.has(newParentId)) {
                const childIdsForParent: ReadonlyArray<number> | undefined =
                    collectionDelta.childIdsById.get(newParentId);

                if (childIdsForParent) {
                    nodeIdMapCollection.childIdsById.set(newParentId, childIdsForParent);
                }
            }
        }

        if (!collectionDelta.parentIdById.has(oldId)) {
            nodeIdMapCollection.parentIdById.delete(oldId);
        }

        // Fourth, update the child linkage.
        const newChildIds: ReadonlyArray<number> | undefined = collectionDelta.childIdsById.get(newId);

        if (newChildIds) {
            nodeIdMapCollection.childIdsById.set(newId, newChildIds);
        } else {
            nodeIdMapCollection.childIdsById.delete(newId);
        }

        if (!collectionDelta.childIdsById.has(oldId)) {
            nodeIdMapCollection.childIdsById.delete(oldId);
        }

        nodeIdMapCollection.idsByNodeKind.set(
            xorNode.node.kind,
            MapUtils.assertGet(collectionDelta.idsByNodeKind, xorNode.node.kind),
        );
    }

    // Fifth, update the leafIds.
    const mutableCollection: TypeScriptUtils.StripReadonly<Collection> = nodeIdMapCollection;
    mutableCollection.leafIds = collectionDelta.leafIds;

    trace.exit();
}
