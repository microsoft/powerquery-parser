// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "../../../language";
import { NodeIdMapUtils, TXorNode, XorNodeUtils } from "../../../parser";
import { Type } from "../../../type";
import { TypeInspectionState } from "../type";
import { examineFieldSpecificationList } from "./examineFieldSpecificationList";

export function inspectRecordType(
    state: TypeInspectionState,
    xorNode: TXorNode,
): Type.DefinedType<Type.DefinedRecord> | Type.Unknown {
    XorNodeUtils.assertAstNodeKind(xorNode, Ast.NodeKind.RecordType);

    const maybeFields: TXorNode | undefined = NodeIdMapUtils.maybeXorChildByAttributeIndex(
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
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedType,
        isNullable: false,
        primaryType: {
            kind: Type.TypeKind.Record,
            maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
            isNullable: false,
            ...examineFieldSpecificationList(state, maybeFields),
        },
    };
}
