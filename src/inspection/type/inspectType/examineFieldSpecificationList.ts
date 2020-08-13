// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { NodeIdMap, NodeIdMapIterator, NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState } from "./common";
import { inspectTypeFieldSpecification } from "./inspectTypeFieldSpecification";

export interface ExaminedFieldSpecificationList {
    readonly fields: Map<string, Type.TType>;
    readonly isOpen: boolean;
}

// It's called an examination instead of inspection because it doesn't return TType.
export function examineFieldSpecificationList(
    state: InspectTypeState,
    xorNode: TXorNode,
): ExaminedFieldSpecificationList {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FieldSpecificationList);

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    const fields: [string, Type.TType][] = [];

    for (const fieldSpecification of NodeIdMapIterator.fieldSpecificationListCsvXorNodes(
        nodeIdMapCollection,
        xorNode,
    )) {
        const maybeName: Ast.TNode | undefined = NodeIdMapUtils.maybeAstChildByAttributeIndex(
            nodeIdMapCollection,
            fieldSpecification.node.id,
            1,
            [Ast.NodeKind.GeneralizedIdentifier],
        );

        if (maybeName === undefined) {
            break;
        }
        const name: string = (maybeName as Ast.GeneralizedIdentifier).literal;
        const type: Type.TType = inspectTypeFieldSpecification(state, fieldSpecification);
        fields.push([name, type]);
    }

    const isOpen: boolean =
        NodeIdMapUtils.maybeAstChildByAttributeIndex(nodeIdMapCollection, xorNode.node.id, 3, [
            Ast.NodeKind.Constant,
        ]) !== undefined;

    return {
        fields: new Map(fields),
        isOpen,
    };
}
