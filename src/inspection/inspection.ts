// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option, ResultKind, Traverse } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { inspectAstNode } from "./ast";
import { Inspected, Position, State } from "./common";
import { inspectContextNode } from "./context";

// An inspection is done by selecting a leaf node, then recursively traveling up the node's parents.
// If a leaf node doesn't exist at the given postion, then the closest node to the left is used (if one exists).
//
// There are three forms that the parent path can take:
//  * all nodes are Ast.TNode
//  * all nodes are ParserContext.Node
//  * nodes are initially Ast.TNode, then they become ParserContext.Node

export type TriedInspect = Traverse.TriedTraverse<Inspected>;

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
        inspectXorNode,
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

function inspectXorNode(xorNode: NodeIdMap.TXorNode, state: State): void {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            inspectAstNode(state, xorNode.node);
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            inspectContextNode(state, xorNode.node);
            break;
        }

        default:
            throw isNever(xorNode);
    }
}

function maybeClosestXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<NodeIdMap.TXorNode> {
    let maybeCurrentNode: Option<NodeIdMap.TXorNode>;

    for (const nodeId of leafNodeIds) {
        const newNode: NodeIdMap.TXorNode = NodeIdMap.expectXorNode(nodeIdMapCollection, nodeId);
        maybeCurrentNode = closerXorNodeLeaf(position, maybeCurrentNode, newNode);
    }

    return maybeCurrentNode;
}

// Assumes both TXorNode parameters are leaf nodes.
function closerXorNodeLeaf(
    position: Position,
    maybeCurrentNode: Option<NodeIdMap.TXorNode>,
    newNode: NodeIdMap.TXorNode,
): Option<NodeIdMap.TXorNode> {
    const newNodePositionEnd: TokenPosition = expectTokenPositionEndLeaf(newNode);

    // If currentToken isn't set and newNode's start position is <= position: return newToken
    // Else: return undefined
    if (maybeCurrentNode === undefined) {
        const newNodePositionStart: TokenPosition = expectTokenPositionStartLeaf(newNode);
        if (newNodePositionEnd.lineNumber > position.lineNumber) {
            return undefined;
        } else if (
            newNodePositionEnd.lineNumber === position.lineNumber &&
            newNodePositionStart.lineCodeUnit < position.lineCodeUnit &&
            newNodePositionEnd.lineCodeUnit >= position.lineCodeUnit
        ) {
            return newNode;
        } else {
            return undefined;
        }
    }
    const currentNode: NodeIdMap.TXorNode = maybeCurrentNode;
    const currentNodePositionEnd: TokenPosition = expectTokenPositionEndLeaf(currentNode);

    // Verifies newTokenPositionEnd starts no later than the position argument.
    if (newNodePositionEnd.lineNumber > position.lineNumber) {
        return currentNode;
    } else if (
        newNodePositionEnd.lineNumber === position.lineNumber &&
        newNodePositionEnd.lineCodeUnit > position.lineCodeUnit
    ) {
        return currentNode;
    }

    // Both currentTokenPositionStart and newTokenPositionEnd are <= position,
    // so a quick comparison can be done by examining TokenPosition.codeUnit
    return currentNodePositionEnd.codeUnit < newNodePositionEnd.codeUnit ? newNode : currentNode;
}

function expectTokenPositionStartLeaf(xorNode: NodeIdMap.TXorNode): TokenPosition {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return xorNode.node.tokenRange.positionStart;

        case NodeIdMap.XorNodeKind.Context: {
            const details: {} = { xorNode };
            throw new CommonError.InvariantError(`expect all leaf tokens to be of kind XorNodeKind.Ast`, details);
        }

        default:
            throw isNever(xorNode);
    }
}

function expectTokenPositionEndLeaf(xorNode: NodeIdMap.TXorNode): TokenPosition {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return xorNode.node.tokenRange.positionEnd;

        case NodeIdMap.XorNodeKind.Context: {
            const details: {} = { xorNode };
            throw new CommonError.InvariantError(`expect all leaf tokens to be of kind XorNodeKind.Ast`, details);
        }

        default:
            throw isNever(xorNode);
    }
}
