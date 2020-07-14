// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils } from "../../language";
import { AncestryUtils, NodeIdMap, NodeIdMapUtils, ParseContext, TXorNode, XorNodeKind } from "../../parser";
import { Position, PositionUtils } from "../position";
import { ActiveNode, ActiveNodeLeafKind } from "./activeNode";

// Searches all leaf Ast.TNodes and all Context nodes to find the "active" node.
// ' 1 + |' -> the second operand, a Context node, in an ArithmeticExpression.
// 'let x=|1 in x' -> the value part of the key-value-pair.
// 'foo(|)' -> the zero length ArrayWrapper of an InvokeExpression
//
// The naive approach is to find the closest Ast or Context node either to the left of or ends on the cursor.
// This approach breaks under several edge cases.
//
// Take a look at the ArithmeticExpression example above,
// it doesn't make sense for the ActiveNode to be the '+' constant.
// When the position is on a constant the selected Ast.TNode might need to be shifted one to the right.
// This happens with atomic constants such as '+', '=>', '[', '(' etc.
// However if you shifted right on '(' for 'foo(|)' then the ActiveNode would be ')' instead of the ArrayWrapper.
//
// Sometimes we don't want to shift at all.
// Nodes that prevent shifting are called anchor nodes.
export function maybeActiveNode(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): ActiveNode | undefined {
    const astSearch: AstNodeSearch = astNodeSearch(nodeIdMapCollection, leafNodeIds, position);
    const maybeContextNode: ParseContext.Node | undefined = contextNodeSearch(nodeIdMapCollection, astSearch);

    let maybeLeaf: TXorNode | undefined;
    let leafKind: ActiveNodeLeafKind;
    if (astSearch.maybeShiftedRightNode !== undefined) {
        maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeShiftedRightNode);
        leafKind = ActiveNodeLeafKind.ShiftedRight;
    } else if (astSearch.maybeNode !== undefined && isAnchorNode(position, astSearch.maybeNode)) {
        maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeNode);
        leafKind = ActiveNodeLeafKind.Anchored;
    } else if (maybeContextNode !== undefined) {
        maybeLeaf = NodeIdMapUtils.xorNodeFromContext(maybeContextNode);
        leafKind = ActiveNodeLeafKind.Context;
    } else if (astSearch.maybeNode !== undefined) {
        maybeLeaf = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeNode);
        leafKind = PositionUtils.isAfterAstNode(position, astSearch.maybeNode, false)
            ? ActiveNodeLeafKind.AfterAst
            : ActiveNodeLeafKind.OnAst;
    } else {
        return undefined;
    }

    const leaf: TXorNode = maybeLeaf;

    return {
        leafKind,
        position,
        ancestry: AncestryUtils.expectAncestry(nodeIdMapCollection, leaf.node.id),
        maybeIdentifierUnderPosition: maybeIdentifierUnderPosition(nodeIdMapCollection, position, leaf),
    };
}

interface AstNodeSearch {
    readonly maybeNode: Ast.TNode | undefined;
    readonly maybeShiftedRightNode: Ast.TNode | undefined;
}

const DrilldownConstantKind: ReadonlyArray<string> = [
    Ast.WrapperConstantKind.LeftBrace,
    Ast.WrapperConstantKind.LeftBracket,
    Ast.WrapperConstantKind.LeftParenthesis,
];

const ShiftRightConstantKinds: ReadonlyArray<string> = [
    Ast.MiscConstantKind.Comma,
    Ast.MiscConstantKind.Equal,
    Ast.MiscConstantKind.FatArrow,
    Ast.WrapperConstantKind.RightBrace,
    Ast.WrapperConstantKind.RightBracket,
    Ast.WrapperConstantKind.RightParenthesis,
    Ast.MiscConstantKind.Semicolon,
    ...DrilldownConstantKind,
];

function isAnchorNode(position: Position, astNode: Ast.TNode): boolean {
    if (!PositionUtils.isInAstNode(position, astNode, true, true)) {
        return false;
    }

    if (astNode.kind === Ast.NodeKind.Identifier || astNode.kind === Ast.NodeKind.GeneralizedIdentifier) {
        return true;
    } else if (astNode.kind === Ast.NodeKind.LiteralExpression && astNode.literalKind === Ast.LiteralKind.Numeric) {
        return true;
    } else if (astNode.kind === Ast.NodeKind.Constant) {
        switch (astNode.constantKind) {
            case Ast.KeywordConstantKind.As:
            case Ast.KeywordConstantKind.Each:
            case Ast.KeywordConstantKind.Else:
            case Ast.KeywordConstantKind.Error:
            case Ast.KeywordConstantKind.If:
            case Ast.KeywordConstantKind.In:
            case Ast.KeywordConstantKind.Is:
            case Ast.KeywordConstantKind.Section:
            case Ast.KeywordConstantKind.Shared:
            case Ast.KeywordConstantKind.Let:
            case Ast.KeywordConstantKind.Meta:
            case Ast.KeywordConstantKind.Otherwise:
            case Ast.KeywordConstantKind.Then:
            case Ast.KeywordConstantKind.Try:
            case Ast.KeywordConstantKind.Type:

            case Ast.PrimitiveTypeConstantKind.Null:
                return true;

            default:
                return false;
        }
    } else {
        return false;
    }
}

function astNodeSearch(
    nodeIdMapCollection: NodeIdMap.Collection,
    leafNodeIds: ReadonlyArray<number>,
    position: Position,
): AstNodeSearch {
    const astNodeById: NodeIdMap.AstNodeById = nodeIdMapCollection.astNodeById;
    let maybeBestOnOrBefore: Ast.TNode | undefined;
    let maybeBestAfter: Ast.TNode | undefined;
    let maybeShiftedNode: Ast.TNode | undefined;

    // Find:
    //  the closest leaf to the left or on position.
    //  the closest leaf to the right of position.
    for (const nodeId of leafNodeIds) {
        const candidate: Ast.TNode = NodeIdMapUtils.expectAstNode(astNodeById, nodeId);

        let isBoundIncluded: boolean;
        if (
            // let x|=1
            (candidate.kind === Ast.NodeKind.Constant &&
                ShiftRightConstantKinds.indexOf(candidate.constantKind) !== -1) ||
            // let x=|1
            (maybeBestOnOrBefore !== undefined &&
                maybeBestOnOrBefore.kind === Ast.NodeKind.Constant &&
                ShiftRightConstantKinds.indexOf(maybeBestOnOrBefore.constantKind) !== -1)
        ) {
            isBoundIncluded = false;
        } else {
            isBoundIncluded = true;
        }

        if (!PositionUtils.isBeforeTokenPosition(position, candidate.tokenRange.positionStart, isBoundIncluded)) {
            if (
                maybeBestOnOrBefore === undefined ||
                candidate.tokenRange.tokenIndexStart > maybeBestOnOrBefore.tokenRange.tokenIndexStart
            ) {
                maybeBestOnOrBefore = candidate;
            }
        }
        // Check if after position.
        else {
            if (
                maybeBestAfter === undefined ||
                candidate.tokenRange.tokenIndexStart < maybeBestAfter.tokenRange.tokenIndexStart
            ) {
                maybeBestAfter = candidate;
            }
        }
    }

    // Might need to shift.
    if (maybeBestOnOrBefore !== undefined && maybeBestOnOrBefore.kind === Ast.NodeKind.Constant) {
        const currentOnOrBefore: Ast.TConstant = maybeBestOnOrBefore;

        // Requires a shift into an empty ArrayWrapper.
        if (
            DrilldownConstantKind.indexOf(maybeBestOnOrBefore.constantKind) !== -1 &&
            maybeBestAfter !== undefined &&
            maybeBestAfter.kind === Ast.NodeKind.Constant &&
            AstUtils.isPairedWrapperConstantKinds(maybeBestOnOrBefore.constantKind, maybeBestAfter.constantKind)
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
            maybeShiftedNode = arrayWrapper;
        }
        // Requires a shift to the right.
        else if (ShiftRightConstantKinds.indexOf(currentOnOrBefore.constantKind) !== -1) {
            maybeShiftedNode = maybeBestAfter;
        }
        // No shifting.
        else {
            maybeShiftedNode = undefined;
        }
    } else {
        maybeShiftedNode = undefined;
    }

    return {
        maybeNode: maybeBestOnOrBefore,
        maybeShiftedRightNode: maybeShiftedNode,
    };
}

function contextNodeSearch(
    nodeIdMapCollection: NodeIdMap.Collection,
    astNodeSearch: AstNodeSearch,
): ParseContext.Node | undefined {
    if (astNodeSearch.maybeNode === undefined) {
        return undefined;
    }
    const tokenIndexLowBound: number = astNodeSearch.maybeNode.tokenRange.tokenIndexStart;

    let maybeCurrent: ParseContext.Node | undefined = undefined;
    for (const candidate of nodeIdMapCollection.contextNodeById.values()) {
        if (candidate.maybeTokenStart) {
            if (candidate.tokenIndexStart < tokenIndexLowBound) {
                continue;
            }

            if (maybeCurrent === undefined || maybeCurrent.id < candidate.id) {
                maybeCurrent = candidate;
            }
        }
    }

    return maybeCurrent;
}

function maybeIdentifierUnderPosition(
    nodeIdMapCollection: NodeIdMap.Collection,
    position: Position,
    leaf: TXorNode,
): Ast.Identifier | Ast.GeneralizedIdentifier | undefined {
    if (leaf.kind !== XorNodeKind.Ast) {
        return undefined;
    }

    let identifier: Ast.Identifier | Ast.GeneralizedIdentifier;

    // If closestLeaf is '@', then check if it's part of an IdentifierExpression.
    if (leaf.node.kind === Ast.NodeKind.Constant && leaf.node.constantKind === Ast.MiscConstantKind.AtSign) {
        const maybeParentId: number | undefined = nodeIdMapCollection.parentIdById.get(leaf.node.id);
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

    if (PositionUtils.isInAstNode(position, identifier, false, true)) {
        return identifier;
    } else {
        return undefined;
    }
}
