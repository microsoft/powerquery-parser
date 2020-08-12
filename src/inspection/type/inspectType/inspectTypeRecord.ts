// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Type } from "../../../language";
import { NodeIdMapIterator, TXorNode, XorNodeUtils } from "../../../parser";
import { inspectXorNode, TypeInspectionState } from "./common";

export function inspectTypeRecord(state: TypeInspectionState, xorNode: TXorNode): Type.DefinedRecord {
    XorNodeUtils.assertAnyAstNodeKind(xorNode, [Ast.NodeKind.RecordExpression, Ast.NodeKind.RecordLiteral]);

    const fields: Map<string, Type.TType> = new Map();
    for (const keyValuePair of NodeIdMapIterator.recordKeyValuePairs(state.nodeIdMapCollection, xorNode)) {
        if (keyValuePair.maybeValue) {
            fields.set(keyValuePair.keyLiteral, inspectXorNode(state, keyValuePair.maybeValue));
        } else {
            fields.set(keyValuePair.keyLiteral, Type.UnknownInstance);
        }
    }

    return {
        kind: Type.TypeKind.Record,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedRecord,
        isNullable: false,
        fields,
        isOpen: false,
    };
}
