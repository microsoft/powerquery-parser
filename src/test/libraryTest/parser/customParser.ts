// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import { DefaultSettings, Parser, Settings, Task, TaskUtils } from "../../..";

describe(`custom Parser`, () => {
    it(`parserEntryPoint`, async () => {
        const customSettings: Settings = {
            ...DefaultSettings,
            parser: Parser.RecursiveDescentParser,
            parserEntryPoint: Parser.RecursiveDescentParser.readParameterSpecificationList,
        };

        const triedLexParseTask: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
            customSettings,
            "(a as number, optional b as text)",
        );

        TaskUtils.assertIsParseStageOk(triedLexParseTask);
    });
});
