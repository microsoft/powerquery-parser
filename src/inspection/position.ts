// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option } from "../common";
import { Token, TokenPosition } from "../lexer";
import { Ast, NodeIdMap, ParserContext } from "../parser";

export interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

export function isPositionBeforeXorNode(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionBeforeAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isPositionBeforeContextNode(position, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isPositionOnXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: NodeIdMap.TXorNode,
): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionOnAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isPositionOnContextNode(position, nodeIdMapCollection, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isPositionAfterXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: NodeIdMap.TXorNode,
): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionAfterAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isPositionAfterContextNode(position, nodeIdMapCollection, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isPositionBeforeContextNode(position: Position, contextNode: ParserContext.Node): boolean {
    const maybeTokenStart: Option<Token> = contextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        return false;
    }
    const tokenStart: Token = maybeTokenStart;

    return isPositionBeforeTokenPosition(position, tokenStart.positionStart);
}

export function isPositionOnContextNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    contextNode: ParserContext.Node,
): boolean {
    return (
        !isPositionBeforeContextNode(position, contextNode) &&
        !isPositionAfterContextNode(position, nodeIdMapCollection, contextNode)
    );
}

export function isPositionAfterContextNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    contextNode: ParserContext.Node,
): boolean {
    const maybeLeaf: Option<Ast.TNode> = maybeRightMostLeaf(nodeIdMapCollection, contextNode.id);
    if (maybeLeaf === undefined) {
        return false;
    }
    const leaf: Ast.TNode = maybeLeaf;

    return isPositionAfterAstNode(position, leaf);
}

export function isPositionBeforeAstNode(position: Position, astNode: Ast.TNode): boolean {
    return isPositionBeforeTokenPosition(position, astNode.tokenRange.positionStart);
}

export function isPositionOnAstNode(position: Position, astNode: Ast.TNode): boolean {
    return !isPositionBeforeAstNode(position, astNode) && !isPositionAfterAstNode(position, astNode);
}

export function isPositionAfterAstNode(position: Position, astNode: Ast.TNode): boolean {
    return isPositionAfterTokenPosition(position, astNode.tokenRange.positionEnd);
}

export function isPositionBeforeTokenPosition(position: Position, tokenPositionStart: TokenPosition): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPositionStart.lineNumber) {
        return true;
    } else if (positionLineNumber > tokenPositionStart.lineNumber) {
        return false;
    } else {
        return position.lineCodeUnit <= tokenPositionStart.lineCodeUnit;
    }
}

export function isPositionAfterTokenPosition(position: Position, tokenPositionEnd: TokenPosition): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPositionEnd.lineNumber) {
        return false;
    } else if (positionLineNumber > tokenPositionEnd.lineNumber) {
        return true;
    } else {
        return position.lineCodeUnit > tokenPositionEnd.lineCodeUnit;
    }
}

// There are a few assumed invariants about children:
//  * Children are read left to right.
//  * Children are placed in childIdsById in the order they were read.
//  * Therefore the right-most child is the most recently read which also appears last in the document.
function maybeRightMostLeaf(nodeIdMapCollection: NodeIdMap.Collection, rootId: number): Option<Ast.TNode> {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let nodeIdsToExplore: number[] = [rootId];
    let maybeRightMost: Option<Ast.TNode>;

    while (nodeIdsToExplore.length) {
        const nodeId: number = nodeIdsToExplore.pop()!;
        const maybeAstNode: Option<Ast.TNode> = astNodeById.get(nodeId);

        let addChildren: boolean = false;

        // Check if Ast.TNode or ParserContext.Node
        if (maybeAstNode !== undefined) {
            const astNode: Ast.TNode = maybeAstNode;

            // Is leaf, check if it's more right than the previous record.
            // As it's a leaf there are no children to add.
            if (astNode.isLeaf) {
                // Is the first leaf encountered.
                if (maybeRightMost === undefined) {
                    maybeRightMost = astNode;
                }
                // Compare current leaf node to the existing record.
                else if (astNode.tokenRange.tokenIndexStart > maybeRightMost.tokenRange.tokenIndexStart) {
                    maybeRightMost = astNode;
                }
            }
            // Is not a leaf, no previous record exists.
            // Add all children to the queue.
            else if (maybeRightMost === undefined) {
                addChildren = true;
            }
            // Is not a leaf, previous record exists.
            // Check if we can cull the branch, otherwise add all children to the queue.
            else if (astNode.tokenRange.tokenIndexEnd > maybeRightMost.tokenRange.tokenIndexStart) {
                addChildren = true;
            }
        }
        // Must be a ParserContext.Node.
        // Add all children to the queue as ParserContext.Nodes can have Ast children which are leafs.
        else {
            addChildren = true;
        }

        if (addChildren) {
            const maybeChildIds: Option<ReadonlyArray<number>> = nodeIdMapCollection.childIdsById.get(nodeId);
            if (maybeChildIds !== undefined) {
                // Add the child ids in reversed order to prioritize visiting the right most nodes first.
                const childIds: ReadonlyArray<number> = maybeChildIds;
                const reversedChildIds: number[] = [...childIds];
                reversedChildIds.reverse();
                nodeIdsToExplore = [...reversedChildIds, ...nodeIdsToExplore];
            }
        }
    }

    return maybeRightMost;
}
