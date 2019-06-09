// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Ast, NodeIdMap } from ".";
import { CommonError, Option } from "../common";
import { Token } from "../lexer";

export interface State {
    readonly root: Root;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    leafNodeIds: number[];
}

export interface Root {
    maybeNode: Option<Node>;
}

export interface Node {
    readonly nodeId: number;
    readonly nodeKind: Ast.NodeKind;
    readonly maybeTokenStart: Option<Token>;
    maybeAstNode: Option<Ast.TNode>;
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
        leafNodeIds: [],
    };
}

export function expectAstNode(astNodeById: NodeIdMap.AstNodeById, nodeId: number): Ast.TNode {
    return expectInMap<Ast.TNode>(astNodeById, nodeId, "astNodeById");
}

export function expectContextNode(contextNodeById: NodeIdMap.ContextNodeById, nodeId: number): Node {
    return expectInMap<Node>(contextNodeById, nodeId, "contextNodeById");
}

export function expectChildIds(
    childIdsById: Map<number, ReadonlyArray<number>>,
    nodeId: number,
): ReadonlyArray<number> {
    return expectInMap<ReadonlyArray<number>>(childIdsById, nodeId, "childIdsById");
}

export function startContext(
    state: State,
    nodeKind: Ast.NodeKind,
    nodeId: number,
    maybeTokenStart: Option<Token>,
    maybeParentNode: Option<Node>,
): Node {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    // If the context is a child of an existing context: update the child/parent maps.
    if (maybeParentNode) {
        const childIdsById: Map<number, ReadonlyArray<number>> = nodeIdMapCollection.childIdsById;
        const parent: Node = maybeParentNode;
        const parentNodeId: number = parent.nodeId;

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
        nodeId,
        nodeKind,
        maybeTokenStart,
        maybeAstNode: undefined,
    };
    nodeIdMapCollection.contextNodeById.set(nodeId, node);

    return node;
}

// Marks a context as closed by assinging an Ast.TNode to maybeAstNode.
// Returns the Node's parent context (if one exists).
export function endContext(state: State, contextNode: Node, astNode: Ast.TNode): Option<Node> {
    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

    if (contextNode.maybeAstNode !== undefined) {
        throw new CommonError.InvariantError("context was already ended");
    } else if (contextNode.nodeId !== astNode.id) {
        const details: {} = {
            contextNodeId: contextNode.nodeId,
            astNodeId: astNode.id,
        };
        throw new CommonError.InvariantError("contextNode and astNode have different nodeIds", details);
    }

    if (astNode.isLeaf) {
        state.leafNodeIds.push(contextNode.nodeId);
    }

    // Setting mabyeAstNode marks the ContextNode as complete.
    contextNode.maybeAstNode = astNode;

    // Ending a context should return the context's parent node (if one exists).
    // Grab it before we delete the current context node from the State map.
    const maybeParentId: Option<number> = nodeIdMapCollection.parentIdById.get(contextNode.nodeId);
    const maybeParentNode: Option<Node> =
        maybeParentId !== undefined ? nodeIdMapCollection.contextNodeById.get(maybeParentId) : undefined;

    // Move nodeId from contextNodeMap to astNodeMap.
    if (!nodeIdMapCollection.contextNodeById.delete(contextNode.nodeId)) {
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
    const maybeParentNodeId: Option<number> = parentIdById.get(node.nodeId);
    const maybeChildIds: Option<ReadonlyArray<number>> = childIdsById.get(node.nodeId);

    // If the Node has a parent, remove the Node from the parent's list of children
    if (maybeParentNodeId !== undefined) {
        const parentNode: Node = expectContextNode(contextNodeById, maybeParentNodeId);
        const parentChildIds: ReadonlyArray<number> = expectChildIds(childIdsById, parentNode.nodeId);
        const replacementIndex: number = parentChildIds.indexOf(node.nodeId);
        if (replacementIndex === -1) {
            const details: {} = {
                parentNodeId: parentNode.nodeId,
                childNodeId: node.nodeId,
            };
            throw new CommonError.InvariantError(`node isn't a child of parentNode`, details);
        }

        childIdsById.set(parentNode.nodeId, [
            ...parentChildIds.slice(0, replacementIndex),
            ...parentChildIds.slice(replacementIndex + 1),
        ]);
    }

    // If the Node has children, update the children's parent to the Node's parent.
    if (maybeParentNodeId !== undefined && maybeChildIds) {
        const parentNode: Node = expectContextNode(contextNodeById, maybeParentNodeId);
        const childIds: ReadonlyArray<number> = maybeChildIds;

        for (const childId of childIds) {
            parentIdById.set(childId, parentNode.nodeId);
        }

        // Add the Node's orphaned children to the Node's parent.
        const parentChildIds: ReadonlyArray<number> = expectChildIds(childIdsById, parentNode.nodeId);
        childIdsById.set(parentNode.nodeId, [...parentChildIds, ...childIds]);
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
            const soloNode: Node = expectContextNode(contextNodeById, soloChildId);
            state.root.maybeNode = soloNode;
        }

        parentIdById.delete(soloChildId);
    }

    // Remove Node from existence.
    contextNodeById.delete(node.nodeId);
    childIdsById.delete(node.nodeId);
    parentIdById.delete(node.nodeId);

    return maybeParentNodeId !== undefined ? expectContextNode(contextNodeById, maybeParentNodeId) : undefined;
}

export function deepCopy(state: State): State {
    const nodeIdMapCollection: NodeIdMap.Collection = NodeIdMap.deepCopyCollection(state.nodeIdMapCollection);
    const maybeRootNode: Option<Node> =
        state.root.maybeNode !== undefined
            ? nodeIdMapCollection.contextNodeById.get(state.root.maybeNode.nodeId)
            : undefined;

    return {
        root: {
            maybeNode: maybeRootNode,
        },
        nodeIdMapCollection: nodeIdMapCollection,
        leafNodeIds: state.leafNodeIds.slice(),
    };
}

function expectInMap<T>(map: Map<number, T>, nodeId: number, mapName: string): T {
    const maybeValue: Option<T> = map.get(nodeId);
    if (maybeValue === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId wasn't in ${mapName}`, details);
    }
    return maybeValue;
}
