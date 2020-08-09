// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMapIterator, TXorNode } from "../../../parser";
import { Type } from "../../../type";
import { inspectXorNode, TypeInspectionState } from "./common";

export function inspectList(state: TypeInspectionState, xorNode: TXorNode): Type.DefinedList {
    const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.listItems(state.nodeIdMapCollection, xorNode);
    const elements: ReadonlyArray<Type.TType> = items.map((item: TXorNode) => inspectXorNode(state, item));

    return {
        kind: Type.TypeKind.List,
        isNullable: false,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        elements,
    };
}
