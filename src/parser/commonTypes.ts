// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError } from ".";
import { Result } from "../common";
import { ParseOk } from "./IParser";
import { IParserState } from "./IParserState";

export type TriedParse<S extends IParserState = IParserState> = Result<ParseOk<S>, ParseError.TParseError<S>>;
