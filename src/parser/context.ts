// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, Option } from "../common";
import { Token } from "../lexer";
import * as Ast from "./ast";

export type AstNodeMap = Map<number, Ast.TNode>;
export type ContextNodeMap = Map<number, Node>;

export interface State {
    readonly root: Root;
    readonly astNodesById: AstNodeMap;
    readonly contextNodesById: ContextNodeMap;
    readonly parentIdById: Map<number, number>;
    readonly childIdsById: Map<number, ReadonlyArray<number>>;
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
        astNodesById: new Map(),
        contextNodesById: new Map(),
        parentIdById: new Map(),
        childIdsById: new Map(),
        leafNodeIds: [],
    };
}

export function expectContextNode(nodesById: ContextNodeMap, nodeId: number): Node {
    return expectInMap<Node>(nodesById, nodeId, "nodesById");
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
    // If the context is a child of an existing context: update the child/parent maps.
    if (maybeParentNode) {
        const parent: Node = maybeParentNode;
        const parentNodeId: number = parent.nodeId;

        state.parentIdById.set(nodeId, parentNodeId);

        const maybeExistingChildren: Option<ReadonlyArray<number>> = state.childIdsById.get(parentNodeId);
        if (maybeExistingChildren) {
            const existingChildren: ReadonlyArray<number> = maybeExistingChildren;
            state.childIdsById.set(parentNodeId, [nodeId, ...existingChildren]);
        } else {
            state.childIdsById.set(parentNodeId, [nodeId]);
        }
    }

    const node: Node = {
        nodeId,
        nodeKind,
        maybeTokenStart,
        maybeAstNode: undefined,
    };
    state.contextNodesById.set(nodeId, node);

    return node;
}

// Marks a context as closed by assinging an Ast.TNode to maybeAstNode.
// Returns the Node's parent context (if one exists).
export function endContext(state: State, contextNode: Node, astNode: Ast.TNode): Option<Node> {
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
    const maybeParentId: Option<number> = state.parentIdById.get(contextNode.nodeId);
    const maybeParentNode: Option<Node> =
        maybeParentId !== undefined ? state.contextNodesById.get(maybeParentId) : undefined;

    // Move nodeId from contextNodeMap to astNodeMap.
    if (!state.contextNodesById.delete(contextNode.nodeId)) {
        throw new CommonError.InvariantError("can't end a context that doesn't belong to state");
    }
    state.astNodesById.set(astNode.id, astNode);

    return maybeParentNode;
}

export function deleteContext(state: State, nodeId: number): Option<Node> {
    // 'pop' the node out of the context map.
    const maybeNode: Option<Node> = state.contextNodesById.get(nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId not in state.`, details);
    }
    state.contextNodesById.delete(nodeId);
    const node: Node = maybeNode;

    // If Node was a leaf node, remove it from the list of leaf nodes.
    const leafNodeIds: number[] = state.leafNodeIds;
    const maybeLeafIndex: Option<number> = leafNodeIds.indexOf(nodeId);
    if (maybeLeafIndex !== -1) {
        const leafIndex: number = maybeLeafIndex;
        state.leafNodeIds = [...leafNodeIds.slice(0, leafIndex), ...leafNodeIds.slice(leafIndex + 1)];
    }

    // Link the Node's parents to the node's children.
    const maybeParentNodeId: Option<number> = state.parentIdById.get(node.nodeId);
    const maybeChildIds: Option<ReadonlyArray<number>> = state.childIdsById.get(node.nodeId);

    // If the Node has a parent, remove the Node from the parent's list of children
    if (maybeParentNodeId) {
        const parentNode: Node = expectContextNode(state.contextNodesById, maybeParentNodeId);
        const parentChildIds: ReadonlyArray<number> = expectChildIds(state.childIdsById, parentNode.nodeId);
        const replacementIndex: number = parentChildIds.indexOf(node.nodeId);
        if (replacementIndex === -1) {
            const details: {} = {
                parentNodeId: parentNode.nodeId,
                childNodeId: node.nodeId,
            };
            throw new CommonError.InvariantError(`node isn't a child of parentNode`, details);
        }

        state.childIdsById.set(parentNode.nodeId, [
            ...parentChildIds.slice(0, replacementIndex),
            ...parentChildIds.slice(replacementIndex + 1),
        ]);
    }

    // If the Node has children, update the children's parent to the Node's parent.
    if (maybeParentNodeId && maybeChildIds) {
        const parentNode: Node = expectContextNode(state.contextNodesById, maybeParentNodeId);
        const childIds: ReadonlyArray<number> = maybeChildIds;

        for (const childId of childIds) {
            state.parentIdById.set(childId, parentNode.nodeId);
        }

        // Add the Node's orphaned children to the Node's parent.
        const parentChildIds: ReadonlyArray<number> = expectChildIds(state.childIdsById, parentNode.nodeId);
        state.childIdsById.set(parentNode.nodeId, [...parentChildIds, ...childIds]);
    }

    return maybeParentNodeId !== undefined ? expectContextNode(state.contextNodesById, maybeParentNodeId) : undefined;
}

export function deepCopy(state: State): State {
    const contextNodeById: ContextNodeMap = new Map<number, Node>();
    state.contextNodesById.forEach((value: Node, key: number) => {
        contextNodeById.set(key, deepCopyContextNode(value));
    });

    return {
        root: {
            maybeNode: contextNodeById.get(0),
        },
        astNodesById: new Map(state.astNodesById.entries()),
        contextNodesById: contextNodeById,
        childIdsById: new Map(state.childIdsById.entries()),
        parentIdById: new Map(state.parentIdById.entries()),
        leafNodeIds: state.leafNodeIds.slice(),
    };
}

function deepCopyContextNode(node: Node): Node {
    return {
        ...node,
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
