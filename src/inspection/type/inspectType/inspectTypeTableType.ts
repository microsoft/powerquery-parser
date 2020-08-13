// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState, inspectXorNode } from "./common";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";

export function inspectTypeTableType(
    state: InspectTypeState,
    xorNode: TXorNode,
): Type.TableType | Type.TableTypePrimaryExpression | Type.Unknown {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.TableType);

    const maybeRowType: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        1,
        undefined,
    );
    if (maybeRowType === undefined) {
        return Type.UnknownInstance;
    }

    if (maybeRowType.node.kind === Ast.NodeKind.FieldSpecificationList) {
        return {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.TableType,
            isNullable: false,
            ...examineFieldSpecificationList(state, maybeRowType),
        };
    } else {
        return {
            kind: Type.TypeKind.Type,
            maybeExtendedKind: Type.ExtendedTypeKind.TableTypePrimaryExpression,
            isNullable: false,
            primaryExpression: inspectXorNode(state, maybeRowType),
        };
    }
}
