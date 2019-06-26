// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap } from ".";
import { CommonError, Option } from "../common";
import { Token } from "../lexer";

// Parsing use to be one giant evaluation, leading to an all-or-nothing outcome which was unsuitable for a
// document that was being live edited.
//
// Take the scenario where a user is in the process of adding another element to a ListExpression.
// Once a comma is typed the parser would error out as it also expects the yet untyped element.
// Under the one giant evaluation model there was no way to propegate what was parsed up to that point.
//
// Context is used as a workbook for Ast.TNodes that have started evaluation but haven't yet finished.
// It starts out empty, with no children belonging to it.
// Most (all non-leaf) Ast.TNode's require several sub-Ast.TNodes to be evalauted as well.
// For each sub-Ast.TNode that begins evaluation another Context is created and linked as a child of the original.
// This means if a Ast.TNode has N attributes of type Ast.TNode, then the Ast.TNode is fully evaluated there should be N
// child contexts created belonging under the orignal Context.
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
    maybeNode: Option<Node>;
}

export interface Node {
    readonly id: number;
    readonly kind: Ast.NodeKind;
    readonly tokenIndexStart: number;
    readonly maybeTokenStart: Option<Token>;
    attributeCounter: number;
    maybeClosedAttributes: Option<ClosedAttributes>;
}

export interface ClosedAttributes {
    readonly astNode: Ast.TNode;
    readonly maybeAttributeIndex: Option<number>;
}

export function empty(): State {
    return {
        root: {
            maybeNode: undefined,
        },
        nodeIdMapCollection: {
            astNodeById: new Map(),
            contextNodeById: new Map(),
            parentIdById: new Map(),
            childIdsById: new Map(),
        },
        idCounter: 0,
        leafNodeIds: [],
    };
}

export function startContext(
    state: State,
    nodeKind: Ast.NodeKind,
    tokenIndexStart: number,
    maybeTokenStart: Option<Token>,
    maybeParentNode: Option<Node>,
): Node {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const nodeId: number = state.idCounter + 1;
    state.idCounter += 1;

    // If the context is a child of an existing context: update the child/parent maps.
    if (maybeParentNode) {
        const childIdsById: Map<number, ReadonlyArray<number>> = nodeIdMapCollection.childIdsById;
        const parent: Node = maybeParentNode;
        const parentNodeId: number = parent.id;

        nodeIdMapCollection.parentIdById.set(nodeId, parentNodeId);

        const maybeExistingChildren: Option<ReadonlyArray<number>> = childIdsById.get(parentNodeId);
        if (maybeExistingChildren) {
            const existingChildren: ReadonlyArray<number> = maybeExistingChildren;
            childIdsById.set(parentNodeId, [...existingChildren, nodeId]);
        } else {
            childIdsById.set(parentNodeId, [nodeId]);
        }
    }

    const node: Node = {
        id: nodeId,
        kind: nodeKind,
        tokenIndexStart,
        maybeTokenStart,
        attributeCounter: 0,
        maybeClosedAttributes: undefined,
    };
    nodeIdMapCollection.contextNodeById.set(nodeId, node);

    return node;
}

// Marks a context as closed by assinging an Ast.TNode to maybeAstNode.
// Returns the Node's parent context (if one exists).
export function endContext(state: State, contextNode: Node, astNode: Ast.TNode): Option<Node> {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    if (contextNode.maybeClosedAttributes !== undefined) {
        throw new CommonError.InvariantError("context was already ended");
    } else if (contextNode.id !== astNode.id) {
        const details: {} = {
            contextNodeId: contextNode.id,
            astNodeId: astNode.id,
        };
        throw new CommonError.InvariantError("contextNode and astNode have different nodeIds", details);
    }

    if (astNode.isLeaf) {
        state.leafNodeIds.push(contextNode.id);
    }

    // Ending a context should return the context's parent node (if one exists).
    const maybeParentId: Option<number> = nodeIdMapCollection.parentIdById.get(contextNode.id);
    const maybeParentNode: Option<Node> =
        maybeParentId !== undefined ? nodeIdMapCollection.contextNodeById.get(maybeParentId) : undefined;

    // Setting maybeClosedAttributes marks the ContextNode as complete.
    let maybeAttributeIndex: Option<number>;
    if (maybeParentNode) {
        const parentNode: Node = maybeParentNode;
        maybeAttributeIndex = parentNode.attributeCounter;
        parentNode.attributeCounter += 1;
    }
    contextNode.maybeClosedAttributes = {
        astNode,
        maybeAttributeIndex,
    };

    // Move nodeId from contextNodeMap to astNodeMap.
    if (!nodeIdMapCollection.contextNodeById.delete(contextNode.id)) {
        throw new CommonError.InvariantError("can't end a context that doesn't belong to state");
    }
    nodeIdMapCollection.astNodeById.set(astNode.id, astNode);

    return maybeParentNode;
}

export function deleteContext(state: State, nodeId: number): Option<Node> {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const contextNodeById: Map<number, Node> = nodeIdMapCollection.contextNodeById;
    const parentIdById: Map<number, number> = nodeIdMapCollection.parentIdById;
    const childIdsById: Map<number, ReadonlyArray<number>> = nodeIdMapCollection.childIdsById;

    const maybeNode: Option<Node> = contextNodeById.get(nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId not in state.`, details);
    }
    const node: Node = maybeNode;

    // If Node was a leaf node, remove it from the list of leaf nodes.
    const leafNodeIds: number[] = state.leafNodeIds;
    const maybeLeafIndex: Option<number> = leafNodeIds.indexOf(nodeId);
    if (maybeLeafIndex !== -1) {
        const leafIndex: number = maybeLeafIndex;
        state.leafNodeIds = [...leafNodeIds.slice(0, leafIndex), ...leafNodeIds.slice(leafIndex + 1)];
    }

    // Link the Node's parents to the node's children.
    const maybeParentNodeId: Option<number> = parentIdById.get(node.id);
    const maybeChildIds: Option<ReadonlyArray<number>> = childIdsById.get(node.id);

    // If the Node has a parent, remove the Node from the parent's list of children
    if (maybeParentNodeId !== undefined) {
        const parentNode: Node = NodeIdMap.expectContextNode(contextNodeById, maybeParentNodeId);
        const parentChildIds: ReadonlyArray<number> = NodeIdMap.expectChildIds(childIdsById, parentNode.id);
        const replacementIndex: number = parentChildIds.indexOf(node.id);
        if (replacementIndex === -1) {
            const details: {} = {
                parentNodeId: parentNode.id,
                childNodeId: node.id,
            };
            throw new CommonError.InvariantError(`node isn't a child of parentNode`, details);
        }

        childIdsById.set(parentNode.id, [
            ...parentChildIds.slice(0, replacementIndex),
            ...parentChildIds.slice(replacementIndex + 1),
        ]);
    }

    // If the Node has children, update the children's parent to the Node's parent.
    if (maybeParentNodeId !== undefined && maybeChildIds) {
        const parentNode: Node = NodeIdMap.expectContextNode(contextNodeById, maybeParentNodeId);
        const childIds: ReadonlyArray<number> = maybeChildIds;

        for (const childId of childIds) {
            parentIdById.set(childId, parentNode.id);
        }

        // Add the Node's orphaned children to the Node's parent.
        const parentChildIds: ReadonlyArray<number> = NodeIdMap.expectChildIds(childIdsById, parentNode.id);
        childIdsById.set(parentNode.id, [...parentChildIds, ...childIds]);
    }
    // The root is being deleted. Check if it has a single child context, then promote it if it exists.
    else if (maybeChildIds) {
        const childIds: ReadonlyArray<number> = maybeChildIds;
        if (childIds.length !== 1) {
            const details: {} = { childIds };
            throw new CommonError.InvariantError(`root node was deleted and it had multiple children`, details);
        }
        const soloChildId: number = childIds[0];

        // The solo child might be an astNode.
        const maybeSoloNode: Option<Node> = contextNodeById.get(soloChildId);
        if (maybeSoloNode) {
            const soloNode: Node = NodeIdMap.expectContextNode(contextNodeById, soloChildId);
            state.root.maybeNode = soloNode;
        }

        parentIdById.delete(soloChildId);
    }

    // Remove Node from existence.
    contextNodeById.delete(node.id);
    childIdsById.delete(node.id);
    parentIdById.delete(node.id);

    return maybeParentNodeId !== undefined
        ? NodeIdMap.expectContextNode(contextNodeById, maybeParentNodeId)
        : undefined;
}

export function deepCopy(state: State): State {
    const nodeIdMapCollection: NodeIdMap.Collection = NodeIdMap.deepCopyCollection(state.nodeIdMapCollection);
    const maybeRootNode: Option<Node> =
        state.root.maybeNode !== undefined
            ? nodeIdMapCollection.contextNodeById.get(state.root.maybeNode.id)
            : undefined;

    return {
        root: {
            maybeNode: maybeRootNode,
        },
        nodeIdMapCollection: nodeIdMapCollection,
        idCounter: state.idCounter,
        leafNodeIds: state.leafNodeIds.slice(),
    };
}
