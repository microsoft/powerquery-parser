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
    leafNodeIds: number[];
}

export interface Root {
    maybeNode: Option<Node>;
}

export interface Node {
    readonly nodeId: number;
    readonly nodeKind: Ast.NodeKind;
    readonly maybeTokenStart: Option<Token>;
    readonly maybeParentId: Option<number>;
    childNodeIds: number[];
    maybeAstNode: Option<Ast.TNode>;
}

export function empty(): State {
    return {
        root: {
            maybeNode: undefined,
        },
        astNodesById: new Map(),
        contextNodesById: new Map(),
        leafNodeIds: [],
    };
}

export function expectContextNode(nodesById: ContextNodeMap, nodeId: number): Node {
    const maybeNode: Option<Node> = nodesById.get(nodeId);
    if (maybeNode === undefined) {
        throw new CommonError.InvariantError(`nodeId (${nodeId}) wasn't in State.`);
    }
    return maybeNode;
}

export function addChild(
    state: State,
    maybeParent: Option<Node>,
    nodeKind: Ast.NodeKind,
    nodeId: number,
    maybeTokenStart: Option<Token>,
): Node {
    let maybeParentId: Option<number>;
    if (maybeParent) {
        const parent: Node = maybeParent;
        maybeParentId = parent.nodeId;
        parent.childNodeIds.push(nodeId);
    } else {
        maybeParentId = undefined;
    }

    const child: Node = {
        nodeId,
        nodeKind,
        maybeTokenStart,
        maybeParentId,
        childNodeIds: [],
        maybeAstNode: undefined,
    };
    state.contextNodesById.set(child.nodeId, child);

    return child;
}

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

    // Setting mabyeAst marks the ContextNode as complete.
    contextNode.maybeAstNode = astNode;

    // Ending a context should return the context's parent node (if one exists).
    // Grab it before we delete the current context node from the State map.
    const maybeParentId: Option<number> = contextNode.maybeParentId;
    const maybeParentNode: Option<Node> =
        maybeParentId !== undefined ? expectContextNode(state.contextNodesById, maybeParentId) : undefined;

    // Delete nodeId from contextNodeMap and add it to astNodeMap.
    // An assert above ensures nodeIds are shared between the two node types.
    if (!state.contextNodesById.delete(contextNode.nodeId)) {
        throw new CommonError.InvariantError("can't end a context that doesn't belong to state");
    }
    state.astNodesById.set(astNode.id, astNode);

    return maybeParentNode;
}

export function deleteContext(state: State, nodeId: number): Option<Node> {
    const nodesById: ContextNodeMap = state.contextNodesById;
    const terminalNodeIds: number[] = state.leafNodeIds;

    const maybeNode: Option<Node> = nodesById.get(nodeId);
    if (maybeNode === undefined) {
        const details: {} = { nodeId };
        throw new CommonError.InvariantError(`nodeId not in state.`, details);
    }
    const node: Node = maybeNode;
    const maybeParentId: Option<number> = node.maybeParentId;

    const maybeTerminalIndex: Option<number> = terminalNodeIds.indexOf(nodeId);
    if (maybeTerminalIndex !== -1) {
        const terminalIndex: number = maybeTerminalIndex;
        state.leafNodeIds = [...terminalNodeIds.slice(0, terminalIndex), ...terminalNodeIds.slice(terminalIndex + 1)];
    }

    if (maybeParentId === undefined) {
        return undefined;
    }

    const parentId: number = maybeParentId;
    const parent: Node = expectContextNode(state.contextNodesById, parentId);
    const childNodeIds: number[] = parent.childNodeIds;
    const childNodeIndex: number = childNodeIds.indexOf(nodeId);

    if (childNodeIndex === -1) {
        throw new CommonError.InvariantError(
            `nodeId ${nodeId} considers ${parentId} to be a parent, but isn't listed as a child of the parent.`,
        );
    }

    parent.childNodeIds = [...childNodeIds.slice(0, childNodeIndex), ...childNodeIds.slice(childNodeIndex + 1)];

    return parent;
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
        leafNodeIds: state.leafNodeIds.slice(),
    };
}

function deepCopyContextNode(node: Node): Node {
    return {
        ...node,
        maybeAstNode: node.maybeAstNode !== undefined ? { ...node.maybeAstNode } : undefined,
    };
}
