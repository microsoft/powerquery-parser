// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Parser } from "../../powerquery-parser";

export const ParserByParserName: ReadonlyMap<string, Parser.Parser> = new Map([
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["CombinatorialParserV2", Parser.CombinatorialParserV2],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
]);
