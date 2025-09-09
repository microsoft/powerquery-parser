// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { MapUtils, TypeScriptUtils } from "../../../common";
import { Trace, TraceConstant, TraceManager } from "../../../common/trace";
import { Ast } from "../../../language";
import { Collection } from "../nodeIdMap";
import { NodeIdMap } from "..";
import { ParseContext } from "../../context";

// Helper functions which are related to updating / remapping nodeIds for NodeIdMap.Collection

export function recalculateAndUpdateIds(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    traceManager: TraceManager,
    correlationId: number | undefined,
): void {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, recalculateAndUpdateIds.name, correlationId);

    const newIdByOldId: ReadonlyMap<number, number> = recalculateIds(
        nodeIdMapCollection,
        nodeId,
        traceManager,
        trace.id,
    );

    updateNodeIds(nodeIdMapCollection, newIdByOldId, traceManager, trace.id);

    trace.exit();
}

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
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, updateNodeIds.name, correlationId);

    if (newIdByOldId.size === 0) {
        trace.exit({ [TraceConstant.Size]: newIdByOldId.size });

        return;
    }

    // Storage for the change delta which is used to mutate nodeIdMapCollection.
    const collectionDelta: CollectionDelta = createDelta(nodeIdMapCollection, newIdByOldId, traceManager, trace.id);

    applyCollectionDelta(nodeIdMapCollection, collectionDelta, traceManager, trace.id);

    trace.exit({ [TraceConstant.Size]: newIdByOldId.size });
}

const enum IdUtilsTraceConstant {
    IdUtils = "IdUtils",
}

type CollectionDelta = Pick<Collection, "astNodeById" | "contextNodeById" | "leafIds" | "idsByNodeKind"> & {
    readonly parentIdById: Map<number, IdValueUpdate<number>>;
    readonly childIdsById: Map<number, IdValueUpdate<ReadonlyArray<number>>>;
};

function updatedChildIds(
    newIdByOldId: ReadonlyMap<number, number>,
    oldChildIds: ReadonlyArray<number>,
): ReadonlyArray<number> {
    return oldChildIds.map((childId: number) => newIdByOldId.get(childId) ?? childId);
}

interface IdValueUpdate<T> {
    readonly oldId: number;
    readonly value: T;
}

function createDelta(
    nodeIdMapCollection: Collection,
    newIdByOldId: ReadonlyMap<number, number>,
    traceManager: TraceManager,
    correlationId: number,
): CollectionDelta {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, createDelta.name, correlationId, {
        [TraceConstant.Size]: newIdByOldId.size,
    });

    const collectionDelta: CollectionDelta = {
        astNodeById: new Map(),
        contextNodeById: new Map(),

        parentIdById: new Map(),
        childIdsById: new Map(),

        idsByNodeKind: new Map(),

        leafIds: new Set([...nodeIdMapCollection.leafIds].map((oldId: number) => newIdByOldId.get(oldId) ?? oldId)),
    };

    for (const [oldId, newId] of newIdByOldId.entries()) {
        const oldParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);

        if (oldParentId !== undefined) {
            const newParentId: number = newIdByOldId.get(oldParentId) ?? oldParentId;

            collectionDelta.parentIdById.set(newId, {
                oldId,
                value: newParentId,
            });

            if (!collectionDelta.childIdsById.has(newParentId)) {
                collectionDelta.childIdsById.set(newParentId, {
                    oldId: oldParentId,
                    value: updatedChildIds(
                        newIdByOldId,
                        MapUtils.assertGet(nodeIdMapCollection.childIdsById, oldParentId),
                    ),
                });
            }
        }

        const astNode: Ast.TNode | undefined = nodeIdMapCollection.astNodeById.get(oldId);
        let nodeKind: Ast.NodeKind;

        if (astNode) {
            collectionDelta.astNodeById.set(newId, astNode);
            nodeKind = astNode.kind;
        } else {
            const parseContextNode: ParseContext.TNode | undefined = MapUtils.assertGet(
                nodeIdMapCollection.contextNodeById,
                oldId,
                `nodeIdMapCollection has neither astNode nor parseContextNode`,
            );

            collectionDelta.contextNodeById.set(newId, parseContextNode);
            nodeKind = parseContextNode.kind;
        }

        const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(oldId);

        if (childIds && !collectionDelta.childIdsById.has(newId)) {
            for (const childId of childIds) {
                const newChildId: number = newIdByOldId.get(childId) ?? childId;

                if (newChildId !== childId) {
                    collectionDelta.parentIdById.set(newChildId, {
                        oldId: childId,
                        value: newChildId,
                    });
                }
            }

            collectionDelta.childIdsById.set(newId, {
                oldId,
                value: updatedChildIds(newIdByOldId, childIds),
            });
        }

        if (!collectionDelta.idsByNodeKind.has(nodeKind)) {
            const oldIdsForNodeKind: ReadonlySet<number> = MapUtils.assertGet(
                nodeIdMapCollection.idsByNodeKind,
                nodeKind,
                "expected node kind to exist in idsByNodeKind",
                {
                    oldId,
                    nodeKind,
                },
            );

            const newIdsForNodeKind: Set<number> = new Set();

            for (const id of oldIdsForNodeKind) {
                newIdsForNodeKind.add(newIdByOldId.get(id) ?? id);
            }

            collectionDelta.idsByNodeKind.set(nodeKind, newIdsForNodeKind);
        }
    }

    trace.exit();

    return collectionDelta;
}

function applyCollectionDelta(
    nodeIdMapCollection: Collection,
    collectionDelta: CollectionDelta,
    traceManager: TraceManager,
    correlationId: number,
): void {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, applyCollectionDelta.name, correlationId);

    for (const [newId, astNode] of collectionDelta.astNodeById.entries()) {
        const oldId: number = astNode.id;

        const mutableNode: TypeScriptUtils.StripReadonly<Ast.TNode> = astNode;
        mutableNode.id = newId;

        nodeIdMapCollection.astNodeById.set(newId, astNode);

        if (!collectionDelta.astNodeById.has(oldId)) {
            nodeIdMapCollection.astNodeById.delete(oldId);
        }
    }

    for (const [newId, contextNode] of collectionDelta.contextNodeById.entries()) {
        const oldId: number = contextNode.id;

        const mutableNode: TypeScriptUtils.StripReadonly<ParseContext.TNode> = contextNode;
        mutableNode.id = newId;

        nodeIdMapCollection.contextNodeById.set(newId, contextNode);

        if (!collectionDelta.contextNodeById.has(oldId)) {
            nodeIdMapCollection.contextNodeById.delete(oldId);
        }
    }

    for (const [newId, { oldId, value }] of collectionDelta.parentIdById.entries()) {
        nodeIdMapCollection.parentIdById.set(newId, value);

        if (!collectionDelta.parentIdById.has(oldId)) {
            nodeIdMapCollection.parentIdById.delete(oldId);
        }
    }

    for (const [newId, { oldId, value }] of collectionDelta.childIdsById.entries()) {
        nodeIdMapCollection.childIdsById.set(newId, value);

        if (!collectionDelta.childIdsById.has(oldId)) {
            nodeIdMapCollection.childIdsById.delete(oldId);
        }
    }

    for (const [nodeKind, newIds] of collectionDelta.idsByNodeKind.entries()) {
        nodeIdMapCollection.idsByNodeKind.set(nodeKind, newIds);
    }

    nodeIdMapCollection.leafIds.clear();

    for (const leafId of collectionDelta.leafIds) {
        nodeIdMapCollection.leafIds.add(leafId);
    }

    trace.exit();
}
