// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NodeIdMap } from "../../parser";
import { Position } from "../position";

// An active node can be thought of as the node the user is expecting their autocomplete to show options for.
export interface ActiveNode {
    readonly position: Position;
    readonly root: NodeIdMap.TXorNode;
    readonly ancestry: ReadonlyArray<NodeIdMap.TXorNode>;
    readonly relativePosition: RelativePosition;
    readonly isNoopXorNode: boolean;
}

export const enum RelativePosition {
    // Some literals automatically shift the context one to the right,
    // making position be to the left of the active node.
    // 'foo =| bar'
    Left = "Left",
    // Within TokenRange for XorNode. Treat the ending position as inclusive.
    // 'fo|o' and 'foo|'
    Under = "Under",
    // 'foo |'
    Right = "Right",
}
