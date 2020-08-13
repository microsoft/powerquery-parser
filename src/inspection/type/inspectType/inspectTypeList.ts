// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Type } from "../../../language/type";
import { NodeIdMapIterator, TXorNode } from "../../../parser";
import { InspectTypeState, inspectXorNode } from "./common";

export function inspectTypeList(state: InspectTypeState, xorNode: TXorNode): Type.DefinedList {
    const items: ReadonlyArray<TXorNode> = NodeIdMapIterator.listItems(state.nodeIdMapCollection, xorNode);
    const elements: ReadonlyArray<Type.TType> = items.map((item: TXorNode) => inspectXorNode(state, item));

    return {
        kind: Type.TypeKind.List,
        isNullable: false,
        maybeExtendedKind: Type.ExtendedTypeKind.DefinedList,
        elements,
    };
}
