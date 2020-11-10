// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { IParser, IParserUtils, IParseStateCheckpoint } from "../IParser";
import { IParseState } from "../IParseState";

export let RecursiveDescentParser: IParser<IParseState> = {
    ...NaiveParseSteps,
    createCheckpoint: (state: IParseState) => IParserUtils.stateCheckpointFactory(state),
    restoreFromCheckpoint: (state: IParseState, checkpoint: IParseStateCheckpoint) =>
        IParserUtils.restoreStateCheckpoint(state, checkpoint),
};
