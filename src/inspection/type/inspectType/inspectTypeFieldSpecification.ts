// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXorNode } from "./common";

export function inspectTypeFieldSpecification(state: InspectTypeState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FieldSpecification);

    const maybeFieldTypeSpecification: TXorNode | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        2,
        undefined,
    );

    return maybeFieldTypeSpecification !== undefined
        ? inspectXorNode(state, maybeFieldTypeSpecification)
        : Type.AnyInstance;
}
