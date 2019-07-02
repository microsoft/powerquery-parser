// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option, ResultKind, Traverse } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import { Inspected, Position, State } from "./common";
import { inspectAstNode } from "./inspectAstNodes";
import { inspectContextNode } from "./inspectParserContextNodes";

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
    const maybeClosestLeaf: Option<Ast.TNode> = maybeClosestXorNode(position, nodeIdMapCollection, leafNodeIds);
    if (maybeClosestLeaf === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultInspection,
        };
    }
    const closestLeaf: Ast.TNode = maybeClosestLeaf;
    const root: NodeIdMap.TXorNode = {
        kind: NodeIdMap.XorNodeKind.Ast,
        node: closestLeaf,
    };
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
        root,
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

// Used as expandNodesFn.
// Returns the current XorNode's parent (if one exists).
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

// Used as visitNodeFn.
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

// Returns the XorNode at given Position, else returns closest XorNode to the left (if one exists).
function maybeClosestXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<Ast.TNode> {
    let maybeCurrentNode: Option<Ast.TNode>;

    for (const nodeId of leafNodeIds) {
        const newNode: Ast.TNode = NodeIdMap.expectAstNode(nodeIdMapCollection.astNodeById, nodeId);
        maybeCurrentNode = closerXorNodeLeaf(position, maybeCurrentNode, newNode);
    }

    return maybeCurrentNode;
}

// Assumes both XorNode parameters are leaf nodes.
function closerXorNodeLeaf(
    position: Position,
    maybeCurrentNode: Option<Ast.TNode>,
    newNode: Ast.TNode,
): Option<Ast.TNode> {
    const newNodePositionEnd: TokenPosition = newNode.tokenRange.positionEnd;

    // If currentToken isn't set and newNode's start position is <= position: return newToken
    // Else: return undefined
    if (maybeCurrentNode === undefined) {
        const newNodePositionStart: TokenPosition = newNode.tokenRange.positionStart;
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
    const currentNode: Ast.TNode = maybeCurrentNode;
    const currentNodePositionEnd: TokenPosition = currentNode.tokenRange.positionEnd;

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
