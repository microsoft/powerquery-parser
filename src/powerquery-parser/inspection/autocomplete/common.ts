// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Token } from "../../language";
import { Position, PositionUtils } from "../position";
import { TrailingToken } from "./commonTypes";

export function trailingTokenFactory(position: Position, parseErrorToken: Token.Token): TrailingToken {
    return {
        ...parseErrorToken,
        isInOrOnPosition: PositionUtils.isInToken(position, parseErrorToken, false, true),
    };
}
