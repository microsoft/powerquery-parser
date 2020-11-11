// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { IParser, IParserUtils, IParseStateCheckpoint } from "../IParser";
import { IParseState } from "../IParseState";

export let RecursiveDescentParser: IParser<IParseState> = {
    ...NaiveParseSteps,
    checkpointFactory: (state: IParseState) => IParserUtils.stateCheckpointFactory(state),
    loadCheckpoint: (state: IParseState, checkpoint: IParseStateCheckpoint) =>
        IParserUtils.restoreStateCheckpoint(state, checkpoint),
};
