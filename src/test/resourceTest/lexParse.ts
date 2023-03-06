// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { ArrayUtils, TaskUtils } from "../../powerquery-parser";
import { DefaultSettings, Parser, Settings } from "../..";
import { TestResourceUtils } from "../testUtils";

const parsers: ReadonlyArray<[Settings, string]> = [
    [createSettings(Parser.CombinatorialParser), "CombinatorialParser"],
    [createSettings(Parser.RecursiveDescentParser), "RecursiveDescentParser"],
];

function createSettings(parser: Parser.Parser): Settings {
    return {
        ...DefaultSettings,
        parser,
    };
}

for (const [settings, parserName] of parsers) {
    TestResourceUtils.runResourceTestSuite(
        settings,
        `Attempt lex and parse resources (${parserName})`,
        (filePath: string) => {
            const filePathSlice: string = ArrayUtils.assertGet(filePath.split("microsoft-DataConnectors\\"), 1);

            return `${filePathSlice}`;
        },
        (testRun: TestResourceUtils.ResourceTestRun) => {
            TaskUtils.assertIsParseStageOk(testRun.triedLexParse);
        },
    );
}
