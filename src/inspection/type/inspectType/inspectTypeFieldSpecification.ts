// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type } from "../../../type";
import { inspectXorNode, TypeInspectionState } from "./common";

export function inspectTypeFieldSpecification(state: TypeInspectionState, xorNode: TXorNode): Type.TType {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.FieldSpecification);

    const maybeFieldTypeSpecification: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        2,
        undefined,
    );

    return maybeFieldTypeSpecification !== undefined
        ? inspectXorNode(state, maybeFieldTypeSpecification)
        : Type.AnyInstance;
}
