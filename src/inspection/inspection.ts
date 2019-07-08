// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, ResultKind, Traverse } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap } from "../parser";
import { TNode } from "./node";
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
    const maybeClosestLeaf: Option<Ast.TNode> = maybeClosestAstNode(position, nodeIdMapCollection, leafNodeIds);
    if (maybeClosestLeaf === undefined) {
        return {
            kind: ResultKind.Ok,
            value: DefaultInspection,
        };
    }
    const closestLeaf: Ast.TNode = maybeClosestLeaf;

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
    const root: NodeIdMap.TXorNode = {
        kind: NodeIdMap.XorNodeKind.Ast,
        node: closestLeaf,
    };

    return Traverse.tryTraverseXor<State, Inspected>(
        root,
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

// Used as expandNodesFn.
// Returns the XorNode's parent if one exists.
function addParentXorNode(
    _state: State & Traverse.IState<Inspected>,
    xorNode: NodeIdMap.TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<NodeIdMap.TXorNode> {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(xorNode.node.id);
    if (maybeParentNodeId === undefined) {
        return [];
    }
    const parentNodeId: number = maybeParentNodeId;

    const maybeParentXorNode: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeXorNode(nodeIdMapCollection, parentNodeId);
    if (maybeParentXorNode === undefined) {
        return [];
    } else {
        const parentXorNode: NodeIdMap.TXorNode = maybeParentXorNode;
        return [parentXorNode];
    }
}

// Either returns a XorNode used as the root for a traverse, or returns undefined. The options are:
//  * the XorNode at the given position
//  * the closest XorNode to the left of the given position
//  * undefined
function maybeClosestAstNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<Ast.TNode> {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let maybeClosestNode: Option<Ast.TNode>;

    for (const nodeId of leafNodeIds) {
        const newNode: Ast.TNode = NodeIdMap.expectAstNode(astNodeById, nodeId);
        maybeClosestNode = closerXorNode(position, maybeClosestNode, newNode);
    }

    return maybeClosestNode;
}

// Assumes both XorNode parameters are leaf nodes.
function closerXorNode(position: Position, maybeCurrentNode: Option<Ast.TNode>, newNode: Ast.TNode): Option<Ast.TNode> {
    const newNodePositionStart: TokenPosition = newNode.tokenRange.positionStart;

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
    const currentNode: Ast.TNode = maybeCurrentNode;
    const currentNodePositionStart: TokenPosition = currentNode.tokenRange.positionStart;

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
