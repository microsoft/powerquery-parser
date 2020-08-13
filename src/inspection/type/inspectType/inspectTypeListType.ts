// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXorNode } from "./common";

export function inspectTypeListType(state: InspectTypeState, xorNode: TXorNode): Type.ListType | Type.Unknown {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.ListType);

    const maybeListItem: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeListItem === undefined) {
        return Type.UnknownInstance;
    }
    const itemType: Type.TType = inspectXorNode(state, maybeListItem);

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.ListType,
        isNullable: false,
        itemType,
    };
}
