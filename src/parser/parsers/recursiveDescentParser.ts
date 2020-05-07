// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Naive } from ".";
import { IParser } from "../IParser";
import { IParserState } from "../IParserState";

export let RecursiveDescentParser: IParser<IParserState> = {
    ...Naive,
    read: Naive.readDocument,
};
