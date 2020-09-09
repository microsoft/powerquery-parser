// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant } from "../../language";
import { NodeIdMap, NodeIdMapUtils, TXorNode, XorNodeKind } from "../../parser";
import { ActiveNode } from "../activeNode";
import { PositionUtils } from "../position";

export function autocompletePrimitiveType(
    nodeIdMapCollection: NodeIdMap.Collection,
    activeNode: ActiveNode,
): ReadonlyArray<Constant.PrimitiveTypeConstantKind> {
    if (activeNode.ancestry.length === 0) {
        return [];
    }

    const ancestors: ReadonlyArray<TXorNode> = activeNode.ancestry;

    const numAncestors: number = activeNode.ancestry.length;
    for (let index: number = 0; index < numAncestors; index += 1) {
        const parent: TXorNode = ancestors[index];
        const maybeChild: TXorNode | undefined = ancestors[index - 1];
        // `type |`
        if (parent.node.kind === Ast.NodeKind.TypePrimaryType) {
            if (maybeChild === undefined) {
                return Constant.PrimitiveTypeConstantKinds;
            } else if (
                maybeChild.node.maybeAttributeIndex === 0 &&
                maybeChild.kind === XorNodeKind.Ast &&
                PositionUtils.isAfterAst(activeNode.position, maybeChild.node as Ast.TNode, false)
            ) {
                return Constant.PrimitiveTypeConstantKinds;
            }
        }

        // if (maybeChild !== undefined && maybeChild.node.maybeAttributeIndex === 2) {
        //     return Constant.PrimitiveTypeConstantKinds;
        // } else {
        //     const firstChild: TXorNode = NodeIdMapUtils.assertGetChildXorByAttributeIndex(
        //         nodeIdMapCollection,
        //         parent.node.id,
        //         0,
        //         undefined,
        //     );
        //     if (PositionUtils.isAfterXor(nodeIdMapCollection, activeNode.position, firstChild, true)) {
        //         return Constant.PrimitiveTypeConstantKinds;
        //     }
        // }
    }

    return [];
}

const AllowedNodeKinds: ReadonlyArray<Ast.NodeKind> = [
    Ast.NodeKind.AsNullablePrimitiveType,
    Ast.NodeKind.TypePrimaryType,
];
