// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Parser, ParserUtils } from "../parser";
import { NaiveParseSteps } from ".";
import { ParseStateUtils } from "../parseState";

export const RecursiveDescentParser: Parser = {
    ...NaiveParseSteps,

    readIdentifier: NaiveParseSteps.readIdentifier,

    applyState: ParseStateUtils.applyState,
    copyState: ParseStateUtils.copyState,
    checkpoint: ParserUtils.checkpoint,
    restoreCheckpoint: ParserUtils.restoreCheckpoint,
};
