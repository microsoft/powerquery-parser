// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, Option } from "../../common";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../../parser";
import { Position, PositionUtils } from "../position";
import { ActiveNode } from "./activeNode";

// Read ActiveNode's comments before this.
//
// Searches all leaf Ast.TNodes and Context nodes to find the "active" node.
// ' 1 + ' -> the second operand, a Context node, in an ArithmeticExpression.
// 'let x=|1 in x' -> the value part of the key-value-pair.
// 'foo(|)' -> the zero length ArrayWrapper of an InvokeExpression
//
// First, When the position is on a constant the selected Ast.TNode might have to be shifted one to the right.
// This happens with atomic constants such as '+', '=>', '[', '(' etc.
// However if you shifted right on '(' for 'foo(|)' then the ActiveNode would be ')' instead of the ArrayWrapper.
//
// Second, parser errors also need to be taken care of.
// '1+|' is an error and the latest leaf is '+',
// but the ActiveNode should be the second operand in the ArithmeticExpression.
//
// Third, sometimes we don't want to shift at all.
// Nodes that prevent shifting are called anchor nodes.
// 'if x t|' shouldn't shift to the Constant for 'then', instead the ActiveNode should select 't'.
// 'let x = 1|' shouldn't shift to the Constant for 'in', instead the ActiveNode should select '1'.
export function maybeActiveNode(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): Option<ActiveNode> {
    const astSearch: AstNodeSearch = positionAstSearch(position, nodeIdMapCollection, leafNodeIds);
    const maybeContextSearch: Option<ParserContext.Node> = positionContextSearch(
        astSearch.maybeNode,
        nodeIdMapCollection,
    );

    let maybeLeaf: Option<NodeIdMap.TXorNode>;
    if (astSearch.isOnShiftConstant) {
        if (astSearch.maybeNode !== undefined) {
            maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeNode);
        } else if (maybeContextSearch !== undefined) {
            maybeLeaf = NodeIdMapUtils.xorNodeFromContext(maybeContextSearch);
        } else {
            maybeLeaf = undefined;
        }
    } else {
        if (astSearch.maybeNode !== undefined && isAnchorNode(position, astSearch.maybeNode)) {
            maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeNode);
        } else if (maybeContextSearch !== undefined) {
            maybeLeaf = NodeIdMapUtils.xorNodeFromContext(maybeContextSearch);
        } else if (astSearch.maybeNode !== undefined) {
            maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeNode);
        } else {
            maybeLeaf = undefined;
        }
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

    if (maybeAllowedNodeKinds !== undefined) {
        const details: {} = {
            fnName: expectPreviousXorNode.name,
            nodeId: xorNode.node.id,
            expectedAny: maybeAllowedNodeKinds,
            actual: xorNode.node.kind,
        };
        const maybeErr: Option<CommonError.InvariantError> = Ast.testAnyNodeKind(
            xorNode.node.kind,
            maybeAllowedNodeKinds,
            details,
        );
        if (maybeErr) {
            throw maybeErr;
        }
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

    if (maybeAllowedNodeKinds !== undefined) {
        const details: {} = {
            fnName: expectNextXorNode.name,
            nodeId: xorNode.node.id,
            expectedAny: maybeAllowedNodeKinds,
            actual: xorNode.node.kind,
        };
        const maybeErr: Option<CommonError.InvariantError> = Ast.testAnyNodeKind(
            xorNode.node.kind,
            maybeAllowedNodeKinds,
            details,
        );
        if (maybeErr) {
            throw maybeErr;
        }
    }

    return maybeXorNode;
}

interface AstNodeSearch {
    readonly maybeNode: Option<Ast.TNode>;
    readonly isOnShiftConstant: boolean;
}

const DrilldownConstantKind: ReadonlyArray<string> = [
    Ast.ConstantKind.LeftBrace,
    Ast.ConstantKind.LeftBracket,
    Ast.ConstantKind.LeftParenthesis,
];

const ShiftRightConstantKinds: ReadonlyArray<string> = [
    Ast.ConstantKind.Comma,
    Ast.ConstantKind.Equal,
    Ast.ConstantKind.FatArrow,
    Ast.ConstantKind.RightBrace,
    Ast.ConstantKind.RightBracket,
    Ast.ConstantKind.RightParenthesis,
    ...DrilldownConstantKind,
];

function isAnchorNode(position: Position, astNode: Ast.TNode): boolean {
    return (
        PositionUtils.isOnAstNodeEnd(position, astNode) &&
        (astNode.kind === Ast.NodeKind.Identifier ||
            astNode.kind === Ast.NodeKind.IdentifierExpression ||
            (astNode.kind === Ast.NodeKind.LiteralExpression && astNode.literalKind === Ast.LiteralKind.Numeric))
    );
}

function positionAstSearch(
    position: Position,
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
): AstNodeSearch {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let maybeCurrentOnOrBefore: Option<Ast.TNode>;
    let maybeCurrentAfter: Option<Ast.TNode>;
    let isOnShiftConstant: boolean;

    // Find:
    //  the closest leaf to the left or on position.
    //  the closest leaf to the right of position.
    for (const nodeId of leafNodeIds) {
        const candidate: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);
        // Check if on or before position.
        if (PositionUtils.isAfterTokenPosition(position, candidate.tokenRange.positionStart, false)) {
            if (maybeCurrentOnOrBefore === undefined) {
                maybeCurrentOnOrBefore = candidate;
            } else {
                if (candidate.tokenRange.tokenIndexStart > maybeCurrentOnOrBefore.tokenRange.tokenIndexStart) {
                    maybeCurrentOnOrBefore = candidate;
                }
            }
        }
        // Check if after position.
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

    // Might need to shift.
    if (maybeCurrentOnOrBefore !== undefined && maybeCurrentOnOrBefore.kind === Ast.NodeKind.Constant) {
        const currentOnOrBefore: Ast.Constant = maybeCurrentOnOrBefore;

        // Requires a shift into an empty ArrayWrapper.
        if (
            DrilldownConstantKind.indexOf(maybeCurrentOnOrBefore.literal) !== -1 &&
            maybeCurrentAfter !== undefined &&
            maybeCurrentAfter.kind === Ast.NodeKind.Constant &&
            Ast.isPairedConstant(
                maybeCurrentOnOrBefore.literal as Ast.ConstantKind,
                maybeCurrentAfter.literal as Ast.ConstantKind,
            )
        ) {
            const parent: Ast.TNode = NodeIdMapUtils.expectParentAstNode(nodeIdMapCollection, currentOnOrBefore.id, [
                Ast.NodeKind.RecordExpression,
                Ast.NodeKind.RecordLiteral,
                Ast.NodeKind.ListExpression,
                Ast.NodeKind.ListLiteral,
                Ast.NodeKind.InvokeExpression,
            ]);
            const arrayWrapper: Ast.TNode = NodeIdMapUtils.expectAstChildByAttributeIndex(
                nodeIdMapCollection,
                parent.id,
                1,
                [Ast.NodeKind.ArrayWrapper],
            );
            maybeCurrentOnOrBefore = arrayWrapper;
            isOnShiftConstant = true;
        }
        // Requires a shift to the right.
        else if (ShiftRightConstantKinds.indexOf(currentOnOrBefore.literal) !== -1) {
            maybeCurrentOnOrBefore = maybeCurrentAfter;
            isOnShiftConstant = true;
        }
        // No shifting.
        else {
            isOnShiftConstant = false;
        }
    } else {
        isOnShiftConstant = false;
    }

    return {
        maybeNode: maybeCurrentOnOrBefore,
        isOnShiftConstant,
    };
}

function positionContextSearch(
    _maybeOnOrBeforePositionAst: Option<Ast.TNode>,
    nodeIdMapCollection: NodeIdMap.Collection,
): Option<ParserContext.Node> {
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
