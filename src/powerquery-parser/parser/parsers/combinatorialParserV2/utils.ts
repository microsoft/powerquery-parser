// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { MapUtils, SetUtils } from "../../../common";
import { Ast } from "../../../language";
import { IdsByNodeKind } from "../../nodeIdMap/nodeIdMap";

export function removeIdFromIdsByNodeKind(idsByNodeKind: IdsByNodeKind, nodeKind: Ast.NodeKind, nodeId: number): void {
    const collection: Set<number> = MapUtils.assertGet(idsByNodeKind, nodeKind);
    SetUtils.assertDelete(collection, nodeId);

    if (collection.size === 0) {
        idsByNodeKind.delete(nodeKind);
    }
}
