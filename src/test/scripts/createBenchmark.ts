// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as path from "path";

import { ArrayUtils, DefaultSettings, Parser, Settings } from "../../powerquery-parser";
import { TestFileUtils, TestResourceUtils } from "../testUtils";
import { BenchmarkTraceManager } from "../../powerquery-parser/common/trace";

const NumberOfRunsPerFile: number = 25;
const OutputDirectory: string = path.join(__dirname, "benchmark");

const parsers: ReadonlyArray<[Parser.Parser, string]> = [
    [Parser.CombinatorialParser, "CombinatorialParser"],
    [Parser.RecursiveDescentParser, "RecursiveDescentParser"],
];

async function main(): Promise<void> {
    const resourcePaths: ReadonlyArray<string> = TestResourceUtils.getResourcePaths();

    for (const [parser, parserName] of parsers) {
        for (const filePath of resourcePaths) {
            const resourcePath: string = ArrayUtils.assertGet(filePath.split("microsoft-DataConnectors\\"), 1).replace(
                /\\/g,
                "-",
            );

            const fileStart: number = performanceNow();

            for (let iteration: number = 0; iteration < NumberOfRunsPerFile; iteration += 1) {
                console.log(
                    `Starting iteration ${
                        iteration + 1
                    } out of ${NumberOfRunsPerFile} for ${resourcePath} using ${parserName}`,
                );

                let contents: string = "";

                const benchmarkSettings: Settings = {
                    ...DefaultSettings,
                    parser,
                    traceManager: new BenchmarkTraceManager((message: string) => (contents = contents + message)),
                };

                // eslint-disable-next-line no-await-in-loop
                await TestFileUtils.tryLexParse(benchmarkSettings, filePath);

                TestFileUtils.writeContents(
                    path.join(OutputDirectory, `${resourcePath}_${parserName}_${iteration}.log`),
                    contents,
                );
            }

            const fileEnd: number = performanceNow();
            const fileDuration: number = fileEnd - fileStart;
            const fileAverage: number = fileDuration / NumberOfRunsPerFile;

            TestFileUtils.writeContents(
                path.join(OutputDirectory, `${resourcePath}_${parserName}_summary.log`),
                [`Total time: ${fileDuration}ms`, `Average time: ${fileAverage}ms\n`].join(`\r\n`),
            );
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
