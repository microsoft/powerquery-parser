// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option } from "../common";
import { TokenPosition } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../parser";
import { IInspectedNode } from "./node";
import { Position } from "./position";

// Checks if the closest leaf is an identifier.
// Either returns:
//  * the given node if it's an identifier
//  * the given node's parent if it's an identifier
//  * undefined
export function maybeClosestLeafIdentifier(
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

// Finds a leaf Ast.TNode which will be used for traversal.
// Either returns:
//  * the Ast.TNode at the given position
//  * the closest Ast.TNode to the left of the given position
//  * undefined
export function maybeClosestAstNode(
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

// Compares two Ast.TNode and returns the closer of the two, where a null node is considered further away.
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

// Inspections should keep track of which nodes they visited.
// Since each inspection can take a different traversal path each should keep a list of IInspectedVisitedNode.
export function inspectedVisitedNodeFrom(xorNode: NodeIdMap.TXorNode): IInspectedNode {
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
