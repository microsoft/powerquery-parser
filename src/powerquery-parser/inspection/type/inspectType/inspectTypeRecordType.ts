// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { InspectTypeState } from "./common";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";

export function inspectTypeRecordType(state: InspectTypeState, xorNode: TXorNode): Type.RecordType | Type.Unknown {
    state.settings.maybeCancellationToken?.throwIfCancelled();
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.RecordType);

    const maybeFields: TXorNode | undefined = NodeIdMapUtils.maybeChildXorByAttributeIndex(
        state.nodeIdMapCollection,
        xorNode.node.id,
        0,
        [Ast.NodeKind.FieldSpecificationList],
    );
    if (maybeFields === undefined) {
        return Type.UnknownInstance;
    }

    return {
        kind: Type.TypeKind.Type,
        maybeExtendedKind: Type.ExtendedTypeKind.RecordType,
        isNullable: false,
        ...examineFieldSpecificationList(state, maybeFields),
    };
}
