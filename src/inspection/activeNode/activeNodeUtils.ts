// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option } from "../../common";
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

    let maybeRoot: Option<NodeIdMap.TXorNode>;
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
                    maybeRoot = NodeIdMapUtils.xorNodeFromAst(astSearch.maybeAfterPosition);
                } else if (maybeContextSearch) {
                    maybeRoot = NodeIdMapUtils.xorNodeFromContext(maybeContextSearch);
                } else {
                    maybeRoot = undefined;
                }
            } else {
                maybeRoot = NodeIdMapUtils.xorNodeFromAst(constant);
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
            maybeRoot = NodeIdMapUtils.xorNodeFromAst(astNode);
        } else {
            maybeRoot =
                maybeContextSearch !== undefined
                    ? NodeIdMapUtils.xorNodeFromContext(maybeContextSearch)
                    : NodeIdMapUtils.xorNodeFromAst(astNode);
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

    return {
        position,
        root,
        ancestry: NodeIdMapUtils.expectAncestry(nodeIdMapCollection, root.node.id),
    };
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
//  the Ast node which is located <= the given position
//  AND the Ast node which is located >= the given position
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
