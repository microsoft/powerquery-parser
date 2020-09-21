// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NaiveParseSteps } from ".";
import { IParser } from "../IParser";
import { IParserState } from "../IParserState";

export let RecursiveDescentParser: IParser<IParserState> = { ...NaiveParseSteps };
