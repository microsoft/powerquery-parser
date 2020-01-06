// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option, CommonError } from "../../common";
import { Token, TokenPosition } from "../../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../../parser";
import { Position, ActiveNode, RelativePosition } from "./position";
import { relative } from "path";

export function maybeActiveNode(
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
        // if (ShiftRightConstantKinds.indexOf(constant.literal) !== -1) {
        //     if (astSearch.maybeAfterPosition !== undefined) {
        //         return NodeIdMapUtils.xorNodeFromAst(astSearch.maybeAfterPosition);
        //     } else if (contextSearch.maybeAfterPosition !== undefined) {
        //         return NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeAfterPosition);
        //     } else if (contextSearch.maybeOnOrBeforePosition !== undefined) {
        //         return NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeOnOrBeforePosition);
        //     } else {
        //         throw new CommonError.InvariantError("shouldn't ever reach this case");
        //     }
        // } else {
        //     shiftRight = isAfterTokenPosition(position, constant.tokenRange.positionEnd, false);
        // }
        shiftRight = isAfterTokenPosition(position, constant.tokenRange.positionEnd, false);
    } else {
        shiftRight = false;
    }

    if (shiftRight) {
        if (contextSearch.maybeAfterPosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeAfterPosition);
        } else if (astSearch.maybeAfterPosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromAst(astSearch.maybeAfterPosition);
        } else {
            return undefined;
        }
    } else {
        if (contextSearch.maybeOnOrBeforePosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeOnOrBeforePosition);
        } else if (astSearch.maybeOnOrBeforePosition !== undefined) {
            return NodeIdMapUtils.xorNodeFromAst(astSearch.maybeOnOrBeforePosition);
        } else {
            return undefined;
        }
    }
}

export function maybeActiveNode2(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<ActiveNode> {
    const astSearch: PositionNodeSearch<Ast.TNode> = positionAstSearch(
        position,
        nodeIdMapCollection.astNodeById,
        leafNodeIds,
    );
    const contextSearch: PositionNodeSearch<ParserContext.Node> = positionContextSearch(position, nodeIdMapCollection);

    let shiftRight: boolean;
    if (astSearch.maybeOnOrBeforePosition && astSearch.maybeOnOrBeforePosition.kind === Ast.NodeKind.Constant) {
        const constant: Ast.Constant = astSearch.maybeOnOrBeforePosition;
        shiftRight =
            // 'foo |'
            isAfterTokenPosition(position, constant.tokenRange.positionEnd, false) ||
            // 'key=|value'
            ShiftRightConstantKinds.indexOf(constant.literal) !== -1;
    } else {
        shiftRight = false;
    }

    let maybeXorNode: Option<NodeIdMap.TXorNode>;
    if (shiftRight) {
        if (astSearch.maybeAfterPosition !== undefined) {
            maybeXorNode = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeAfterPosition);
        } else if (contextSearch.maybeAfterPosition !== undefined) {
            maybeXorNode = NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeAfterPosition);
        } else if (
            contextSearch.maybeOnOrBeforePosition &&
            isUnderContextNodeStart(position, contextSearch.maybeOnOrBeforePosition)
        ) {
            maybeXorNode = NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeOnOrBeforePosition);
        } else {
            maybeXorNode = undefined;
        }
    } else {
        if (astSearch.maybeOnOrBeforePosition) {
            maybeXorNode = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeOnOrBeforePosition);
        } else if (contextSearch.maybeOnOrBeforePosition) {
            maybeXorNode = NodeIdMapUtils.xorNodeFromContext(contextSearch.maybeOnOrBeforePosition);
        } else {
            maybeXorNode = undefined;
        }
    }

    if (maybeXorNode === undefined) {
        return undefined;
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    let relativePosition: RelativePosition;
    if (isBeforeXorNode(position, maybeXorNode)) {
        relativePosition = RelativePosition.Left;
    } else if (isAfterXorNode(position, nodeIdMapCollection, xorNode)) {
        relativePosition = RelativePosition.Right;
    } else {
        relativePosition = RelativePosition.Under;
    }

    return {
        xorNode,
        relativePosition,
        isNoopXorNode:
            xorNode.kind === NodeIdMap.XorNodeKind.Context &&
            NodeIdMapUtils.maybeRightMostLeaf(nodeIdMapCollection, xorNode.node.id) === undefined,
    };
}

export function isBeforeXorNode(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isBeforeAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isBeforeContextNode(position, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isOnXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: NodeIdMap.TXorNode,
): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isOnAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isUnderContextNode(position, nodeIdMapCollection, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isOnXorNodeStart(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isOnAstNodeStart(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isUnderContextNodeStart(position, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isOnXorNodeEnd(position: Position, xorNode: NodeIdMap.TXorNode): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isOnAstNodeEnd(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return false;

        default:
            throw isNever(xorNode);
    }
}

export function isAfterXorNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    xorNode: NodeIdMap.TXorNode,
): boolean {
    switch (xorNode.kind) {
        case NodeIdMap.XorNodeKind.Ast:
            return isAfterAstNode(position, xorNode.node);

        case NodeIdMap.XorNodeKind.Context:
            return isAfterContextNode(position, nodeIdMapCollection, xorNode.node);

        default:
            throw isNever(xorNode);
    }
}

export function isBeforeContextNode(position: Position, contextNode: ParserContext.Node): boolean {
    const maybeTokenStart: Option<Token> = contextNode.maybeTokenStart;
    if (maybeTokenStart === undefined) {
        return false;
    }
    const tokenStart: Token = maybeTokenStart;

    return isBeforeTokenPosition(position, tokenStart.positionStart);
}

export function isUnderContextNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    contextNode: ParserContext.Node,
): boolean {
    return (
        !isBeforeContextNode(position, contextNode) && !isAfterContextNode(position, nodeIdMapCollection, contextNode)
    );
}

export function isUnderContextNodeStart(position: Position, contextNode: ParserContext.Node): boolean {
    return contextNode.maybeTokenStart !== undefined
        ? isOnTokenPosition(position, contextNode.maybeTokenStart.positionStart)
        : false;
}

export function isAfterContextNode(
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
            return isAfterTokenPosition(position, contextNode.maybeTokenStart.positionEnd, true);
        }
    }
    const leaf: Ast.TNode = maybeLeaf;

    return isAfterAstNode(position, leaf);
}

export function isBeforeAstNode(position: Position, astNode: Ast.TNode): boolean {
    return isBeforeTokenPosition(position, astNode.tokenRange.positionStart);
}

export function isOnAstNode(position: Position, astNode: Ast.TNode): boolean {
    return !isBeforeAstNode(position, astNode) && !isAfterAstNode(position, astNode);
}

export function isOnAstNodeStart(position: Position, astNode: Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionStart);
}

export function isOnAstNodeEnd(position: Position, astNode: Ast.TNode): boolean {
    return isOnTokenPosition(position, astNode.tokenRange.positionEnd);
}

export function isOnOrDirectlyAfterAstNode(position: Position, astNode: Ast.TNode): boolean {
    return isOnAstNode(position, astNode) || isOnTokenPosition(position, astNode.tokenRange.positionEnd);
}

export function isAfterAstNode(position: Position, astNode: Ast.TNode): boolean {
    return isAfterTokenPosition(position, astNode.tokenRange.positionEnd, true);
}

export function isBeforeTokenPosition(position: Position, tokenPositionStart: TokenPosition): boolean {
    const positionLineNumber: number = position.lineNumber;

    if (positionLineNumber < tokenPositionStart.lineNumber) {
        return true;
    } else if (positionLineNumber > tokenPositionStart.lineNumber) {
        return false;
    } else {
        return position.lineCodeUnit < tokenPositionStart.lineCodeUnit;
    }
}

export function isOnTokenPosition(position: Position, tokenPosition: TokenPosition): boolean {
    return position.lineNumber === tokenPosition.lineNumber && position.lineCodeUnit === tokenPosition.lineCodeUnit;
}

export function isAfterTokenPosition(
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

// Returns the closest Ast nodes that are:
// * on or to the left of position
// * to the right of position
function positionAstSearch(
    position: Position,
    astNodeById: NodeIdMap.AstNodeById,
    leafNodeIds: ReadonlyArray<number>,
): PositionNodeSearch<Ast.TNode> {
    let maybeCurrentOnOrBefore: Option<Ast.TNode>;
    let maybeCurrentAfter: Option<Ast.TNode>;

    for (const nodeId of leafNodeIds) {
        const candidate: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);
        if (isAfterAstNode(position, candidate)) {
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

// Returns the closest context nodes that are:
// * on or to the left of position
// * to the right of position
function positionContextSearch(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
): PositionNodeSearch<ParserContext.Node> {
    const contextNodeById: NodeIdMap.ContextNodeById = nodeIdMapCollection.contextNodeById;
    let maybeCurrentOnOrBefore: Option<ParserContext.Node>;
    let maybeCurrentAfter: Option<ParserContext.Node>;

    for (const candidate of contextNodeById.values()) {
        if (isAfterContextNode(position, nodeIdMapCollection, candidate)) {
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
