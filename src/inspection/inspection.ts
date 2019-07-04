// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option, ResultKind, Traverse } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { INode, TNode } from "./node";
import { visitNode } from "./visitNode";

// An inspection is done by selecting a leaf node, then recursively traveling up the node's parents.
// If a leaf node doesn't exist at the given postion, then the closest node to the left is used (if one exists).
//
// There are three forms that the parent path can take:
//  * all nodes are Ast.TNode
//  * all nodes are ParserContext.Node
//  * nodes are initially Ast.TNode, then they become ParserContext.Node

export type TriedInspect = Traverse.TriedTraverse<Inspected>;

export interface State extends Traverse.IState<Inspected> {
    maybePreviousXorNode: Option<NodeIdMap.TXorNode>;
    isEachEncountered: boolean;
    readonly position: Position;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export interface Inspected {
    readonly nodes: TNode[];
    readonly scope: Map<string, NodeIdMap.TXorNode>;
}

export interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Traverse.TriedTraverse<Inspected> {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = maybeClosestXorNode(position, nodeIdMapCollection, leafNodeIds);
    if (maybeXorNode === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultInspection,
        };
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    const state: State = {
        result: {
            nodes: [],
            scope: new Map(),
        },
        isEachEncountered: false,
        maybePreviousXorNode: undefined,
        position,
        nodeIdMapCollection,
        leafNodeIds,
    };
    return Traverse.tryTraverseXor<State, Inspected>(
        xorNode,
        nodeIdMapCollection,
        state,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        addParentXorNode,
        undefined,
    );
}

const DefaultInspection: Inspected = {
    nodes: [],
    scope: new Map(),
};

function addParentXorNode(
    _state: State & Traverse.IState<Inspected>,
    xorNode: NodeIdMap.TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<NodeIdMap.TXorNode> {
    let maybeParentNodeId: Option<number>;
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const astNode: Ast.TNode = xorNode.node;
            maybeParentNodeId = nodeIdMapCollection.parentIdById.get(astNode.id);
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            const contextNode: ParserContext.Node = xorNode.node;
            maybeParentNodeId = nodeIdMapCollection.parentIdById.get(contextNode.id);
            break;
        }

        default:
            throw isNever(xorNode);
    }

    if (maybeParentNodeId === undefined) {
        return [];
    }
    const parentNodeId: number = maybeParentNodeId;

    const maybeParentXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorNode(nodeIdMapCollection, parentNodeId);
    if (maybeParentXorNode === undefined) {
        return [];
    }
    const parentXorNode: NodeIdMap.TXorNode = maybeParentXorNode;

    switch (parentXorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const parentAstNode: Ast.TNode = parentXorNode.node;
            return [
                {
                    kind: NodeIdMap.XorNodeKind.Ast,
                    node: parentAstNode,
                },
            ];
        }
        case NodeIdMap.XorNodeKind.Context: {
            const parentContextNode: ParserContext.Node = parentXorNode.node;
            return [
                {
                    kind: NodeIdMap.XorNodeKind.Context,
                    node: parentContextNode,
                },
            ];
        }

        default:
            throw isNever(parentXorNode);
    }
}

function maybeClosestXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<NodeIdMap.TXorNode> {
    let maybeClosestNode: Option<NodeIdMap.TXorNode>;

    for (const nodeId of leafNodeIds) {
        const newNode: NodeIdMap.TXorNode = NodeIdMap.expectXorNode(nodeIdMapCollection, nodeId);
        maybeClosestNode = closerXorNode(position, maybeClosestNode, newNode);
    }

    return maybeClosestNode;
}

// Assumes both TXorNode parameters are leaf nodes.
function closerXorNode(
    position: Position,
    maybeCurrentNode: Option<NodeIdMap.TXorNode>,
    newNode: NodeIdMap.TXorNode,
): Option<NodeIdMap.TXorNode> {
    const newNodePositionStart: TokenPosition = expectTokenStart(newNode);

    // If currentToken isn't set and newNode's start position is <= position: return newToken
    // Else: return undefined
    if (maybeCurrentNode === undefined) {
        if (newNodePositionStart.lineNumber > position.lineNumber) {
            return undefined;
        } else if (
            newNodePositionStart.lineNumber === position.lineNumber &&
            newNodePositionStart.lineCodeUnit >= position.lineCodeUnit
        ) {
            return undefined;
        } else {
            return newNode;
        }
    }
    const currentNode: NodeIdMap.TXorNode = maybeCurrentNode;
    const currentNodePositionStart: TokenPosition = expectTokenStart(currentNode);

    // Verifies newTokenPositionStart starts no later than the position argument.
    if (newNodePositionStart.lineNumber > position.lineNumber) {
        return currentNode;
    } else if (
        newNodePositionStart.lineNumber === position.lineNumber &&
        newNodePositionStart.lineCodeUnit > position.lineCodeUnit
    ) {
        return currentNode;
    }

    // Both currentTokenPositionStart and newTokenPositionStart are <= position,
    // so a quick comparison can be done by examining TokenPosition.codeUnit
    return currentNodePositionStart.codeUnit < newNodePositionStart.codeUnit ? newNode : currentNode;
}

function expectTokenStart(xorNode: NodeIdMap.TXorNode): TokenPosition {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return xorNode.node.tokenRange.positionStart;

        case NodeIdMap.XorNodeKind.Context: {
            const contextNode: ParserContext.Node = xorNode.node;
            if (!contextNode.maybeTokenStart) {
                const details: {} = { nodeId: contextNode.id };
                throw new CommonError.InvariantError(`contextNode.maybeTokenStart should be truthy`, details);
            }
            return contextNode.maybeTokenStart.positionStart;
        }

        default:
            throw isNever(xorNode);
    }
}
