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

function testNameFromFilePath(filePath: string): string {
    return ArrayUtils.assertGet(filePath.split("microsoft-DataConnectors"), 1);
}

for (const [settings, parserName] of parsers) {
    TestResourceUtils.runResourceTestSuite(
        settings,
        `Run ${parserName} on lexParseResources directory`,
        testNameFromFilePath,
        (testRun: TestResourceUtils.TestRun) => {
            TaskUtils.assertIsParseStageOk(testRun.triedLexParse);
        },
    );
}
