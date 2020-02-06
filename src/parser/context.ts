// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap } from ".";
import { CommonError, TypeUtils } from "../common";
import { Token } from "../lexer";
import { NodeIdMapUtils, TXorNode } from "./nodeIdMap";

// Parsing use to be one giant evaluation, leading to an all-or-nothing outcome which was unsuitable for a
// document that was being live edited.
//
// Take the scenario where a user is in the process of adding another element to a ListExpression.
// Once a comma is typed the parser would error out as it also expects the yet untyped element.
// Under the one giant evaluation model there was no way to propagate what was parsed up to that point.
//
// Context is used as a workbook for Ast.TNodes that have started evaluation but haven't yet finished.
// It starts out empty, with no children belonging to it.
// Most (all non-leaf) Ast.TNode's require several sub-Ast.TNodes to be evaluated as well.
// For each sub-Ast.TNode that begins evaluation another Context is created and linked as a child of the original.
// This means if a Ast.TNode has N attributes of type Ast.TNode, then the Ast.TNode is fully evaluated there should be N
// child contexts created belonging under the original Context.
// Once the Ast.TNode evaluation is complete the result is saved on the Context under its maybeAstNode attribute.
//
// Back to the scenario listed above, where the user has entered `{1,}`, you could examine the context state to find:
//  An incomplete ListExpression context with 3 children
//  With the first child being an evaluated Ast.TNode of NodeKind.Constant: `{`
//  With the second child being an evaluated Ast.TNode of NodeKind.Csv: `1,`
//  With the third child being a yet-to-be evaluated Context of NodeKind.Csv

export interface State {
    readonly root: Root;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    idCounter: number;
    leafNodeIds: number[];
}

export interface Root {
    maybeNode: Node | undefined;
}

export interface Node {
    readonly id: number;
    readonly kind: Ast.NodeKind;
    readonly tokenIndexStart: number;
    readonly maybeTokenStart: Token | undefined;
    // Incremented for each child context created with the Node as its parent,
    // and decremented for each child context deleted.
    attributeCounter: number;
    maybeAttributeIndex: number | undefined;
    isClosed: boolean;
}

export function newState(): State {
    return {
        root: {
            maybeNode: undefined,
        },
        nodeIdMapCollection: {
            astNodeById: new Map(),
            contextNodeById: new Map(),
            parentIdById: new Map(),
            childIdsById: new Map(),
            maybeRightMostLeaf: undefined,
        },
        idCounter: 0,
        leafNodeIds: [],
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
    maybeTokenStart: Token | undefined,
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
    if (state.root.maybeNode === undefined) {
        state.root.maybeNode = contextNode;
    }

    return contextNode;
}

// Returns the Node's parent context (if one exists).
export function endContext(state: State, contextNode: Node, astNode: Ast.TNode): Node | undefined {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    contextNode.isClosed = true;

    if (astNode.isLeaf) {
        state.leafNodeIds.push(contextNode.id);
    }

    // Ending a context should return the context's parent node (if one exists).
    const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(contextNode.id);
    const maybeParentNode: Node | undefined =
        maybeParentId !== undefined ? nodeIdMapCollection.contextNodeById.get(maybeParentId) : undefined;

    // Move nodeId from contextNodeMap to astNodeMap.
    if (!nodeIdMapCollection.contextNodeById.delete(contextNode.id)) {
        throw new CommonError.InvariantError("can't end a context that doesn't belong to state");
    }
    nodeIdMapCollection.astNodeById.set(astNode.id, astNode);

    // Update maybeRightMostLeaf when applicable
    if (astNode.isLeaf) {
        if (
            nodeIdMapCollection.maybeRightMostLeaf === undefined ||
            nodeIdMapCollection.maybeRightMostLeaf.tokenRange.tokenIndexStart < astNode.tokenRange.tokenIndexStart
        ) {
            const unsafeNodeIdMapCollection: TypeUtils.StripReadonly<NodeIdMap.Collection> = nodeIdMapCollection;
            unsafeNodeIdMapCollection.maybeRightMostLeaf = astNode;
        }
    }

    return maybeParentNode;
}

export function deleteAst(state: State, nodeId: number, parentWillBeDeleted: boolean): void {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    const parentIdById: NodeIdMap.ParentIdById = nodeIdMapCollection.parentIdById;
    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;

    if (!astNodeById.has(nodeId)) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`Ast nodeId not in state.`, details);
    }

    // If Node was a leaf node, remove it from the list of leaf nodes.
    removeLeafOrNoop(state, nodeId);

    const maybeParentId: number | undefined = parentIdById.get(nodeId);
    const maybeChildIds: ReadonlyArray<number> | undefined = childIdsById.get(nodeId);

    // Not a leaf node.
    if (maybeChildIds !== undefined) {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        const details: {} = {
            childIds,
            nodeId,
        };
        throw new CommonError.InvariantError(`Ast maybeChildIds !== undefined`, details);
    }
    // Is a leaf node, not root node.
    // Delete the node from the list of children under the node's parent.
    else if (maybeParentId) {
        const parentId: number = maybeParentId;
        if (astNodeById.has(parentId) && !parentWillBeDeleted) {
            const details: {} = {
                parentId,
                nodeId,
            };
            throw new CommonError.InvariantError(`parent is a Ast node not marked for deletion`, details);
        }

        removeOrReplaceChildId(nodeIdMapCollection, parentId, nodeId, undefined);
    }
    // Else is root node, is leaf node.
    // No children updates need to be taken.

    // Remove the node from existence.
    astNodeById.delete(nodeId);
    childIdsById.delete(nodeId);
    parentIdById.delete(nodeId);
}

export function deleteContext(state: State, nodeId: number): Node | undefined {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const contextNodeById: NodeIdMap.ContextNodeById = nodeIdMapCollection.contextNodeById;
    const parentIdById: NodeIdMap.ParentIdById = nodeIdMapCollection.parentIdById;
    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;

    const maybeContextNode: Node | undefined = contextNodeById.get(nodeId);
    if (maybeContextNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`Context nodeId not in state.`, details);
    }
    const contextNode: Node = maybeContextNode;

    // If Node was a leaf node, remove it from the list of leaf nodes.
    removeLeafOrNoop(state, nodeId);

    const maybeParentId: number | undefined = parentIdById.get(nodeId);
    const maybeChildIds: ReadonlyArray<number> | undefined = childIdsById.get(nodeId);

    // Not a leaf node.
    if (maybeChildIds !== undefined) {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        if (childIds.length !== 1) {
            const details: {} = {
                childIds,
                nodeId,
            };
            throw new CommonError.InvariantError(`Context childIds.length !== 0`, details);
        }
        const childId: number = childIds[0];

        // Not a leaf node, is the Root node.
        // Promote the child to the root if it's a Context node.
        if (maybeParentId === undefined) {
            parentIdById.delete(childId);
            const maybeChildContext: Node | undefined = contextNodeById.get(childId);
            if (maybeChildContext) {
                const childContext: Node = maybeChildContext;
                state.root.maybeNode = childContext;
            }
        }
        // Not a leaf node, not the Root node.
        // Replace the node from the list of children under the node's parent using the node's child
        else {
            const parentId: number = maybeParentId;
            removeOrReplaceChildId(nodeIdMapCollection, parentId, nodeId, childId);
        }

        // The child Node inherits the attributeIndex.
        const childXorNode: TXorNode = NodeIdMapUtils.expectXorNode(state.nodeIdMapCollection, childId);
        const mutableChildXorNode: TypeUtils.StripReadonly<Ast.TNode | Node> = childXorNode.node;
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
    contextNodeById.delete(nodeId);
    childIdsById.delete(nodeId);
    parentIdById.delete(nodeId);

    // Return the node's parent if it exits
    return maybeParentId !== undefined ? NodeIdMapUtils.expectContextNode(contextNodeById, maybeParentId) : undefined;
}

function removeLeafOrNoop(state: State, nodeId: number): void {
    const leafNodeIds: number[] = state.leafNodeIds;
    const maybeLeafIndex: number | undefined = leafNodeIds.indexOf(nodeId);
    if (maybeLeafIndex !== -1) {
        const leafIndex: number = maybeLeafIndex;
        state.leafNodeIds = [...leafNodeIds.slice(0, leafIndex), ...leafNodeIds.slice(leafIndex + 1)];
    }
}

function removeOrReplaceChildId(
    nodeIdMapCollection: NodeIdMap.Collection,
    parentId: number,
    childId: number,
    maybeReplacementId: number | undefined,
): void {
    const childIdsById: NodeIdMap.ChildIdsById = nodeIdMapCollection.childIdsById;
    const childIds: ReadonlyArray<number> = NodeIdMapUtils.expectChildIds(childIdsById, parentId);
    const replacementIndex: number = childIds.indexOf(childId);
    if (replacementIndex === -1) {
        const details: {} = {
            parentId,
            childId,
        };
        throw new CommonError.InvariantError(`childId isn't a child of parentId`, details);
    }

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
}
