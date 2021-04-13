// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap, ParseContext } from "..";
import { ArrayUtils, Assert, CommonError, MapUtils, SetUtils, TypeScriptUtils } from "../../common";
import { Ast, Token } from "../../language";
import { NodeIdMapIterator, NodeIdMapUtils, TXorNode } from "../nodeIdMap";
import { Node, State } from "./context";

export function createState(): State {
    return {
        nodeIdMapCollection: {
            astNodeById: new Map(),
            childIdsById: new Map(),
            contextNodeById: new Map(),
            leafNodeIds: new Set(),
            maybeRightMostLeaf: undefined,
            nodeIdsByNodeKind: new Map(),
            parentIdById: new Map(),
        },
        maybeRoot: undefined,
        idCounter: 0,
        leafNodeIds: new Set(),
    };
}

export function copyState(state: State): State {
    const maybeRoot: Node | undefined = state.maybeRoot !== undefined ? { ...state.maybeRoot } : undefined;

    return {
        ...state,
        maybeRoot,
        nodeIdMapCollection: NodeIdMapUtils.copy(state.nodeIdMapCollection),
    };
}

export function nextId(state: State): number {
    state.idCounter += 1;
    return state.idCounter;
}

export function nextAttributeIndex(parentNode: Node): number {
    const result: number = parentNode.attributeCounter;
    parentNode.attributeCounter += 1;
    return result;
}

export function startContext(
    state: State,
    nodeKind: Ast.NodeKind,
    tokenIndexStart: number,
    maybeTokenStart: Token.Token | undefined,
    maybeParentNode: Node | undefined,
): Node {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    let maybeAttributeIndex: number | undefined;

    const nodeId: number = nextId(state);

    // If a parent context Node exists, update the parent/child mapping attributes and attributeCounter.
    if (maybeParentNode) {
        const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
        const parentNode: Node = maybeParentNode;
        const parentId: number = parentNode.id;

        maybeAttributeIndex = nextAttributeIndex(parentNode);
        nodeIdMapCollection.parentIdById.set(nodeId, parentId);

        const maybeExistingChildren: ReadonlyArray<number> | undefined = childIdsById.get(parentId);
        if (maybeExistingChildren) {
            const existingChildren: ReadonlyArray<number> = maybeExistingChildren;
            childIdsById.set(parentId, [...existingChildren, nodeId]);
        } else {
            childIdsById.set(parentId, [nodeId]);
        }
    }

    const contextNode: Node = {
        id: nodeId,
        kind: nodeKind,
        tokenIndexStart,
        maybeTokenStart,
        attributeCounter: 0,
        isClosed: false,
        maybeAttributeIndex,
    };
    nodeIdMapCollection.contextNodeById.set(nodeId, contextNode);
    if (state.maybeRoot === undefined) {
        state.maybeRoot = contextNode;
    }

    const nodeIdsByNodeKind: NodeIdMap.NodeIdsByNodeKind = nodeIdMapCollection.nodeIdsByNodeKind;
    const maybeNodeIdsForKind: Set<number> | undefined = nodeIdsByNodeKind.get(nodeKind);
    if (maybeNodeIdsForKind) {
        maybeNodeIdsForKind.add(nodeId);
    } else {
        nodeIdsByNodeKind.set(nodeKind, new Set([nodeId]));
    }

    return contextNode;
}

// Returns the Node's parent context (if one exists).
export function endContext(state: State, contextNode: Node, astNode: Ast.TNode): Node | undefined {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    if (state.maybeRoot?.id === astNode.id) {
        Assert.isTrue(
            state.nodeIdMapCollection.contextNodeById.size === 1,
            "failed to endContext on the root node as at least one other context node exists",
            { nodeId: contextNode.id },
        );
    }

    contextNode.isClosed = true;

    if (astNode.isLeaf) {
        SetUtils.assertAddUnique(
            state.nodeIdMapCollection.leafNodeIds,
            contextNode.id,
            `failed to endContext on a leaf node as it shares a nodeId with an already existing leaf node`,
            { nodeId: contextNode.id },
        );
    }

    // Ending a context should return the context's parent node (if one exists).
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(contextNode.id);
    const maybeParentNode: Node | undefined =
        maybeParentId !== undefined ? nodeIdMapCollection.contextNodeById.get(maybeParentId) : undefined;

    // Move nodeId from contextNodeMap to astNodeMap.
    MapUtils.assertDelete(
        nodeIdMapCollection.contextNodeById,
        contextNode.id,
        "failed to endContext as the given nodeId isn't a valid context nodeId",
        { nodeId: contextNode.id },
    );
    nodeIdMapCollection.astNodeById.set(astNode.id, astNode);

    // Update maybeRightMostLeaf when applicable
    if (astNode.isLeaf) {
        if (
            nodeIdMapCollection.maybeRightMostLeaf === undefined ||
            nodeIdMapCollection.maybeRightMostLeaf.tokenRange.tokenIndexStart < astNode.tokenRange.tokenIndexStart
        ) {
            const unsafeNodeIdMapCollection: TypeScriptUtils.StripReadonly<NodeIdMap.Collection> = nodeIdMapCollection;
            unsafeNodeIdMapCollection.maybeRightMostLeaf = astNode;
        }
    }

    return maybeParentNode;
}

export function deleteAst(state: State, nodeId: number, parentWillBeDeleted: boolean): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    const astNode: Ast.TNode = MapUtils.assertGet(
        astNodeById,
        nodeId,
        `failed to deleteAst as the given nodeId isn't a valid Ast nodeId`,
        { nodeId },
    );
    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
    const parentIdById: NodeIdMap.ParentIdById = nodeIdMapCollection.parentIdById;

    // If Node was a leaf node, remove it from the list of leaf nodes.
    if (astNode.isLeaf) {
        SetUtils.assertDelete(
            nodeIdMapCollection.leafNodeIds,
            nodeId,
            "failed to deleteAst as the node is a leaf node, but it wasn't present in leafNodeIds",
            { nodeId },
        );
    }

    const maybeParentId: number | undefined = parentIdById.get(nodeId);
    const maybeChildIds: ReadonlyArray<number> | undefined = childIdsById.get(nodeId);

    // Not a leaf node.
    Assert.isUndefined(
        maybeChildIds,
        `failed to deleteAst as the given nodeId has one ore more children which must be deleted first`,
        {
            nodeId,
            childIds: maybeChildIds,
        },
    );

    // Is a leaf node, not root node.
    // Delete the node from the list of children under the node's parent.
    if (maybeParentId) {
        const parentId: number = maybeParentId;
        Assert.isFalse(
            astNodeById.has(maybeParentId) && !parentWillBeDeleted,
            `parent is an Ast node not marked for deletion`,
            {
                parentId,
                nodeId,
            },
        );
        removeOrReplaceChildId(nodeIdMapCollection, parentId, nodeId, undefined);
    }
    // Else is root node, is leaf node.
    // No children updates need to be taken.

    // Remove the node from existence.
    deleteFromKindMap(nodeIdMapCollection, nodeId);
    astNodeById.delete(nodeId);
    childIdsById.delete(nodeId);
    parentIdById.delete(nodeId);
}

export function deleteContext(state: State, nodeId: number): Node | undefined {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
    const contextNodeById: NodeIdMap.ContextNodeById = nodeIdMapCollection.contextNodeById;
    const leafNodeIds: Set<number> = nodeIdMapCollection.leafNodeIds;
    const parentIdById: NodeIdMap.ParentIdById = nodeIdMapCollection.parentIdById;

    const maybeContextNode: Node | undefined = contextNodeById.get(nodeId);
    if (maybeContextNode === undefined) {
        throw new CommonError.InvariantError(`failed to deleteContext as the given nodeId isn't a valid context node`, {
            nodeId,
        });
    }
    const contextNode: Node = maybeContextNode;

    const maybeParentId: number | undefined = parentIdById.get(nodeId);
    const maybeChildIds: ReadonlyArray<number> | undefined = childIdsById.get(nodeId);

    // Not a leaf node.
    if (maybeChildIds !== undefined) {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        ArrayUtils.assertNonZeroLength(childIds);
        const childId: number = childIds[0];

        // Not a leaf node, is the Root node.
        // Promote the child to the root if it's a Context node.
        if (maybeParentId === undefined) {
            parentIdById.delete(childId);
            const maybeChildContext: Node | undefined = contextNodeById.get(childId);
            if (maybeChildContext) {
                const childContext: Node = maybeChildContext;
                state.maybeRoot = childContext;
            }
        }
        // Not a leaf node, not the Root node.
        // Replace the node from the list of children under the node's parent using the node's child
        else {
            const parentId: number = maybeParentId;
            removeOrReplaceChildId(nodeIdMapCollection, parentId, nodeId, childId);
        }

        // The child Node inherits the attributeIndex.
        const childXorNode: TXorNode = NodeIdMapUtils.assertGetXor(state.nodeIdMapCollection, childId);
        const mutableChildXorNode: TypeScriptUtils.StripReadonly<Ast.TNode | Node> = childXorNode.node;
        mutableChildXorNode.maybeAttributeIndex = contextNode.maybeAttributeIndex;
    }
    // Is a leaf node, not root node.
    // Delete the node from the list of children under the node's parent.
    else if (maybeParentId) {
        const parentId: number = maybeParentId;
        removeOrReplaceChildId(nodeIdMapCollection, parentId, nodeId, undefined);
    }
    // Else is root node, is leaf node.
    // No children updates need to be taken.

    // Remove the node from existence.
    deleteFromKindMap(nodeIdMapCollection, nodeId);
    contextNodeById.delete(nodeId);
    childIdsById.delete(nodeId);
    parentIdById.delete(nodeId);
    leafNodeIds.delete(nodeId);

    // Return the node's parent if it exits
    return maybeParentId !== undefined ? NodeIdMapUtils.assertGetContext(contextNodeById, maybeParentId) : undefined;
}

function deleteFromKindMap(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): void {
    const nodeIdsByNodeKind: NodeIdMap.NodeIdsByNodeKind = nodeIdMapCollection.nodeIdsByNodeKind;

    const nodeKind: Ast.NodeKind = NodeIdMapUtils.assertGetXor(nodeIdMapCollection, nodeId).node.kind;
    const nodeIds: Set<number> = MapUtils.assertGet(
        nodeIdsByNodeKind,
        nodeKind,
        `failed to deleteFromKindMap as the node kind for the given nodeId isn't present in nodeIdsByNodeKind`,
        {
            nodeId,
            nodeKind,
        },
    );
    SetUtils.assertDelete(nodeIds, nodeId);

    if (!nodeIds.size) {
        nodeIdsByNodeKind.delete(nodeKind);
    }
}

function removeOrReplaceChildId(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
    childId: number,
    maybeReplacementId: number | undefined,
): void {
    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
    const childIds: ReadonlyArray<number> = NodeIdMapIterator.assertIterChildIds(childIdsById, parentId);
    const replacementIndex: number = ArrayUtils.assertIn(
        childIds,
        childId,
        `failed to removeOrReplaceChildId as childId isn't a child of parentId`,
        {
            childId,
            parentId,
        },
    );

    const beforeChildId: ReadonlyArray<number> = childIds.slice(0, replacementIndex);
    const afterChildId: ReadonlyArray<number> = childIds.slice(replacementIndex + 1);

    let maybeNewChildIds: ReadonlyArray<number> | undefined;
    if (maybeReplacementId) {
        const replacementId: number = maybeReplacementId;
        nodeIdMapCollection.parentIdById.set(replacementId, parentId);
        if (childIds.length === 1) {
            maybeNewChildIds = [replacementId];
        } else {
            maybeNewChildIds = [...beforeChildId, replacementId, ...afterChildId];
        }
    } else {
        if (childIds.length === 1) {
            maybeNewChildIds = undefined;
        } else {
            maybeNewChildIds = [...beforeChildId, ...afterChildId];
        }
    }

    if (maybeNewChildIds) {
        const newChildIds: ReadonlyArray<number> = maybeNewChildIds;
        childIdsById.set(parentId, newChildIds);
    } else {
        childIdsById.delete(parentId);
    }

    const maybeParent: ParseContext.Node | undefined = nodeIdMapCollection.contextNodeById.get(parentId);
    if (maybeParent !== undefined && maybeReplacementId === undefined) {
        maybeParent.attributeCounter -= 1;
    }
}
