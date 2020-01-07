// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option } from "../../common";
import { Token, TokenPosition } from "../../lexer";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../../parser";
import { ActiveNode, Position, RelativePosition } from "./position";

export function maybeActiveNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<ActiveNode> {
    const astSearch: AstNodeSearch = positionAstSearch(position, nodeIdMapCollection.astNodeById, leafNodeIds);
    const maybeContextSearch: Option<ParserContext.Node> = positionContextSearch(
        astSearch.maybeOnOrBeforePosition,
        nodeIdMapCollection,
    );

    let maybeRoot: Option<NodeIdMap.TXorNode>;
    if (astSearch.maybeOnOrBeforePosition) {
        const astNode: Ast.TNode = astSearch.maybeOnOrBeforePosition;

        if (astNode.kind === Ast.NodeKind.Constant) {
            const constant: Ast.Constant = astNode;

            // 'let x=|'
            // 'let x=|1'
            if (
                ShiftRightConstantKinds.indexOf(constant.literal) !== -1 ||
                isAfterTokenPosition(position, constant.tokenRange.positionEnd, false)
            ) {
                if (astSearch.maybeAfterPosition) {
                    maybeRoot = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeAfterPosition);
                } else if (maybeContextSearch) {
                    maybeRoot = NodeIdMapUtils.xorNodeFromContext(maybeContextSearch);
                } else {
                    maybeRoot = undefined;
                }
            }
            // Position is either under or to the right of a constant.
            else {
                maybeRoot = NodeIdMapUtils.xorNodeFromAst(constant);
            }
        } else {
            maybeRoot = NodeIdMapUtils.xorNodeFromAst(astNode);
        }
    } else if (maybeContextSearch) {
        maybeRoot = NodeIdMapUtils.xorNodeFromContext(maybeContextSearch);
    } else {
        maybeRoot = undefined;
    }

    if (maybeRoot === undefined) {
        return undefined;
    }
    const root: NodeIdMap.TXorNode = maybeRoot;
    const rootId: number = root.node.id;

    let relativePosition: RelativePosition;
    if (isBeforeXorNode(position, maybeRoot)) {
        relativePosition = RelativePosition.Left;
    } else if (isAfterXorNode(position, nodeIdMapCollection, root)) {
        relativePosition = RelativePosition.Right;
    } else {
        relativePosition = RelativePosition.Under;
    }

    return {
        position,
        root,
        ancestory: NodeIdMapUtils.expectAncestry(nodeIdMapCollection, rootId),
        relativePosition,
        isNoopXorNode:
            root.kind === NodeIdMap.XorNodeKind.Context &&
            NodeIdMapUtils.maybeRightMostLeaf(nodeIdMapCollection, rootId) === undefined,
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

interface AstNodeSearch {
    readonly maybeOnOrBeforePosition: Option<Ast.TNode>;
    readonly maybeAfterPosition: Option<Ast.TNode>;
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

function positionAstSearch(
    position: Position,
    astNodeById: NodeIdMap.AstNodeById,
    leafNodeIds: ReadonlyArray<number>,
): AstNodeSearch {
    let maybeCurrentOnOrBefore: Option<Ast.TNode>;
    let maybeCurrentAfter: Option<Ast.TNode>;

    for (const nodeId of leafNodeIds) {
        const candidate: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);
        // Is position to the right of the candidate?
        // 'x|' should NOT have position as after the candidate.
        if (isAfterTokenPosition(position, candidate.tokenRange.positionEnd, true)) {
            if (maybeCurrentOnOrBefore === undefined) {
                maybeCurrentOnOrBefore = candidate;
            } else {
                if (candidate.tokenRange.tokenIndexStart > maybeCurrentOnOrBefore.tokenRange.tokenIndexStart) {
                    maybeCurrentOnOrBefore = candidate;
                }
            }
        }
        // Position is after the candidate
        else {
            if (maybeCurrentAfter === undefined) {
                maybeCurrentAfter = candidate;
            } else {
                if (candidate.tokenRange.tokenIndexStart < maybeCurrentAfter.tokenRange.tokenIndexStart) {
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
    maybeOnOrBeforePositionAst: Option<Ast.TNode>,
    nodeIdMapCollection: NodeIdMap.Collection,
): Option<ParserContext.Node> {
    if (maybeOnOrBeforePositionAst === undefined) {
        return undefined;
    }
    const onOrBeforePositionAst: Ast.TNode = maybeOnOrBeforePositionAst;

    let maybeCurrent: Option<ParserContext.Node> = undefined;
    for (const candidate of nodeIdMapCollection.contextNodeById.values()) {
        if (
            candidate.maybeTokenStart &&
            candidate.maybeTokenStart.positionStart.codeUnit === onOrBeforePositionAst.tokenRange.positionStart.codeUnit
        ) {
            if (maybeCurrent === undefined || maybeCurrent.id < candidate.id) {
                maybeCurrent = candidate;
            }
        }
    }

    return maybeCurrent;
}
