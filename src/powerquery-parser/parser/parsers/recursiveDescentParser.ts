// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { Parser, ParserUtils } from "../parser";
import { ParseStateUtils } from "../parseState";

export let RecursiveDescentParser: Parser = {
    ...NaiveParseSteps,
    applyState: ParseStateUtils.applyState,
    copyState: ParseStateUtils.copyState,
    createCheckpoint: ParserUtils.createCheckpoint,
    restoreCheckpoint: ParserUtils.restoreCheckpoint,
};
