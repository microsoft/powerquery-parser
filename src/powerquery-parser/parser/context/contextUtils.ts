// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ArrayUtils, Assert, CommonError, MapUtils, SetUtils, TypeScriptUtils } from "../../common";
import { Ast, Token } from "../../language";
import { NodeIdMap, ParseContext } from "..";
import { NodeIdMapUtils, TXorNode, XorNodeKind } from "../nodeIdMap";

export function assertAsNodeKind<T extends Ast.TNode>(
    node: ParseContext.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): ParseContext.Node<T> {
    assertIsNodeKind(node, expectedNodeKinds);

    return node;
}

export function assertIsNodeKind<T extends Ast.TNode>(
    node: ParseContext.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): asserts node is ParseContext.Node<T> {
    if (!isNodeKind(node, expectedNodeKinds)) {
        throw new CommonError.InvariantError(`expected parse context node has a different than expected node kind`, {
            nodeId: node.id,
            nodeKind: node.kind,
            expectedNodeKinds,
        });
    }
}

export function newState(): ParseContext.State {
    return {
        nodeIdMapCollection: {
            astNodeById: new Map(),
            childIdsById: new Map(),
            contextNodeById: new Map(),
            leafIds: new Set(),
            rightMostLeaf: undefined,
            idsByNodeKind: new Map(),
            parentIdById: new Map(),
        },
        root: undefined,
        idCounter: 0,
        leafIds: new Set(),
    };
}

export function copyState(state: ParseContext.State): ParseContext.State {
    const root: ParseContext.TNode | undefined = state.root !== undefined ? { ...state.root } : undefined;

    return {
        ...state,
        root,
        nodeIdMapCollection: NodeIdMapUtils.copy(state.nodeIdMapCollection),
    };
}

export function isNodeKind<T extends Ast.TNode>(
    node: ParseContext.TNode,
    expectedNodeKinds: ReadonlyArray<T["kind"]> | T["kind"],
): node is ParseContext.Node<T> {
    return node.kind === expectedNodeKinds || expectedNodeKinds.includes(node.kind);
}

export function nextId(state: ParseContext.State): number {
    state.idCounter += 1;

    return state.idCounter;
}

export function nextAttributeIndex(parentNode: ParseContext.TNode): number {
    const result: number = parentNode.attributeCounter;
    parentNode.attributeCounter += 1;

    return result;
}

export function startContext<T extends Ast.TNode>(
    state: ParseContext.State,
    nodeKind: T["kind"],
    tokenIndexStart: number,
    tokenStart: Token.Token | undefined,
    parentNode: ParseContext.TNode | undefined,
): ParseContext.Node<T> {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    let attributeIndex: number | undefined;

    const nodeId: number = nextId(state);

    // If a parent context Node exists, update the parent/child mapping attributes and attributeCounter.
    if (parentNode) {
        const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
        const parentId: number = parentNode.id;

        attributeIndex = nextAttributeIndex(parentNode);
        nodeIdMapCollection.parentIdById.set(nodeId, parentId);

        const existingChildren: ReadonlyArray<number> | undefined = childIdsById.get(parentId);

        if (existingChildren) {
            childIdsById.set(parentId, [...existingChildren, nodeId]);
        } else {
            childIdsById.set(parentId, [nodeId]);
        }
    }

    const contextNode: ParseContext.Node<T> = {
        id: nodeId,
        kind: nodeKind,
        tokenIndexStart,
        tokenStart,
        attributeCounter: 0,
        isClosed: false,
        attributeIndex,
    };

    nodeIdMapCollection.contextNodeById.set(nodeId, contextNode);

    if (state.root === undefined) {
        state.root = contextNode;
    }

    trackNodeIdByNodeKind(nodeIdMapCollection.idsByNodeKind, nodeKind, nodeId);

    return contextNode;
}

// Note:
// This doesn't hold the Id invariant where a parent's Id is always less than its children's Ids.
// To maintain that invariant the caller needs to also call:
//  - NodeIdMapUtils.recalculateIds
//  - NodeIdMapUtils.updateNodeIds
export function startContextAsParent<T extends Ast.TNode>(
    state: ParseContext.State,
    nodeKind: T["kind"],
    existingNodeId: number,
    existingNodeTokenStart: Token.Token | undefined,
): ParseContext.Node<T> {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const existingNode: TXorNode = NodeIdMapUtils.assertXor(nodeIdMapCollection, existingNodeId);

    let tokenIndexStart: number;
    let attributeIndex: number | undefined;

    // Update `attributeIndex` as we're inserting a new context as the parent of the existing node.
    switch (existingNode.kind) {
        case XorNodeKind.Ast: {
            tokenIndexStart = existingNode.node.tokenRange.tokenIndexStart;
            attributeIndex = existingNode.node.attributeIndex;

            const mutableAst: TypeScriptUtils.StripReadonly<Ast.TNode> = existingNode.node;
            mutableAst.attributeIndex = 0;

            break;
        }

        case XorNodeKind.Context:
            tokenIndexStart = existingNode.node.tokenIndexStart;
            attributeIndex = existingNode.node.attributeIndex;

            existingNode.node.attributeIndex = 0;
            break;

        default:
            throw Assert.isNever(existingNode);
    }

    const newNodeId: number = nextId(state);

    const insertedContext: ParseContext.Node<T> = {
        id: newNodeId,
        kind: nodeKind,
        tokenIndexStart,
        tokenStart: existingNodeTokenStart,
        // We want to create a new context containing an existing node,
        // so attributeCounter must be 1 as it holds the existing node.
        attributeCounter: 1,
        isClosed: false,
        attributeIndex,
    };

    nodeIdMapCollection.contextNodeById.set(newNodeId, insertedContext);
    trackNodeIdByNodeKind(nodeIdMapCollection.idsByNodeKind, nodeKind, newNodeId);

    // We have one of two possible states, either:
    //  1) grandparent <-> new <-> existing
    //  2) new <-> existing.

    // Scenario (1)
    const grandparentNodeId: number | undefined = nodeIdMapCollection.parentIdById.get(existingNodeId);

    if (grandparentNodeId) {
        // Update `grandparent <-> existing` with `grandparent <-> new`
        removeOrReplaceChildId(nodeIdMapCollection, grandparentNodeId, existingNodeId, newNodeId);
    }

    // Applicable to Scenario (1) and (2)
    // Create `new <-> existing`
    nodeIdMapCollection.parentIdById.set(existingNodeId, newNodeId);
    nodeIdMapCollection.childIdsById.set(newNodeId, [existingNodeId]);

    return insertedContext;
}

// Returns the Node's parent context (if one exists).
export function endContext<T extends Ast.TNode>(
    state: ParseContext.State,
    contextNode: ParseContext.Node<T>,
    astNode: T,
): ParseContext.TNode | undefined {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    if (state.root?.id === astNode.id) {
        Assert.isTrue(
            state.nodeIdMapCollection.contextNodeById.size === 1,
            "failed to endContext on the root node as at least one other context node exists",
            { nodeId: contextNode.id },
        );
    }

    contextNode.isClosed = true;

    if (astNode.isLeaf) {
        SetUtils.assertAddUnique(
            state.nodeIdMapCollection.leafIds,
            contextNode.id,
            `failed to endContext on a leaf node as it shares a nodeId with an already existing leaf node`,
            { nodeId: contextNode.id },
        );
    }

    // Ending a context should return the context's parent node (if one exists).
    const parentId: number | undefined = nodeIdMapCollection.parentIdById.get(contextNode.id);

    const parentNode: ParseContext.TNode | undefined =
        parentId !== undefined ? nodeIdMapCollection.contextNodeById.get(parentId) : undefined;

    // Move nodeId from contextNodeMap to astNodeMap.
    MapUtils.assertDelete(
        nodeIdMapCollection.contextNodeById,
        contextNode.id,
        "failed to endContext as the given nodeId isn't a valid context nodeId",
        { nodeId: contextNode.id },
    );

    nodeIdMapCollection.astNodeById.set(astNode.id, astNode);

    // Update rightMostLeaf when applicable
    if (astNode.isLeaf) {
        if (
            nodeIdMapCollection.rightMostLeaf === undefined ||
            nodeIdMapCollection.rightMostLeaf.tokenRange.tokenIndexStart < astNode.tokenRange.tokenIndexStart
        ) {
            const unsafeNodeIdMapCollection: TypeScriptUtils.StripReadonly<NodeIdMap.Collection> = nodeIdMapCollection;
            unsafeNodeIdMapCollection.rightMostLeaf = astNode;
        }
    }

    return parentNode;
}

export function deleteAst(state: ParseContext.State, nodeId: number, parentWillBeDeleted: boolean): void {
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
            nodeIdMapCollection.leafIds,
            nodeId,
            "failed to deleteAst as the node is a leaf node, but it wasn't present in leafIds",
            { nodeId },
        );
    }

    const parentId: number | undefined = parentIdById.get(nodeId);
    const childIds: ReadonlyArray<number> | undefined = childIdsById.get(nodeId);

    // Not a leaf node.
    Assert.isUndefined(
        childIds,
        `failed to deleteAst as the given nodeId has one ore more children which must be deleted first`,
        {
            nodeId,
            childIds,
        },
    );

    // Is a leaf node, not root node.
    // Delete the node from the list of children under the node's parent.
    if (parentId) {
        Assert.isFalse(
            astNodeById.has(parentId) && !parentWillBeDeleted,
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

export function deleteContext(state: ParseContext.State, nodeId: number): ParseContext.TNode | undefined {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
    const contextNodeById: NodeIdMap.ContextNodeById = nodeIdMapCollection.contextNodeById;
    const leafIds: Set<number> = nodeIdMapCollection.leafIds;
    const parentIdById: NodeIdMap.ParentIdById = nodeIdMapCollection.parentIdById;

    const contextNode: ParseContext.TNode | undefined = MapUtils.assertGet(
        contextNodeById,
        nodeId,
        `failed to deleteContext as the given nodeId isn't a valid context node`,
        { nodeId },
    );

    const parentId: number | undefined = parentIdById.get(nodeId);
    const childIds: ReadonlyArray<number> | undefined = childIdsById.get(nodeId);

    // Not a leaf node.
    if (childIds !== undefined) {
        ArrayUtils.assertNonZeroLength(childIds);
        const childId: number = childIds[0];

        // Not a leaf node, is the Root node.
        // Promote the child to the root if it's a Context node.
        if (parentId === undefined) {
            parentIdById.delete(childId);
            const childContext: ParseContext.TNode | undefined = contextNodeById.get(childId);

            if (childContext) {
                state.root = childContext;
            }
        }
        // Not a leaf node, not the Root node.
        // Replace the node from the list of children under the node's parent using the node's child
        else {
            removeOrReplaceChildId(nodeIdMapCollection, parentId, nodeId, childId);
        }

        // The child Node inherits the attributeIndex.
        const childXorNode: TXorNode = NodeIdMapUtils.assertXor(state.nodeIdMapCollection, childId);
        const mutableChildXorNode: TypeScriptUtils.StripReadonly<Ast.TNode | ParseContext.TNode> = childXorNode.node;
        mutableChildXorNode.attributeIndex = contextNode.attributeIndex;
    }
    // Is a leaf node, not root node.
    // Delete the node from the list of children under the node's parent.
    else if (parentId) {
        removeOrReplaceChildId(nodeIdMapCollection, parentId, nodeId, undefined);
    }
    // Else is root node, is leaf node.
    // No children updates need to be taken.

    // Remove the node from existence.
    deleteFromKindMap(nodeIdMapCollection, nodeId);
    contextNodeById.delete(nodeId);
    childIdsById.delete(nodeId);
    parentIdById.delete(nodeId);
    leafIds.delete(nodeId);

    // Return the node's parent if it exits
    return parentId !== undefined ? NodeIdMapUtils.assertContext(nodeIdMapCollection, parentId) : undefined;
}

function trackNodeIdByNodeKind(idsByNodeKind: NodeIdMap.IdsByNodeKind, nodeKind: Ast.NodeKind, nodeId: number): void {
    const idsForSpecificNodeKind: Set<number> | undefined = idsByNodeKind.get(nodeKind);

    if (idsForSpecificNodeKind) {
        idsForSpecificNodeKind.add(nodeId);
    } else {
        idsByNodeKind.set(nodeKind, new Set([nodeId]));
    }
}

function deleteFromKindMap(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): void {
    const idsByNodeKind: NodeIdMap.IdsByNodeKind = nodeIdMapCollection.idsByNodeKind;

    const nodeKind: Ast.NodeKind = NodeIdMapUtils.assertXor(nodeIdMapCollection, nodeId).node.kind;

    const nodeIds: Set<number> = MapUtils.assertGet(
        idsByNodeKind,
        nodeKind,
        `failed to deleteFromKindMap as the node kind for the given nodeId isn't present in idsByNodeKind`,
        {
            nodeId,
            nodeKind,
        },
    );

    SetUtils.assertDelete(nodeIds, nodeId);

    if (!nodeIds.size) {
        idsByNodeKind.delete(nodeKind);
    }
}

// Asserts `childId` is in the list of children in for `parentId`.
// Either removes `childId` in its list of children if no `replcementId` is given,
// else replaces the `childId` with `replacementId`.
function removeOrReplaceChildId(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
    childId: number,
    replacementId: number | undefined,
): void {
    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
    const childIds: ReadonlyArray<number> = NodeIdMapUtils.assertChildIds(childIdsById, parentId);

    let newChildIds: ReadonlyArray<number>;

    if (replacementId) {
        nodeIdMapCollection.parentIdById.set(replacementId, parentId);
        newChildIds = ArrayUtils.assertReplaceFirstInstance(childIds, childId, replacementId);
    } else {
        newChildIds = ArrayUtils.assertRemoveFirstInstance(childIds, childId);
    }

    if (newChildIds.length) {
        childIdsById.set(parentId, newChildIds);
    } else {
        childIdsById.delete(parentId);
    }

    const parent: ParseContext.TNode | undefined = nodeIdMapCollection.contextNodeById.get(parentId);

    if (parent !== undefined && replacementId === undefined) {
        parent.attributeCounter -= 1;
    }
}
