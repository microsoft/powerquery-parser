// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap } from "../../../parser";
import { CommonSettings } from "../../../settings";
import { TypeCache } from "../tasks";

export function tryCheck(
    _settings: CommonSettings,
    _nodeIdMapCollection: NodeIdMap.Collection,
    _leafNodeIds: ReadonlyArray<number>,
    _nodeId: number,
    _maybeTypeCache: TypeCache | undefined = undefined,
): void {
    throw 1;
}
