// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option, ResultUtils, Traverse, TypeUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils } from "../parser";
import { IInspectedNode, InspectedInvokeExpression } from "./node";
import { Position } from "./position";
import { PositionIdentifierKind, TPositionIdentifier } from "./positionIdentifier";
import { visitNode } from "./visitNode";

// An inspection is done by selecting a leaf node, then recursively traveling up the node's parents.
// If a leaf node doesn't exist at the given postion, then the closest node to the left is used (if one exists).
//
// There are three forms that the parent path can take:
//  * all nodes are Ast.TNode
//  * all nodes are ParserContext.Node
//  * nodes are initially Ast.TNode, then they become ParserContext.Node

export type TriedInspection = Traverse.TriedTraverse<Inspected>;

export interface State extends Traverse.IState<UnfrozenInspected> {
    readonly position: Position;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then we store that leaf here.
    // Later if we encounter the assignment for this identifier then it's stored in Inspected.maybePositionIdentifier
    readonly maybeClosestLeafIdentifier: Option<Ast.Identifier | Ast.GeneralizedIdentifier>;
}

export interface Inspected {
    // A map of (identifier, what caused the identifier to be added).
    readonly scope: ReadonlyMap<string, NodeIdMap.TXorNode>;
    // The DFS traversal path is recorded, starting from the given position's leaf node to the last parents' parent.
    // This is primarily used during the inspection itself, but it's made public on the chance that it's useful.
    readonly visitedNodes: ReadonlyArray<IInspectedNode>;
    // Metadata on the first InvokeExpression encountered.
    readonly maybeInvokeExpression: Option<InspectedInvokeExpression>;
    // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
    // then if we encounter the identifier's assignment we will store metadata.
    readonly maybePositionIdentifier: Option<TPositionIdentifier>;
}

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspection {
    const maybeClosestLeaf: Option<Ast.TNode> = maybeClosestAstNode(position, nodeIdMapCollection, leafNodeIds);
    if (maybeClosestLeaf === undefined) {
        return ResultUtils.okFactory(DefaultInspection);
    }

    const closestLeaf: Ast.TNode = maybeClosestLeaf;
    const root: NodeIdMap.TXorNode = {
        kind: NodeIdMap.XorNodeKind.Ast,
        node: closestLeaf,
    };
    const state: State = {
        result: {
            scope: new Map(),
            visitedNodes: [],
            maybeInvokeExpression: undefined,
            maybePositionIdentifier: undefined,
        },
        // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
        // then store it on here so if we encounter
        maybeClosestLeafIdentifier: maybeClosestLeafIdentifier(nodeIdMapCollection, closestLeaf),
        position,
        nodeIdMapCollection,
        leafNodeIds,
    };

    const triedTraverse: TriedTraverse<UnfrozenInspected> = Traverse.tryTraverseXor<State, UnfrozenInspected>(
        state,
        nodeIdMapCollection,
        root,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        addParentXorNode,
        undefined,
    );
    // If an identifier is at the given Position but its definition wasn't found during the inspection,
    // then create an UndefinedIdentifier for maybePositionIdentifier.
    if (
        ResultUtils.isOk(triedTraverse) &&
        state.maybeClosestLeafIdentifier &&
        state.result.maybePositionIdentifier === undefined
    ) {
        return ResultUtils.okFactory({
            ...triedTraverse.value,
            maybePositionIdentifier: {
                kind: PositionIdentifierKind.Undefined,
                identifier: state.maybeClosestLeafIdentifier,
            },
        });
    } else {
        return triedTraverse;
    }
}

// Inspected should be mutable during traversal, but immutable when returned to the caller.
type UnfrozenInspected = TypeUtils.StripReadonly<Inspected>;

const DefaultInspection: Inspected = {
    visitedNodes: [],
    scope: new Map(),
    maybeInvokeExpression: undefined,
    maybePositionIdentifier: undefined,
};

function maybeClosestLeafIdentifier(
    nodeIdMapCollection: NodeIdMap.Collection,
    closestLeaf: Ast.TNode,
): Option<Ast.Identifier | Ast.GeneralizedIdentifier> {
    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    if (closestLeaf.kind === Ast.NodeKind.Constant && closestLeaf.literal === `@`) {
        const maybeParentId: Option<number> = nodeIdMapCollection.parentIdById.get(closestLeaf.id);
        if (maybeParentId === undefined) {
            return undefined;
        }
        const parentId: number = maybeParentId;

        const parent: Ast.TNode = NodeIdMapUtils.expectAstNode(nodeIdMapCollection.astNodeById, parentId);
        return parent.kind === Ast.NodeKind.IdentifierExpression ? parent.identifier : undefined;
    } else if (
        closestLeaf.kind === Ast.NodeKind.Identifier ||
        closestLeaf.kind === Ast.NodeKind.GeneralizedIdentifier
    ) {
        return closestLeaf;
    } else {
        return undefined;
    }
}

// Used as expandNodesFn.
// Returns the XorNode's parent if one exists.
function addParentXorNode(
    _state: State & Traverse.IState<UnfrozenInspected>,
    xorNode: NodeIdMap.TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<NodeIdMap.TXorNode> {
    const maybeParent: Option<NodeIdMap.TXorNode> = NodeIdMapUtils.maybeParentXorNode(
        nodeIdMapCollection,
        xorNode.node.id,
    );
    return maybeParent !== undefined ? [maybeParent] : [];
}

// Either returns a Ast.TNode used as the root for a traverse, or returns undefined. The options are:
//  * the Ast.TNode at the given position
//  * the closest Ast.TNode to the left of the given position
//  * undefined
function maybeClosestAstNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<Ast.TNode> {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let maybeClosestNode: Option<Ast.TNode>;

    for (const nodeId of leafNodeIds) {
        const newNode: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);
        maybeClosestNode = closerAstNode(position, maybeClosestNode, newNode);
    }

    return maybeClosestNode;
}

function closerAstNode(position: Position, maybeCurrentNode: Option<Ast.TNode>, newNode: Ast.TNode): Option<Ast.TNode> {
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
        newNodePositionStart.lineCodeUnit >= position.lineCodeUnit
    ) {
        return currentNode;
    }

    // Already checked (currentTokenPositionStart <= Position && newTokenPositionStart <= Position),
    // so grab the right most Node by checking TokenPosition.codeUnit
    return newNodePositionStart.codeUnit > currentNodePositionStart.codeUnit ? newNode : currentNode;
}
