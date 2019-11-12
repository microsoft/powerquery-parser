// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option, ResultKind, Traverse, TypeUtils } from "../common";
import { TriedTraverse } from "../common/traversal";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";
import * as identifier from "./identifier";
import * as keyword from "./keyword";
import { IInspectedNode } from "./node";
import { Position } from "./position";
import { PositionIdentifierKind } from "./positionIdentifier";
import { Inspected, State } from "./state";

// An inspection is done by selecting a leaf node, then recursively traveling up the node's parents.
// If a leaf node doesn't exist at the given postion, then the closest node to the left is used (if one exists).
//
// There are three forms that the parent path can take:
//  * all nodes are Ast.TNode
//  * all nodes are ParserContext.Node
//  * nodes are initially Ast.TNode, then they become ParserContext.Node

export type TriedInspection = Traverse.TriedTraverse<Inspected>;

export function tryFrom(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): TriedInspection {
    const maybeClosestLeaf: Option<Ast.TNode> = maybeClosestAstNode(position, nodeIdMapCollection, leafNodeIds);
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
            // COMMON
            visitedNodes: [],

            // IDENTIFIER INSPECTION
            scope: new Map(),
            maybeInvokeExpression: undefined,
            maybePositionIdentifier: undefined,

            // KEYWORD INSPECTION
            allowedKeywords: [],
            maybeRequiredKeyword: undefined,
        },
        // COMMON
        position,
        nodeIdMapCollection,
        leafNodeIds,

        // IDENTIFIER INSPECTION
        // If the position picks either an (Identifier | GeneralizedIdentifier) as its leaf node,
        // then store it on here so if we encounter
        maybeClosestLeafIdentifier: maybeClosestLeafIdentifier(nodeIdMapCollection, closestLeaf),

        // KEYWORD INSPECTION
        isKeywordInspectionDone: false,
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
        triedTraverse.kind === ResultKind.Ok &&
        state.maybeClosestLeafIdentifier &&
        state.result.maybePositionIdentifier === undefined
    ) {
        return {
            kind: ResultKind.Ok,
            value: {
                ...triedTraverse.value,
                maybePositionIdentifier: {
                    kind: PositionIdentifierKind.Undefined,
                    identifier: state.maybeClosestLeafIdentifier,
                },
            },
        };
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
    allowedKeywords: [],
    maybeRequiredKeyword: undefined,
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

        const parent: Ast.TNode = NodeIdMap.expectAstNode(nodeIdMapCollection.astNodeById, parentId);
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

export function visitNode(state: State, xorNode: NodeIdMap.TXorNode): void {
    const visitedNodes: IInspectedNode[] = state.result.visitedNodes as IInspectedNode[];
    visitedNodes.push(inspectedNodeFrom(xorNode));

    identifier.visitNode(state, xorNode);
    keyword.visitNode(state, xorNode);
}

function inspectedNodeFrom(xorNode: NodeIdMap.TXorNode): IInspectedNode {
    let maybePositionStart: Option<TokenPosition>;
    let maybePositionEnd: Option<TokenPosition>;

    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast: {
            const tokenRange: Ast.TokenRange = xorNode.node.tokenRange;
            maybePositionStart = tokenRange.positionStart;
            maybePositionEnd = tokenRange.positionEnd;
            break;
        }

        case NodeIdMap.XorNodeKind.Context: {
            const contextNode: ParserContext.Node = xorNode.node;
            maybePositionStart =
                contextNode.maybeTokenStart !== undefined ? contextNode.maybeTokenStart.positionStart : undefined;
            maybePositionEnd = undefined;
            break;
        }

        default:
            throw isNever(xorNode);
    }

    return {
        kind: xorNode.node.kind,
        id: xorNode.node.id,
        maybePositionStart,
        maybePositionEnd,
    };
}

// Used as expandNodesFn.
// Returns the XorNode's parent if one exists.
function addParentXorNode(
    _state: State & Traverse.IState<UnfrozenInspected>,
    xorNode: NodeIdMap.TXorNode,
    nodeIdMapCollection: NodeIdMap.Collection,
): ReadonlyArray<NodeIdMap.TXorNode> {
    const maybeParent: Option<NodeIdMap.TXorNode> = NodeIdMap.maybeParentXorNode(nodeIdMapCollection, xorNode.node.id);
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
        const newNode: Ast.TNode = NodeIdMap.expectAstNode(astNodeById, nodeId);
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
