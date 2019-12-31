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

export function isPositionOnXorNodeStart(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionOnAstNodeStart(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isPositionOnContextNodeStart(position, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isPositionOnXorNodeEnd(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isPositionOnAstNodeEnd(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return false;

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

export function isPositionOnContextNodeStart(position: Position, contextNode: ParserContext.Node): boolean {
    return contextNode.maybeTokenStart !== undefined
        ? isPositionOnTokenPosition(position, contextNode.maybeTokenStart.positionStart)
        : false;
}

export function isPositionAfterContextNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    contextNode: ParserContext.Node,
): boolean {
    const maybeLeaf: Option<Ast.TNode> = NodeIdMapUtils.maybeRightMostLeaf(nodeIdMapCollection, contextNode.id);
    if (maybeLeaf === undefined) {
        // We're assuming position is a valid range for the document.
        // Therefore if the context node didn't have a token (caused by EOF) we can make this assumption.
        if (contextNode.maybeTokenStart === undefined) {
            return false;
        } else {
            return isPositionAfterTokenPosition(position, contextNode.maybeTokenStart.positionEnd, true);
        }
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

export function isPositionOnAstNodeStart(position: Position, astNode: Ast.TNode): boolean {
    return isPositionOnTokenPosition(position, astNode.tokenRange.positionStart);
}

export function isPositionOnAstNodeEnd(position: Position, astNode: Ast.TNode): boolean {
    return isPositionOnTokenPosition(position, astNode.tokenRange.positionEnd);
}

export function isPositionOnOrDirectlyAfterAstNode(position: Position, astNode: Ast.TNode): boolean {
    return (
        isPositionOnAstNode(position, astNode) || isPositionOnTokenPosition(position, astNode.tokenRange.positionEnd)
    );
}

export function isPositionAfterAstNode(position: Position, astNode: Ast.TNode): boolean {
    return isPositionAfterTokenPosition(position, astNode.tokenRange.positionEnd, true);
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

export function isPositionOnTokenPosition(position: Position, tokenPosition: TokenPosition): boolean {
    return position.lineNumber === tokenPosition.lineNumber && position.lineCodeUnit === tokenPosition.lineCodeUnit;
}

export function isPositionAfterTokenPosition(
    position: Position,
    tokenPosition: TokenPosition,
    exclusiveUpperBound: boolean,
): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPosition.lineNumber) {
        return false;
    } else if (positionLineNumber > tokenPosition.lineNumber) {
        return true;
    } else {
        // Offset the fact that tokenPositionEnd has an exclusive range
        if (exclusiveUpperBound) {
            return position.lineCodeUnit > tokenPosition.lineCodeUnit - 1;
        } else {
            return position.lineCodeUnit > tokenPosition.lineCodeUnit;
        }
    }
}

interface PositionNodeSearch<T> {
    readonly maybeOnOrBeforePosition: Option<T>;
    readonly maybeAfterPosition: Option<T>;
}

const ShiftRightConstantKinds: ReadonlyArray<string> = [
    Ast.ConstantKind.Comma,
    Ast.ConstantKind.Equal,
    Ast.ConstantKind.FatArrow,
    Ast.ConstantKind.LeftBrace,
    Ast.ConstantKind.LeftBracket,
    Ast.ConstantKind.LeftParenthesis,
    Ast.ConstantKind.RightBrace,
    Ast.ConstantKind.RightBracket,
    Ast.ConstantKind.RightParenthesis,
];

function positionNodeSearch(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<NodeIdMap.TXorNode> {
    const astSearch: PositionNodeSearch<Ast.TNode> = positionAstSearch(
        position,
        nodeIdMapCollection.astNodeById,
        leafNodeIds,
    );
    const contextSearch: PositionNodeSearch<ParserContext.Node> = positionContextSearch(position, nodeIdMapCollection);

    let shiftRight: boolean;
    if (astSearch.maybeOnOrBeforePosition && astSearch.maybeOnOrBeforePosition.kind === Ast.NodeKind.Constant) {
        const constant: Ast.Constant = astSearch.maybeOnOrBeforePosition;
        shiftRight = ShiftRightConstantKinds.indexOf(constant.literal) !== -1;
    } else {
        shiftRight = false;
    }

    if (shiftRight) {
        if (astSearch.maybeAfterPosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromAst(astSearch.maybeAfterPosition);
        } else if (contextSearch.maybeAfterPosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeAfterPosition);
        } else {
            return undefined;
        }
    } else {
        if (astSearch.maybeOnOrBeforePosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromAst(astSearch.maybeOnOrBeforePosition);
        } else if (contextSearch.maybeOnOrBeforePosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeOnOrBeforePosition);
        } else {
            return undefined;
        }
    }
}

function positionAstSearch(
    position: Position,
    astNodeById: NodeIdMap.AstNodeById,
    leafNodeIds: ReadonlyArray<number>,
): PositionNodeSearch<Ast.TNode> {
    let maybeCurrentOnOrBefore: Option<Ast.TNode>;
    let maybeCurrentAfter: Option<Ast.TNode>;

    for (const nodeId of leafNodeIds) {
        const candidate: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);
        if (isPositionAfterAstNode(position, candidate)) {
            if (maybeCurrentOnOrBefore === undefined) {
                maybeCurrentOnOrBefore = candidate;
            } else {
                const currentOnOrBefore: Ast.TNode = maybeCurrentOnOrBefore;

                if (candidate.tokenRange.tokenIndexStart > currentOnOrBefore.tokenRange.tokenIndexStart) {
                    maybeCurrentOnOrBefore = candidate;
                }
            }
        } else {
            if (maybeCurrentAfter === undefined) {
                maybeCurrentAfter = candidate;
            } else {
                const currentAfter: Ast.TNode = maybeCurrentAfter;

                if (candidate.tokenRange.tokenIndexStart < currentAfter.tokenRange.tokenIndexStart) {
                    maybeCurrentAfter = candidate;
                }
            }
        }
    }

    return {
        maybeOnOrBeforePosition: maybeCurrentOnOrBefore,
        maybeAfterPosition: maybeCurrentAfter,
    };
}

function positionContextSearch(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
): PositionNodeSearch<ParserContext.Node> {
    const contextNodeById: NodeIdMap.ContextNodeById = nodeIdMapCollection.contextNodeById;
    let maybeCurrentOnOrBefore: Option<ParserContext.Node>;
    let maybeCurrentAfter: Option<ParserContext.Node>;

    for (const candidate of contextNodeById.values()) {
        if (isPositionAfterContextNode(position, nodeIdMapCollection, candidate)) {
            if (maybeCurrentOnOrBefore === undefined) {
                maybeCurrentOnOrBefore = candidate;
            } else {
                const currentOnOrBefore: ParserContext.Node = maybeCurrentOnOrBefore;

                if (candidate.tokenIndexStart > currentOnOrBefore.tokenIndexStart) {
                    maybeCurrentOnOrBefore = candidate;
                }
            }
        } else {
            if (maybeCurrentAfter === undefined) {
                maybeCurrentAfter = candidate;
            } else {
                const currentAfter: ParserContext.Node = maybeCurrentAfter;

                if (candidate.tokenIndexStart < currentAfter.tokenIndexStart) {
                    maybeCurrentAfter = candidate;
                }
            }
        }
    }

    return {
        maybeOnOrBeforePosition: maybeCurrentOnOrBefore,
        maybeAfterPosition: maybeCurrentAfter,
    };
}
