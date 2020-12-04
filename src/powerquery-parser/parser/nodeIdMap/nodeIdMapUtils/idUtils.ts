// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, NodeIdMapIterator } from "..";
import { MapUtils, TypeScriptUtils } from "../../../common";
import { Ast } from "../../../../language";
import { ParseContext } from "../../context";
import { Collection } from "../nodeIdMap";
import { TXorNode, XorNodeKind } from "../xorNode";

// Helper functions which are related to updating / remapping nodeIds for NodeIdMap.Collection

// Returns a map of `oldId -> newId` which follows the ID ordering invariant,
// expected to be consumed by updateNodeIds.
// Used to restore the nodeId ordering invariant after manual mangling of the Ast.
export function recalculateIds(nodeIdMapCollection: NodeIdMap.Collection, nodeStart: TXorNode): Map<number, number> {
    const visitedXorNodes: TXorNode[] = [];
    const nodeIds: number[] = [];

    let nodeStack: TXorNode[] = [];
    let currentNode: TXorNode | undefined = nodeStart;
    while (currentNode !== undefined) {
        nodeIds.push(currentNode.node.id);
        visitedXorNodes.push(currentNode);

        const childrenOfCurrentNode: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterChildrenXor(
            nodeIdMapCollection,
            currentNode.node.id,
        );
        const reversedChildrenOfCurrentNode: ReadonlyArray<TXorNode> = [...childrenOfCurrentNode].reverse();
        nodeStack = nodeStack.concat(reversedChildrenOfCurrentNode);

        currentNode = nodeStack.pop();
    }

    nodeIds.sort((left: number, right: number) => left - right);
    const newNodeIdByOldNodeId: Map<number, number> = new Map(
        visitedXorNodes.map((xorNode: TXorNode, index: number) => {
            return [xorNode.node.id, nodeIds[index]];
        }),
    );

    return newNodeIdByOldNodeId;
}

// Given a mapping of (existingId) => (newId) this mutates the NodeIdMap.Collection and the TXorNodes it holds.
// Assumes the given arguments are valid as this function does no validation.
export function updateNodeIds(nodeIdMapCollection: Collection, newNodeIdByOldNodeId: Map<number, number>): void {
    if (newNodeIdByOldNodeId.size === 0) {
        return;
    }

    // We'll be iterating over them twice, so grab them once.
    const xorNodes: ReadonlyArray<TXorNode> = NodeIdMapIterator.assertIterXor(nodeIdMapCollection, [
        ...newNodeIdByOldNodeId.keys(),
    ]);

    // Storage for the change delta before modifying nodeIdMapCollection.
    const partialCollection: Collection = {
        astNodeById: new Map(),
        childIdsById: new Map(),
        contextNodeById: new Map(),
        maybeRightMostLeaf: undefined,
        parentIdById: new Map(),
    };

    // Build up the change delta.
    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = newNodeIdByOldNodeId.get(oldId)!;

        if (xorNode.kind === XorNodeKind.Ast) {
            partialCollection.astNodeById.set(newId, xorNode.node);
        } else {
            partialCollection.contextNodeById.set(newId, xorNode.node);
        }

        // If the node has children and the change delta hasn't been calculated,
        // then calculate the children for the change delta.
        const maybeChildIds: ReadonlyArray<number> | undefined = nodeIdMapCollection.childIdsById.get(oldId);
        if (maybeChildIds !== undefined && !partialCollection.childIdsById.has(newId)) {
            const newChildIds: ReadonlyArray<number> = maybeChildIds.map(
                (childId: number) => newNodeIdByOldNodeId.get(childId) ?? childId,
            );
            partialCollection.childIdsById.set(newId, newChildIds);
        }

        // If the node has a parent,
        // then calculate the updated parent for the change delta.
        const maybeOldParentId: number | undefined = nodeIdMapCollection.parentIdById.get(oldId);
        if (maybeOldParentId !== undefined) {
            const newParentId: number = newNodeIdByOldNodeId.get(maybeOldParentId) ?? maybeOldParentId;
            partialCollection.parentIdById.set(newId, newParentId);

            // If the parent has children and the change delta hasn't been calculated for the parent's children,
            // then calculate the children for the change delta.
            if (!partialCollection.childIdsById.has(newParentId)) {
                const oldChildIdsOfParent: ReadonlyArray<number> = MapUtils.assertGet(
                    nodeIdMapCollection.childIdsById,
                    maybeOldParentId,
                );
                const newChildIdsOfParent: ReadonlyArray<number> = oldChildIdsOfParent.map(
                    (childId: number) => newNodeIdByOldNodeId.get(childId) ?? childId,
                );
                partialCollection.childIdsById.set(newParentId, newChildIdsOfParent);
            }
        }
    }

    // Apply the change delta
    for (const xorNode of xorNodes) {
        const oldId: number = xorNode.node.id;
        const newId: number = newNodeIdByOldNodeId.get(oldId)!;

        if (xorNode.kind === XorNodeKind.Ast) {
            const mutableNode: TypeScriptUtils.StripReadonly<Ast.TNode> = xorNode.node;
            mutableNode.id = newId;
            nodeIdMapCollection.astNodeById.set(newId, mutableNode);
            if (!partialCollection.astNodeById.has(oldId)) {
                nodeIdMapCollection.astNodeById.delete(oldId);
            }
        } else {
            const mutableNode: TypeScriptUtils.StripReadonly<ParseContext.Node> = xorNode.node;
            mutableNode.id = newId;
            nodeIdMapCollection.contextNodeById.set(newId, mutableNode);
            if (!partialCollection.contextNodeById.has(oldId)) {
                nodeIdMapCollection.contextNodeById.delete(oldId);
            }
        }

        const maybeParentId: number | undefined = partialCollection.parentIdById.get(newId);
        if (maybeParentId !== undefined) {
            nodeIdMapCollection.parentIdById.set(newId, maybeParentId);
            if (!partialCollection.parentIdById.has(oldId)) {
                MapUtils.assertDelete(nodeIdMapCollection.parentIdById, oldId);
            }
        } else {
            nodeIdMapCollection.parentIdById.delete(newId);
        }

        const maybeChildIds: ReadonlyArray<number> | undefined = partialCollection.childIdsById.get(newId);
        if (maybeChildIds !== undefined) {
            nodeIdMapCollection.childIdsById.set(newId, maybeChildIds);
            if (!partialCollection.parentIdById.has(oldId)) {
                MapUtils.assertDelete(nodeIdMapCollection.childIdsById, oldId);
            }
        } else {
            nodeIdMapCollection.childIdsById.delete(newId);
        }
    }
}
