// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as fs from "fs";
import * as path from "path";

import { DefaultSettings, Settings } from "../../..";
import { BenchmarkTraceManager } from "../../../powerquery-parser/common/trace";
import { TestFileUtils } from "../../testUtils";

const NumberOfRunsPerFile: number = 100;
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

for (const filePath of TestFileUtils.getPowerQueryFilesRecursively(SourceFilesDirectory)) {
    const fileStart: number = performanceNow();

    for (let iteration: number = 0; iteration < NumberOfRunsPerFile; iteration += 1) {
        const stream: fs.WriteStream = createIterationOutputStream(filePath, iteration);

        stream.on("open", async () => {
            if (iteration % 2 === 0 || iteration === NumberOfRunsPerFile - 1) {
                console.log(
                    `Running iteration ${iteration + 1} out of ${NumberOfRunsPerFile} for ${path.basename(filePath)}`,
                );
            }

            const benchmarkSettings: Settings = {
                ...DefaultSettings,
                traceManager: new BenchmarkTraceManager((message: string) => stream.write(message)),
            };

            await TestFileUtils.tryLexParse(benchmarkSettings, filePath);
        });
    }

    const fileEnd: number = performanceNow();
    const fileDuration: number = fileEnd - fileStart;
    const fileAverage: number = fileDuration / NumberOfRunsPerFile;

    const summaryStream: fs.WriteStream = createOutputStream(`${path.basename(filePath)}.summary`);

    summaryStream.on("open", () => {
        summaryStream.write(`Total time: ${fileDuration}ms\nAverage time: ${fileAverage}ms\n`);
    });
}
