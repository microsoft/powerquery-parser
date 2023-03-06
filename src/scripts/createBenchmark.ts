// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as path from "path";

import { DefaultSettings, Settings } from "../powerquery-parser";
import { TestFileUtils, TestResourceUtils } from "../test/testUtils";
import { BenchmarkTraceManager } from "../powerquery-parser/common/trace";

const NumberOfRunsPerFile: number = 3;
const ResourceDirectory: string = path.dirname(__filename);
const OutputDirectory: string = path.join(ResourceDirectory, "logs");

async function main(): Promise<void> {
    await TestResourceUtils.visitResources(async (filePath: string): Promise<void> => {
        const fileName: string = path.parse(filePath).name;
        const fileStart: number = performanceNow();

        for (let iteration: number = 0; iteration < NumberOfRunsPerFile; iteration += 1) {
            console.log(
                `Starting iteration ${iteration + 1} out of ${NumberOfRunsPerFile} for ${path.basename(filePath)}`,
            );

            let contents: string = "";

            const benchmarkSettings: Settings = {
                ...DefaultSettings,
                traceManager: new BenchmarkTraceManager((message: string) => (contents = contents + message)),
            };

            // eslint-disable-next-line no-await-in-loop
            await TestFileUtils.tryLexParse(benchmarkSettings, filePath);

            TestFileUtils.writeContents(`${fileName}_example_${iteration}.log`, contents);
        }

        const fileEnd: number = performanceNow();
        const fileDuration: number = fileEnd - fileStart;
        const fileAverage: number = fileDuration / NumberOfRunsPerFile;

        TestFileUtils.writeContents(
            path.join(OutputDirectory, fileName),
            [`Total time: ${fileDuration}ms`, `Average time: ${fileAverage}ms\n`].join(`\r\n`),
        );
    });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
