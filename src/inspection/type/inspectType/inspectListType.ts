// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type } from "../../../type";
import { TypeInspectionState } from "../type";
import { inspectXorNode } from "./common";

export function inspectListType(
    state: TypeInspectionState,
    xorNode: TXorNode,
): Type.DefinedType<Type.ListType> | Type.Unknown {
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
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
        isNullable: false,
        primaryType: {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.ListType,
            isNullable: false,
            itemType,
        },
    };
}
