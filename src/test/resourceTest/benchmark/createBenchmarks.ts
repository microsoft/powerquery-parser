// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as fs from "fs";
import * as path from "path";

import { DefaultSettings, Settings } from "../../..";
import { BenchmarkTraceManager } from "../../../powerquery-parser/common/trace";
import { TestFileUtils } from "../../testUtils";

const NumberOfRunsPerFile: number = 0;
const ResourceDirectory: string = path.dirname(__filename);
const SourceFilesDirectory: string = path.join(ResourceDirectory, "sourceFiles");
const OutputDirectory: string = path.join(ResourceDirectory, "logs");

function createOutputStream(filename: string): fs.WriteStream {
    const filePath: string = path.join(OutputDirectory, filename);
    createOutputDirectoryIfNeeded();

    return fs.createWriteStream(filePath, { flags: "w" });
}

function createIterationOutputStream(filePath: string, iteration: number): fs.WriteStream {
    return createOutputStream(`${path.parse(filePath).name}_example_${iteration}.log`);
}

function createOutputDirectoryIfNeeded(): void {
    // tslint:disable-next-line: non-literal-fs-path
    if (!fs.existsSync(OutputDirectory)) {
        // tslint:disable-next-line: non-literal-fs-path
        fs.mkdirSync(OutputDirectory, { recursive: true });
    }
}

async function runTest(filePath: string, iteration: number): Promise<string> {
    console.log(`Starting iteration ${iteration + 1} out of ${NumberOfRunsPerFile} for ${path.basename(filePath)}`);

    let contents: string = "";

    const benchmarkSettings: Settings = {
        ...DefaultSettings,
        traceManager: new BenchmarkTraceManager((message: string) => (contents = contents + message)),
    };

    await TestFileUtils.tryLexParse(benchmarkSettings, filePath);

    return contents;
}

async function main(): Promise<void> {
    for (const filePath of TestFileUtils.getPowerQueryFilePathsRecursively(SourceFilesDirectory)) {
        const fileStart: number = performanceNow();

        for (let iteration: number = 0; iteration < NumberOfRunsPerFile; iteration += 1) {
            // eslint-disable-next-line no-await-in-loop
            const contents: string = await runTest(filePath, iteration);

            const iterationStream: fs.WriteStream = createIterationOutputStream(filePath, iteration);

            iterationStream.on("open", () => {
                iterationStream.write(contents);
            });
        }

        const fileEnd: number = performanceNow();
        const fileDuration: number = fileEnd - fileStart;
        const fileAverage: number = fileDuration / NumberOfRunsPerFile;

        const summaryStream: fs.WriteStream = createOutputStream(`${path.basename(filePath)}.summary`);

        summaryStream.on("open", () => {
            summaryStream.write(`Total time: ${fileDuration}ms\nAverage time: ${fileAverage}ms\n`);
            summaryStream.close();
        });
    }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
