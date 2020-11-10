// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { IParser, IParserStateCheckpoint, IParserUtils } from "../IParser";
import { IParserState } from "../IParserState";

export let RecursiveDescentParser: IParser<IParserState> = {
    ...NaiveParseSteps,
    createCheckpoint: (state: IParserState) => IParserUtils.stateCheckpointFactory(state),
    restoreCheckpoint: (state: IParserState, checkpoint: IParserStateCheckpoint) =>
        IParserUtils.restoreStateCheckpoint(state, checkpoint),
};
