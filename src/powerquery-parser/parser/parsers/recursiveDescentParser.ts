// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { IParser, IParserUtils } from "../IParser";
import { IParseState, IParseStateUtils } from "../IParseState";

export let RecursiveDescentParser: IParser<IParseState> = {
    ...NaiveParseSteps,
    applyState: IParseStateUtils.applyState,
    copyState: IParseStateUtils.copyState,
    createCheckpoint: IParserUtils.createCheckpoint,
    restoreCheckpoint: IParserUtils.restoreCheckpoint,
};
