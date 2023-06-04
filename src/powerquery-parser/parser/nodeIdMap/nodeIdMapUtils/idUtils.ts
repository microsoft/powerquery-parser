/* eslint-disable @typescript-eslint/no-unused-vars */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, MapUtils, TypeScriptUtils } from "../../../common";
import { NodeIdMap, NodeIdMapUtils } from "..";
import { Trace, TraceConstant, TraceManager } from "../../../common/trace";
import { Ast } from "../../../language";
import { Collection } from "../nodeIdMap";
import { ParseContext } from "../../context";

// Helper functions which are related to updating / remapping nodeIds for NodeIdMap.Collection

let counter: number = 0;
let summedShifts: number = 0;

export function stringifyCollectionDelta(
    collectionDelta: CollectionDelta,
    newIdByOldId: ReadonlyMap<number, number>,
): string {
    return JSON.stringify(
        {
            astNodeById: Array.from(collectionDelta.astNodeById.entries()).map(
                ([newId, astNode]: [number, Ast.TNode]) => ({
                    newId,
                    oldId: astNode.id,
                    kind: astNode.kind,
                }),
            ),
            contextNodeById: Array.from(collectionDelta.contextNodeById.entries()).map(
                ([newId, parseContext]: [number, ParseContext.TNode]) => ({
                    newId,
                    oldId: parseContext.id,
                    kind: parseContext.kind,
                }),
            ),
            parentIdById: Object.fromEntries(collectionDelta.parentIdById.entries()),
            childIdsById: Object.fromEntries(collectionDelta.childIdsById.entries()),
            idsbyNodeKind: Object.fromEntries(
                [...collectionDelta.idsByNodeKind.entries()].map(([nodeKind, ids]: [Ast.NodeKind, Set<number>]) => [
                    nodeKind,
                    Array.from(ids),
                ]),
            ),
            leafIds: Array.from(collectionDelta.leafIds),
            newIdByOldId: Array.from(newIdByOldId.entries()).map(([oldId, newId]: [number, number]) => ({
                oldId,
                newId,
            })),
        },
        null,
        4,
    );
}

export function recalculateAndUpdateIds(
    updated: NodeIdMap.Collection,
    nodeId: number,
    traceManager: TraceManager,
    correlationId: number | undefined,
): void {
    counter += 1;

    console.log(`nodeId: ${nodeId}`);
    console.log(`counter: ${counter}`);

    const summaryBefore: string = JSON.stringify(NodeIdMapUtils.summary(updated), null, 4);

    if (summaryBefore.length < 0) {
        throw 1;
    }

    const original: NodeIdMap.Collection = NodeIdMapUtils.copy(updated);

    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, recalculateAndUpdateIds.name, correlationId);

    const newIdByOldIdPair: [ReadonlyMap<number, number>, ReadonlyMap<number, number>] = recalculateIds(
        updated,
        nodeId,
        traceManager,
        trace.id,
    );

    // const newIds: ReadonlyArray<number> = Array.from(newIdByOldId.values());
    // const uniqueOldIds: Set<number> = new Set(newIdByOldId.keys());
    // const uniqueNewIds: Set<number> = new Set(newIds);

    updateNodeIds(updated, newIdByOldIdPair, traceManager, trace.id);

    // Assert.isTrue(uniqueOldIds.size === uniqueNewIds.size, "oldIds.size and newIds.size are not equal", {
    //     duplicateNewIds: findNonUniqueElements(newIds),
    // });

    assertSameSize(original.astNodeById, updated.astNodeById, "astNodeById");
    assertSameSize(original.childIdsById, updated.childIdsById, "childIdsById");
    assertSameSize(original.contextNodeById, updated.contextNodeById, "contextNodeById");
    assertSameSize(original.idsByNodeKind, updated.idsByNodeKind, "idsByNodeKind");
    assertSameSize(original.leafIds, updated.leafIds, "leafIds");
    assertSameSize(original.parentIdById, updated.parentIdById, "parentIdById");

    const zipped: ReadonlyArray<[string, NodeIdMap.Collection]> = [
        ["original", original],
        ["updated", updated],
    ];

    const numChildrenCounters: Map<string, Map<number, number>> = new Map();

    for (const [tag, collection] of zipped) {
        for (const [astId, astNode] of collection.astNodeById.entries()) {
            Assert.isTrue(astId === astNode.id, "astId and astNode.id doesn't match", {
                keyId: astId,
                valueId: astNode.id,
                tag,
            });
        }

        for (const [contextId, contextNode] of collection.contextNodeById.entries()) {
            Assert.isTrue(contextId === contextNode.id, "contextId and contextNode.id doesn't match", {
                keyId: contextId,
                valueId: contextNode.id,
                tag,
            });
        }

        for (const [childId, parentId] of collection.parentIdById.entries()) {
            assertNodeIdExists(collection, parentId, tag);
            assertNodeIdExists(collection, childId, tag);

            const childIdsofParentId: ReadonlyArray<number> = MapUtils.assertGet(
                collection.childIdsById,
                parentId,
                "[childId, parentId] exists but parentId isn't in childIdsById",
                { childId, parentId, tag },
            );

            ArrayUtils.assertIn(
                childIdsofParentId,
                childId,
                "a child has a parent, but that parent isn't in the parent's list of children",
                { childId, parentId, tag },
            );
        }

        const numChildrenCounter: Map<number, number> = new Map();
        numChildrenCounters.set(tag, numChildrenCounter);

        for (const [parentId, childIds] of collection.childIdsById.entries()) {
            assertNodeIdExists(collection, parentId, tag);

            const numChildren: number = childIds.length;
            const counted: number = numChildrenCounter.get(numChildren) ?? 0;
            numChildrenCounter.set(numChildren, counted + 1);

            for (const childId of childIds) {
                assertNodeIdExists(collection, childId, tag);

                const actualParentId: number = MapUtils.assertGet(
                    collection.parentIdById,
                    childId,
                    "childId exists, but not in parentIdById",
                );

                Assert.isTrue(parentId === actualParentId, "parentId !== MapUtils.assertGet(parentIdById, childId)", {
                    parentId,
                    childId,
                    actualParentId,
                });
            }
        }

        for (const nodeIds of collection.idsByNodeKind.values()) {
            for (const nodeId of nodeIds) {
                assertNodeIdExists(collection, nodeId, tag);
            }
        }

        for (const nodeId of collection.leafIds) {
            assertNodeIdExists(collection, nodeId, tag);
        }
    }

    const originalCounter: Map<number, number> = MapUtils.assertGet(numChildrenCounters, "original");
    const updatedCounter: Map<number, number> = MapUtils.assertGet(numChildrenCounters, "updated");

    assertSameSize(originalCounter, updatedCounter, "numChildrenCounter");

    for (const [key, originalValue] of originalCounter.entries()) {
        MapUtils.assertHas(updatedCounter, key);
        const updatedValue: number = MapUtils.assertGet(updatedCounter, key);

        Assert.isTrue(originalValue === updatedValue, "numChildrenCounter diff", { key, originalValue, updatedValue });
    }

    for (const [nodeKind, originalIds] of original.idsByNodeKind.entries()) {
        const updatedIds: Set<number> = MapUtils.assertGet(updated.idsByNodeKind, nodeKind);

        Assert.isTrue(originalIds.size === updatedIds.size, "idsByNodeKind diff", { nodeKind });
    }

    trace.exit();
}

// function findNonUniqueElements<T>(arr: ReadonlyArray<T>): T[] {
//     const frequencyMap: Map<T, number> = new Map<T, number>();
//     const nonUniqueElements: T[] = [];

//     for (const item of arr) {
//         frequencyMap.set(item, (frequencyMap.get(item) || 0) + 1);
//     }

//     for (const [item, frequency] of frequencyMap) {
//         if (frequency > 1) {
//             nonUniqueElements.push(item);
//         }
//     }

//     return nonUniqueElements;
// }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assertSameSize(left: Map<any, any> | Set<any>, right: Map<any, any> | Set<any>, tag: string): void {
    Assert.isTrue(left.size === right.size, "size diff", { tag, leftSize: left.size, rightSize: right.size });
}

function assertNodeIdExists(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number, tag: string): void {
    Assert.isTrue(
        nodeIdMapCollection.contextNodeById.has(nodeId) || nodeIdMapCollection.astNodeById.has(nodeId),
        "nodeId not found",
        {
            nodeId,
            tag,
        },
    );
}

// Builds up a list of all nodeIds under the given nodeId (including itself),
// then creates a Map<oldId, newId> such that the Ids are in a BFS ordering.
// Does not include nodeIds which remain unchanged.
export function recalculateIds(
    nodeIdMapCollection: NodeIdMap.Collection,
    nodeId: number,
    traceManager: TraceManager,
    correlationId: number | undefined,
): [ReadonlyMap<number, number>, ReadonlyMap<number, number>] {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, recalculateIds.name, correlationId);

    const encounteredIds: number[] = [];
    let currentId: number | undefined = nodeId;
    let idQueue: number[] = [];

    let numShifts: number = 0;

    while (currentId) {
        encounteredIds.push(currentId);

        const childIdsOfCurrentNode: ReadonlyArray<number> | undefined =
            nodeIdMapCollection.childIdsById.get(currentId);

        if (childIdsOfCurrentNode) {
            idQueue = childIdsOfCurrentNode.concat(idQueue);
        }

        currentId = idQueue.shift();

        numShifts += 1;
    }

    summedShifts += numShifts;
    console.log(`numShifts: ${numShifts}`);
    console.log(`summedShifts: ${summedShifts}`);

    // const newIdByOldId: Map<number, number> = new Map<number, number>(
    //     encounteredIds.map((nodeId: number) => [nodeId, nodeId + 1000]),
    // );

    const numIds: number = encounteredIds.length;
    const sortedIds: ReadonlyArray<number> = [...encounteredIds].sort();
    const newIdByOldId1: Map<number, number> = new Map();
    const newIdByOldId2: Map<number, number> = new Map();

    for (let index: number = 0; index < numIds; index += 1) {
        const oldId: number = encounteredIds[index];
        const newId: number = sortedIds[index];

        newIdByOldId1.set(oldId, newId);

        // [960, 961, 962, 963, 964, 965, 966, 968, 969]
        if (oldId !== newId) {
            newIdByOldId2.set(oldId, newId);
        }
    }

    trace.exit();

    return [newIdByOldId1, newIdByOldId2];
}

// Given a mapping of (existingId) => (newId) this mutates the NodeIdMap.Collection and the TXorNodes it holds.
// Assumes the given arguments are valid as this function does no validation.
export function updateNodeIds(
    nodeIdMapCollection: Collection,
    newIdByOldIdPair: [ReadonlyMap<number, number>, ReadonlyMap<number, number>],
    traceManager: TraceManager,
    correlationId: number | undefined,
): void {
    const trace: Trace = traceManager.entry(IdUtilsTraceConstant.IdUtils, updateNodeIds.name, correlationId, {});

    // if (newIdByOldId.size === 0) {
    //     trace.exit({ [TraceConstant.Size]: newIdByOldId.size });

    //     return;
    // }

    // Storage for the change delta which is used to mutate nodeIdMapCollection.
    const collectionDelta1: CollectionDelta = createDelta(
        nodeIdMapCollection,
        newIdByOldIdPair[0],
        traceManager,
        trace.id,
    );

    const collectionDelta2: CollectionDelta = createDelta(
        nodeIdMapCollection,
        newIdByOldIdPair[1],
        traceManager,
        trace.id,
    );

    const jsonifiedDelta1: string = stringifyCollectionDelta(collectionDelta1, newIdByOldIdPair[0]);
    const jsonifiedDelta2: string = stringifyCollectionDelta(collectionDelta2, newIdByOldIdPair[1]);

    if (jsonifiedDelta1.length < 0 || jsonifiedDelta2.length < 0) {
        throw 1;
    }

    const copied1: NodeIdMap.Collection = NodeIdMapUtils.copy(nodeIdMapCollection);
    const copied2: NodeIdMap.Collection = NodeIdMapUtils.copy(nodeIdMapCollection);

    if (copied1 === copied2) {
        throw 1;
    }

    applyCollectionDelta(copied1, collectionDelta1, traceManager, trace.id);
    applyCollectionDelta(copied2, collectionDelta2, traceManager, trace.id);

    const summaryAfter1: string = JSON.stringify(NodeIdMapUtils.summary(copied1), null, 4);
    const summaryAfter2: string = JSON.stringify(NodeIdMapUtils.summary(copied2), null, 4);

    if (summaryAfter1.length < 0 || summaryAfter2.length < 0) {
        throw 1;
    }

    applyCollectionDelta(nodeIdMapCollection, collectionDelta2, traceManager, trace.id);

    trace.exit({ [TraceConstant.Size]: newIdByOldIdPair.length });
}

const enum IdUtilsTraceConstant {
    IdUtils = "IdUtils",
    MapSize = "MapSize",
}

type CollectionDelta = Omit<Collection, "rightMostLeaf">;

function createDelta(
    nodeIdMapCollection: Collection,
    newIdByOldId: ReadonlyMap<number, number>,
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

    for (const [oldId, newId] of newIdByOldId.entries()) {
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

        const oldParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);

        if (oldParentId) {
            const newParentId: number = newIdByOldId.get(oldParentId) ?? oldParentId;

            collectionDelta.parentIdById.set(newId, newParentId);

            collectionDelta.childIdsById.set(
                newParentId,
                MapUtils.assertGet(nodeIdMapCollection.childIdsById, oldParentId).map(
                    (childId: number) => newIdByOldId.get(childId) ?? childId,
                ),
            );
        }

        const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(oldId);

        if (childIds) {
            collectionDelta.childIdsById.set(
                newId,
                childIds.map((childId: number) => newIdByOldId.get(childId) ?? childId),
            );
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

            const newIdsForNodeKind: Set<number> = new Set(
                [...oldIdsForNodeKind].map((id: number) => newIdByOldId.get(id) ?? id),
            );

            collectionDelta.idsByNodeKind.set(nodeKind, newIdsForNodeKind);
        }
    }

    // // Build up the change delta.
    // for (const xorNode of xorNodes) {
    //     const oldId: number = xorNode.node.id;
    //     const newId: number = MapUtils.assertGet(newIdByOldId, oldId);

    //     if (XorNodeUtils.isAst(xorNode)) {
    //         collectionDelta.astNodeById.set(newId, xorNode.node);
    //     } else {
    //         collectionDelta.contextNodeById.set(newId, xorNode.node);
    //     }

    //     // If the node has children and the change delta hasn't been calculated,
    //     // then calculate the children for the change delta.
    //     const childIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(oldId);

    //     if (childIds !== undefined && !collectionDelta.childIdsById.has(newId)) {
    //         const newChildIds: ReadonlyArray<number> = childIds.map(
    //             (childId: number) => newIdByOldId.get(childId) ?? childId,
    //         );

    //         collectionDelta.childIdsById.set(newId, newChildIds);
    //     }

    //     // If the node has a parent,
    //     // then calculate the updated parent for the change delta.
    //     const oldParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);

    //     if (oldParentId !== undefined) {
    //         const newParentId: number = newIdByOldId.get(oldParentId) ?? oldParentId;
    //         collectionDelta.parentIdById.set(newId, newParentId);

    //         // If the parent has children and the change delta hasn't been calculated for the parent's children,
    //         // then calculate the children for the change delta.
    //         if (!collectionDelta.childIdsById.has(newParentId)) {
    //             const oldChildIdsOfParent: ReadonlyArray<number> = MapUtils.assertGet(
    //                 nodeIdMapCollection.childIdsById,
    //                 oldParentId,
    //             );

    //             const newChildIdsOfParent: ReadonlyArray<number> = oldChildIdsOfParent.map(
    //                 (childId: number) => newIdByOldId.get(childId) ?? childId,
    //             );

    //             collectionDelta.childIdsById.set(newParentId, newChildIdsOfParent);
    //         }
    //     }

    //     // We either:
    //     // - never encountered this NodeKind, so generate a delta entry for idsByNodeKind
    //     // - else have encountered this NodeKind before, so we don't need to do anything
    //     const newIdsByNodeKind: Set<number> | undefined = collectionDelta.idsByNodeKind.get(xorNode.node.kind);

    //     if (newIdsByNodeKind === undefined) {
    //         const oldIdsForNodeKind: ReadonlySet<number> = MapUtils.assertGet(
    //             nodeIdMapCollection.idsByNodeKind,
    //             xorNode.node.kind,
    //             "expected node kind to exist in idsByNodeKind",
    //             {
    //                 nodeId: xorNode.node.id,
    //                 nodeKind: xorNode.node.kind,
    //             },
    //         );

    //         const updatedIdsForNodeKind: Set<number> = new Set(
    //             [...oldIdsForNodeKind].map((id: number) => newIdByOldId.get(id) ?? id),
    //         );

    //         Assert.isTrue(
    //             oldIdsForNodeKind.size === updatedIdsForNodeKind.size,
    //             "expected oldIdsByNodeKind and updatedIdsByNodeKind to have the same size",
    //             {
    //                 oldIdsByNodeKindSize: oldIdsForNodeKind.size,
    //                 updatedIdsByNodeKindSize: updatedIdsForNodeKind.size,
    //             },
    //         );

    //         collectionDelta.idsByNodeKind.set(xorNode.node.kind, updatedIdsForNodeKind);
    //     }
    // }

    trace.exit();

    return collectionDelta;
}

function cleanupCollectionDeltaOrphan(
    nodeIdMapCollection: Collection,
    collectionDelta: CollectionDelta,
    oldId: number,
): void {
    if (!collectionDelta.parentIdById.has(oldId)) {
        nodeIdMapCollection.parentIdById.delete(oldId);
    }

    if (!collectionDelta.childIdsById.has(oldId)) {
        nodeIdMapCollection.childIdsById.delete(oldId);
    }
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

        cleanupCollectionDeltaOrphan(nodeIdMapCollection, collectionDelta, oldId);
    }

    for (const [newId, contextNode] of collectionDelta.contextNodeById.entries()) {
        const oldId: number = contextNode.id;

        const mutableNode: TypeScriptUtils.StripReadonly<ParseContext.TNode> = contextNode;
        mutableNode.id = newId;

        nodeIdMapCollection.contextNodeById.set(newId, contextNode);

        if (!collectionDelta.contextNodeById.has(oldId)) {
            nodeIdMapCollection.contextNodeById.delete(oldId);
        }

        cleanupCollectionDeltaOrphan(nodeIdMapCollection, collectionDelta, oldId);
    }

    for (const [newId, newParentId] of collectionDelta.parentIdById.entries()) {
        nodeIdMapCollection.parentIdById.set(newId, newParentId);
    }

    for (const [newId, newChildIds] of collectionDelta.childIdsById.entries()) {
        nodeIdMapCollection.childIdsById.set(newId, newChildIds);
    }

    for (const [nodeKind, newIds] of collectionDelta.idsByNodeKind.entries()) {
        nodeIdMapCollection.idsByNodeKind.set(nodeKind, newIds);
    }

    nodeIdMapCollection.leafIds.clear();

    for (const leafId of collectionDelta.leafIds) {
        nodeIdMapCollection.leafIds.add(leafId);
    }

    // for (const xorNode of xorNodes) {
    //     const oldId: number = xorNode.node.id;
    //     const newId: number = MapUtils.assertGet(newIdByOldId, oldId);

    //     // First, mutate the TXorNode's Id to their new Id.
    //     const mutableNode: TypeScriptUtils.StripReadonly<Ast.TNode | ParseContext.TNode> = xorNode.node;
    //     mutableNode.id = newId;

    //     // Second:
    //     //  - update the TXorNode's Id in the nodeIdMapCollection
    //     //  - potentially clean up the old reference if they're not being overwritten by another iteration
    //     if (XorNodeUtils.isAst(xorNode)) {
    //         nodeIdMapCollection.astNodeById.set(newId, xorNode.node);

    //         if (!collectionDelta.astNodeById.has(oldId)) {
    //             nodeIdMapCollection.astNodeById.delete(oldId);
    //         }
    //     } else {
    //         nodeIdMapCollection.contextNodeById.set(newId, xorNode.node);

    //         if (!collectionDelta.contextNodeById.has(oldId)) {
    //             nodeIdMapCollection.contextNodeById.delete(oldId);
    //         }
    //     }

    //     // Third, update the parent linkage.
    //     const newParentId: number | undefined = collectionDelta.parentIdById.get(newId);

    //     if (newParentId !== undefined) {
    //         nodeIdMapCollection.parentIdById.set(newId, newParentId);

    //         // When there exists a grandparent <-> parent <-> child relationship
    //         // it's possible that the parent and child are having their Ids updated while the grandparent isn't touched,
    //         // meaning the grandparent isn't in newIdByOldId and thus isn't iterated over.
    //         // However, the grandparent is still expected to have a delta childIdsById entry.
    //         if (!collectionDelta.childIdsById.has(newParentId)) {
    //             const childIdsForParent: ReadonlyArray<number> = MapUtils.assertGet(
    //                 collectionDelta.childIdsById,
    //                 newParentId,
    //             );

    //             nodeIdMapCollection.childIdsById.set(newParentId, childIdsForParent);
    //         }
    //     }

    //     // Fourth, update the child linkage.
    //     const newChildIds: ReadonlyArray<number> | undefined = collectionDelta.childIdsById.get(newId);

    //     if (newChildIds) {
    //         nodeIdMapCollection.childIdsById.set(newId, newChildIds);
    //     }

    //     if (!collectionDelta.parentIdById.has(oldId)) {
    //         nodeIdMapCollection.parentIdById.delete(oldId);
    //     }

    //     if (!collectionDelta.childIdsById.has(oldId)) {
    //         nodeIdMapCollection.childIdsById.delete(oldId);
    //     }

    //     nodeIdMapCollection.idsByNodeKind.set(
    //         xorNode.node.kind,
    //         MapUtils.assertGet(collectionDelta.idsByNodeKind, xorNode.node.kind),
    //     );
    // }

    // // Fifth, update the leafIds.
    // const mutableCollection: TypeScriptUtils.StripReadonly<Collection> = nodeIdMapCollection;
    // mutableCollection.leafIds = collectionDelta.leafIds;

    trace.exit();
}
