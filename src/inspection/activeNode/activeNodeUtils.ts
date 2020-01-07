// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Option } from "../../common";
import { Ast, NodeIdMap, NodeIdMapUtils, ParserContext } from "../../parser";
import { Position, PositionUtils } from "../position";
import { ActiveNode, RelativePosition } from "./activeNode";

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
                PositionUtils.isAfterTokenPosition(position, constant.tokenRange.positionEnd, false)
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
    if (PositionUtils.isBeforeXorNode(position, maybeRoot) || PositionUtils.isOnXorNodeStart(position, maybeRoot)) {
        relativePosition = RelativePosition.Left;
    } else if (PositionUtils.isAfterXorNode(position, nodeIdMapCollection, root)) {
        relativePosition = RelativePosition.Right;
    } else {
        relativePosition = RelativePosition.Under;
    }

    return {
        position,
        root,
        ancestry: NodeIdMapUtils.expectAncestry(nodeIdMapCollection, rootId),
        relativePosition,
        isNoopXorNode:
            root.kind === NodeIdMap.XorNodeKind.Context &&
            NodeIdMapUtils.maybeRightMostLeaf(nodeIdMapCollection, rootId) === undefined,
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
        // 'foo|'
        // 'fo|o'
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
