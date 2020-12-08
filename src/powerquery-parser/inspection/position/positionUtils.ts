// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert } from "../../common";
import { Ast, Token } from "../../language";
import { NodeIdMap, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind } from "../../parser";
import { Position } from "./position";

export function isBeforeXor(position: Position, xorNode: TXorNode, isBoundIncluded: boolean): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isBeforeAst(position, xorNode.node, isBoundIncluded);

        case XorNodeKind.Context:
            return isBeforeContext(position, xorNode.node, isBoundIncluded);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isInXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    xorNode: TXorNode,
    isLowerBoundIncluded: boolean,
    isUpperBoundIncluded: boolean,
): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isInAst(position, xorNode.node, isLowerBoundIncluded, isUpperBoundIncluded);

        case XorNodeKind.Context:
            return isInContext(nodeIdMapCollection, position, xorNode.node, isLowerBoundIncluded, isUpperBoundIncluded);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isOnXorStart(position: Position, xorNode: TXorNode): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isOnAstStart(position, xorNode.node);

        case XorNodeKind.Context:
            return isOnContextStart(position, xorNode.node);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isOnXorEnd(nodeIdMapCollection: NodeIdMap.Collection, position: Position, xorNode: TXorNode): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isOnAstEnd(position, xorNode.node);

        case XorNodeKind.Context:
            return isOnContextEnd(nodeIdMapCollection, position, xorNode.node);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isAfterXor(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    xorNode: TXorNode,
    isBoundIncluded: boolean,
): boolean {
    switch (xorNode.kind) {
        case XorNodeKind.Ast:
            return isAfterAst(position, xorNode.node, isBoundIncluded);

        case XorNodeKind.Context:
            return isAfterContext(nodeIdMapCollection, position, xorNode.node, isBoundIncluded);

        default:
            throw Assert.isNever(xorNode);
    }
}

export function isBeforeContext(position: Position, contextNode: ParseContext.Node, isBoundIncluded: boolean): boolean {
    const maybeTokenStart: Token.Token | undefined = contextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        return false;
    }
    const tokenStart: Token.Token = maybeTokenStart;

    return isBeforeTokenPosition(position, tokenStart.positionStart, isBoundIncluded);
}

export function isInContext(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: ParseContext.Node,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeContext(position, contextNode, isLowerBoundIncluded) &&
        !isAfterContext(nodeIdMapCollection, position, contextNode, isHigherBoundIncluded)
    );
}

export function isOnContextStart(position: Position, contextNode: ParseContext.Node): boolean {
    return contextNode.maybeTokenStart !== undefined
        ? isOnTokenPosition(position, contextNode.maybeTokenStart.positionStart)
        : false;
}

export function isOnContextEnd(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: ParseContext.Node,
): boolean {
    const maybeLeaf: Ast.TNode | undefined = NodeIdMapUtils.maybeRightMostLeaf(nodeIdMapCollection, contextNode.id);
    if (maybeLeaf === undefined) {
        return false;
    }

    return isOnAstEnd(position, maybeLeaf);
}

export function isAfterContext(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    contextNode: ParseContext.Node,
    isBoundIncluded: boolean,
): boolean {
    const maybeLeaf: Ast.TNode | undefined = NodeIdMapUtils.maybeRightMostLeaf(nodeIdMapCollection, contextNode.id);
    if (maybeLeaf === undefined) {
        // We're assuming position is a valid range for the document.
        // Therefore if the context node didn't have a token (caused by EOF) we can make this assumption.
        if (contextNode.maybeTokenStart === undefined) {
            return false;
        } else {
            return isAfterTokenPosition(position, contextNode.maybeTokenStart.positionEnd, isBoundIncluded);
        }
    }
    const leaf: Ast.TNode = maybeLeaf;

    return isAfterAst(position, leaf, isBoundIncluded);
}

export function isBeforeAst(position: Position, astNode: Ast.TNode, isBoundIncluded: boolean): boolean {
    return isBeforeTokenPosition(position, astNode.tokenRange.positionStart, isBoundIncluded);
}

export function isInAst(
    position: Position,
    astNode: Ast.TNode,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeAst(position, astNode, isLowerBoundIncluded) && !isAfterAst(position, astNode, isHigherBoundIncluded)
    );
}

export function isOnAstStart(position: Position, astNode: Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionStart);
}

export function isOnAstEnd(position: Position, astNode: Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionEnd);
}

export function isAfterAst(position: Position, astNode: Ast.TNode, isBoundIncluded: boolean): boolean {
    return isAfterTokenPosition(position, astNode.tokenRange.positionEnd, isBoundIncluded);
}

export function isInToken(
    position: Position,
    token: Token.Token,
    isLowerBoundIncluded: boolean,
    isHigherBoundIncluded: boolean,
): boolean {
    return (
        !isBeforeTokenPosition(position, token.positionStart, isLowerBoundIncluded) &&
        !isAfterTokenPosition(position, token.positionEnd, isHigherBoundIncluded)
    );
}

export function isBeforeTokenPosition(
    position: Position,
    tokenPosition: Token.TokenPosition,
    isBoundIncluded: boolean,
): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPosition.lineNumber) {
        return true;
    } else if (positionLineNumber > tokenPosition.lineNumber) {
        return false;
    } else {
        const upperBound: number = isBoundIncluded ? tokenPosition.lineCodeUnit : tokenPosition.lineCodeUnit + 1;
        return position.lineCodeUnit < upperBound;
    }
}

export function isOnTokenPosition(position: Position, tokenPosition: Token.TokenPosition): boolean {
    return position.lineNumber === tokenPosition.lineNumber && position.lineCodeUnit === tokenPosition.lineCodeUnit;
}

export function isAfterTokenPosition(
    position: Position,
    tokenPosition: Token.TokenPosition,
    isBoundIncluded: boolean,
): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPosition.lineNumber) {
        return false;
    } else if (positionLineNumber > tokenPosition.lineNumber) {
        return true;
    } else {
        const upperBound: number = isBoundIncluded ? tokenPosition.lineCodeUnit : tokenPosition.lineCodeUnit - 1;
        return position.lineCodeUnit > upperBound;
    }
}
