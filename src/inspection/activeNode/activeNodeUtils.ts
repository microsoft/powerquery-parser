// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option } from "../../common";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../../parser";
import { Position, PositionUtils } from "../position";
import { ActiveNode } from "./activeNode";

// Read ActiveNode's comments before this.
//
// The naive approach is to grab the closest Ast node to the left of your position.
//
// The first edge case is because some nodes should shift which ActiveNode is selected one to the right.
//  'let x =|' -> The ActiveNode should be the assignment.
//
// The second edge case is because often there are parser errors.
//  'if true t|' -> The parser errors out in a Context for a Constant ('then').
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

    let maybeLeaf: Option<NodeIdMap.TXorNode>;
    if (astSearch.maybeOnOrBeforePosition) {
        const astNode: Ast.TNode = astSearch.maybeOnOrBeforePosition;

        if (astNode.kind === Ast.NodeKind.Constant) {
            const constant: Ast.Constant = astNode;

            // Shift the ActiveNode to the right.
            if (
                ShiftRightConstantKinds.indexOf(constant.literal) !== -1 ||
                PositionUtils.isAfterTokenPosition(position, constant.tokenRange.positionEnd, false)
            ) {
                if (astSearch.maybeAfterPosition) {
                    maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeAfterPosition);
                } else if (maybeContextSearch) {
                    maybeLeaf = NodeIdMapUtils.xorNodeFromContext(maybeContextSearch);
                } else {
                    maybeLeaf = undefined;
                }
            } else {
                maybeLeaf = NodeIdMapUtils.xorNodeFromAst(constant);
            }
        }
        // While typing certain types of literals we want to stay on the literal instead of moving to a Context.
        //  'let foo| ='
        //  '1 + 23|'
        else if (
            PositionUtils.isOnAstNodeEnd(position, astNode) &&
            (astNode.kind === Ast.NodeKind.Identifier ||
                astNode.kind === Ast.NodeKind.IdentifierExpression ||
                (astNode.kind === Ast.NodeKind.LiteralExpression && astNode.literalKind === Ast.LiteralKind.Numeric))
        ) {
            maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astNode);
        } else {
            maybeLeaf =
                maybeContextSearch !== undefined
                    ? NodeIdMapUtils.xorNodeFromContext(maybeContextSearch)
                    : NodeIdMapUtils.xorNodeFromAst(astNode);
        }
    } else if (maybeContextSearch) {
        maybeLeaf = NodeIdMapUtils.xorNodeFromContext(maybeContextSearch);
    } else {
        maybeLeaf = undefined;
    }

    if (maybeLeaf === undefined) {
        return undefined;
    }
    const leaf: NodeIdMap.TXorNode = maybeLeaf;

    return {
        position,
        ancestry: NodeIdMapUtils.expectAncestry(nodeIdMapCollection, leaf.node.id),
        maybeIdentifierUnderPosition: maybeIdentifierUnderPosition(position, nodeIdMapCollection, leaf),
    };
}

export function expectRoot(activeNode: ActiveNode): NodeIdMap.TXorNode {
    const ancestry: ReadonlyArray<NodeIdMap.TXorNode> = activeNode.ancestry;
    return ancestry[ancestry.length - 1];
}

export function expectLeaf(activeNode: ActiveNode): NodeIdMap.TXorNode {
    return activeNode.ancestry[0];
}

export function maybePreviousXorNode(
    activeNode: ActiveNode,
    ancestorIndex: number,
    n: number = 1,
    maybeNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): Option<NodeIdMap.TXorNode> {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = activeNode.ancestry[ancestorIndex - n];
    if (maybeXorNode !== undefined && maybeNodeKinds !== undefined) {
        return maybeNodeKinds.indexOf(maybeXorNode.node.kind) !== -1 ? maybeXorNode : undefined;
    } else {
        return maybeXorNode;
    }
}

export function maybeNextXorNode(
    activeNode: ActiveNode,
    ancestorIndex: number,
    n: number = 1,
): Option<NodeIdMap.TXorNode> {
    return activeNode.ancestry[ancestorIndex + n];
}

export function expectPreviousXorNode(
    activeNode: ActiveNode,
    ancestorIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): NodeIdMap.TXorNode {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = maybePreviousXorNode(activeNode, ancestorIndex, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError("no previous node");
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    if (maybeAllowedNodeKinds !== undefined && maybeAllowedNodeKinds.indexOf(xorNode.node.kind) === -1) {
        const details: {} = {
            nodeId: xorNode.node.id,
            expectedAny: maybeAllowedNodeKinds,
            actual: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(`incorrect node kind for previous xorNode`, details);
    }

    return maybeXorNode;
}

export function expectNextXorNode(
    activeNode: ActiveNode,
    ancestorIndex: number,
    n: number = 1,
    maybeAllowedNodeKinds: Option<ReadonlyArray<Ast.NodeKind>> = undefined,
): NodeIdMap.TXorNode {
    const maybeXorNode: Option<NodeIdMap.TXorNode> = maybeNextXorNode(activeNode, ancestorIndex, n);
    if (maybeXorNode === undefined) {
        throw new CommonError.InvariantError("no next node");
    }
    const xorNode: NodeIdMap.TXorNode = maybeXorNode;

    if (maybeAllowedNodeKinds !== undefined && maybeAllowedNodeKinds.indexOf(xorNode.node.kind) === -1) {
        const details: {} = {
            nodeId: xorNode.node.id,
            expectedAny: maybeAllowedNodeKinds,
            actual: xorNode.node.kind,
        };
        throw new CommonError.InvariantError(`incorrect node kind for attribute`, details);
    }

    return maybeXorNode;
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

// Search for:
//  * the Ast node which is located <= the given position
//  * AND the Ast node which is located >= the given position
//
// We need both because some nodes shift the selected ActiveNode one to the right.
//  'let x=|1 in foo'
function positionAstSearch(
    position: Position,
    astNodeById: NodeIdMap.AstNodeById,
    leafNodeIds: ReadonlyArray<number>,
): AstNodeSearch {
    let maybeCurrentOnOrBefore: Option<Ast.TNode>;
    let maybeCurrentAfter: Option<Ast.TNode>;

    for (const nodeId of leafNodeIds) {
        const candidate: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);
        if (PositionUtils.isAfterTokenPosition(position, candidate.tokenRange.positionStart, false)) {
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

    let maybeCurrent: Option<ParserContext.Node> = undefined;
    for (const candidate of nodeIdMapCollection.contextNodeById.values()) {
        if (candidate.maybeTokenStart) {
            if (maybeCurrent === undefined || maybeCurrent.id < candidate.id) {
                maybeCurrent = candidate;
            }
        }
    }

    return maybeCurrent;
}

function maybeIdentifierUnderPosition(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leaf: NodeIdMap.TXorNode,
): Option<Ast.Identifier | Ast.GeneralizedIdentifier> {
    if (leaf.kind !== NodeIdMap.XorNodeKind.Ast) {
        return undefined;
    }

    let identifier: Ast.Identifier | Ast.GeneralizedIdentifier;

    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    if (leaf.node.kind === Ast.NodeKind.Constant && leaf.node.literal === `@`) {
        const maybeParentId: Option<number> = nodeIdMapCollection.parentIdById.get(leaf.node.id);
        if (maybeParentId === undefined) {
            return undefined;
        }
        const parentId: number = maybeParentId;

        const parent: Ast.TNode = NodeIdMapUtils.expectAstNode(nodeIdMapCollection.astNodeById, parentId);
        if (parent.kind !== Ast.NodeKind.IdentifierExpression) {
            return undefined;
        }
        identifier = parent.identifier;
    } else if (leaf.node.kind === Ast.NodeKind.Identifier || leaf.node.kind === Ast.NodeKind.GeneralizedIdentifier) {
        identifier = leaf.node;
    } else {
        return undefined;
    }

    if (PositionUtils.isInAstNode(position, identifier, false)) {
        return identifier;
    } else {
        return undefined;
    }
}
