// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";

import { ArrayUtils, TaskUtils } from "../../powerquery-parser";
import { DefaultSettings, Parser, Settings } from "../..";
import { NodeIdMap, NodeIdMapUtils } from "../../powerquery-parser/parser";
import { ResourceTestUtils, TestConstants } from "../testUtils";

function createSettings(parser: Parser.Parser): Settings {
    return {
        ...DefaultSettings,
        parser,
    };
}

for (const [parserName, parser] of TestConstants.ParserByParserName.entries()) {
    const settings: Settings = createSettings(parser);

    ResourceTestUtils.runResourceTestSuite(
        settings,
        `Attempt lex and parse resources (${parserName})`,
        (filePath: string) => {
            const filePathSlice: string = ArrayUtils.assertGet(filePath.split("microsoft-DataConnectors\\"), 1);

            return `${filePathSlice}`;
        },
        (testRun: ResourceTestUtils.ResourceTestRun) => {
            TaskUtils.assertIsParseStageOk(testRun.triedLexParse);

            const validation: NodeIdMap.CollectionValidation = NodeIdMapUtils.validate(
                testRun.triedLexParse.nodeIdMapCollection,
            );

            expect({
                badParentChildLink: validation.badParentChildLink,
                duplicateIds: validation.duplicateIds,
                unknownByNodeKindNodeIds: validation.unknownByNodeKindNodeIds,
                unknownByNodeKindNodeKinds: validation.unknownByNodeKindNodeKinds,
                unknownChildIdsKeys: validation.unknownChildIdsKeys,
                unknownChildIdsValues: validation.unknownChildIdsValues,
                unknownLeafIds: validation.unknownLeafIds,
                unknownParentIdKeys: validation.unknownParentIdKeys,
                unknownParentIdValues: validation.unknownParentIdValues,
            }).to.deep.equal({
                badParentChildLink: [],
                duplicateIds: [],
                unknownByNodeKindNodeIds: [],
                unknownByNodeKindNodeKinds: [],
                unknownChildIdsKeys: [],
                unknownChildIdsValues: [],
                unknownLeafIds: [],
                unknownParentIdKeys: [],
                unknownParentIdValues: [],
            });
        },
    );
}
