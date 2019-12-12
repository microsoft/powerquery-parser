// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option } from "../common";
import { Token, TokenPosition } from "../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../parser";

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
    const maybeLeaf: Option<Ast.TNode> = NodeIdMapUtils.maybeRightMostLeaf(nodeIdMapCollection, contextNode.id);
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
        return position.lineCodeUnit < tokenPositionStart.lineCodeUnit;
    }
}

export function isPositionAfterTokenPosition(position: Position, tokenPositionEnd: TokenPosition): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPositionEnd.lineNumber) {
        return false;
    } else if (positionLineNumber > tokenPositionEnd.lineNumber) {
        return true;
    } else {
        // Offset the fact that tokenPositionEnd has an exclusive range
        return position.lineCodeUnit > tokenPositionEnd.lineCodeUnit - 1;
    }
}
