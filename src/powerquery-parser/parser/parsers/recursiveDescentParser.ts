// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { IParser, IParserUtils } from "../IParser";
import { IParseStateUtils } from "../IParseState";

export let RecursiveDescentParser: IParser = {
    ...NaiveParseSteps,
    applyState: IParseStateUtils.applyState,
    copyState: IParseStateUtils.copyState,
    createCheckpoint: IParserUtils.createCheckpoint,
    restoreCheckpoint: IParserUtils.restoreCheckpoint,
};
