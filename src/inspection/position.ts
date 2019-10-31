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
            return true;

        default:
            throw isNever(xorNode);
    }
}

export function isPositionOnXorNode(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionOnAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return true;

        default:
            throw isNever(xorNode);
    }
}

export function isPositionAfterXorNode(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionAfterAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return true;

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
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: ParserContext.Node,
): boolean {
    return (
        !isPositionBeforeContextNode(position, contextNode) &&
        !isPositionAfterContextNode(nodeIdMapCollection, position, contextNode)
    );
}

export function isPositionAfterContextNode(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: ParserContext.Node,
): boolean {
    const maybeRightMostAstNode: Option<Ast.TNode> = NodeIdMap.maybeRightMostAstDescendant(
        nodeIdMapCollection,
        contextNode.id,
    );
    if (maybeRightMostAstNode === undefined) {
        return false;
    }
    const rightMostAstNode: Ast.TNode = maybeRightMostAstNode;

    return isPositionAfterAstNode(position, rightMostAstNode);
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
        return position.lineCodeUnit <= tokenPositionStart.codeUnit;
    }
}

export function isPositionAfterTokenPosition(position: Position, tokenPositionEnd: TokenPosition): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPositionEnd.lineNumber) {
        return false;
    } else if (positionLineNumber > tokenPositionEnd.lineNumber) {
        return true;
    } else {
        return position.lineCodeUnit > tokenPositionEnd.codeUnit;
    }
}
