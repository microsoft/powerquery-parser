// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Token } from "../../language";
import { ActiveNode } from "../activeNode";
import { PositionUtils } from "../position";
import { TrailingToken } from "./commonTypes";

export function trailingTokenFactory(activeNode: ActiveNode, parseErrorToken: Token.Token): TrailingToken {
    return {
        ...parseErrorToken,
        isInOrOnPosition: PositionUtils.isInToken(activeNode.position, parseErrorToken, false, true),
    };
}
