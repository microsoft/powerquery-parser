// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant } from "../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind, AncestryUtils } from "../../parser";
import { ActiveNode } from "../activeNode";
import { PositionUtils } from "../position";

export function autocompletePrimitiveType(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
): ReadonlyArray<Constant.PrimitiveTypeConstantKind> {
    if (activeNode.ancestry.length === 0) {
        return [];
    }

    const ancestry: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const numAncestors: number = activeNode.ancestry.length;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const parent: TXorNode = ancestry[index];
        const maybeChild: TXorNode | undefined = ancestry[index - 1];
        // `type |`
        if (parent.node.kind === Ast.NodeKind.TypePrimaryType) {
            if (maybeChild === undefined) {
                return Constant.PrimitiveTypeConstantKinds;
            } else if (
                maybeChild.node.maybeAttributeIndex === 0 &&
                maybeChild.kind === XorNodeKind.Ast &&
                PositionUtils.isAfterAst(activeNode.position, maybeChild.node as Ast.TNode, true)
            ) {
                return Constant.PrimitiveTypeConstantKinds;
            }
        }
        // If parameter in a FunctionExpression
        else if (
            parent.node.kind === Ast.NodeKind.Parameter &&
            AncestryUtils.maybeNthNextXor(ancestry, index, 4, [Ast.NodeKind.FunctionExpression]) !== undefined
        ) {
            const maybeGrandchild: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
                ancestry,
                index,
                2,
                undefined,
            );
            if (maybeGrandchild === undefined) {
                continue;
            } else if (
                maybeGrandchild.kind === XorNodeKind.Ast &&
                maybeGrandchild.node.kind === Ast.NodeKind.Constant &&
                maybeGrandchild.node.constantKind === Constant.KeywordConstantKind.As &&
                PositionUtils.isAfterAst(activeNode.position, maybeGrandchild.node, true)
            ) {
                return Constant.PrimitiveTypeConstantKinds;
            } else if (maybeGrandchild.node.kind === Ast.NodeKind.NullablePrimitiveType) {
                const maybeGreatGrandchild: TXorNode | undefined = AncestryUtils.maybeNthPreviousXor(
                    ancestry,
                    index,
                    3,
                    undefined,
                );
                var x = 1;
            }
        }
    }

    return [];
}
