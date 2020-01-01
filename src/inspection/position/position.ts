import { NodeIdMap } from "../../parser";

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export interface Position {
    readonly lineNumber: number;
    readonly lineCodeUnit: number;
}

// An active node can be thought of as the node the user is expecting their autocomplete to show options for.
export interface ActiveXorNode {
    readonly xorNode: NodeIdMap.TXorNode;
    readonly isUnderXorNode: boolean;
}
