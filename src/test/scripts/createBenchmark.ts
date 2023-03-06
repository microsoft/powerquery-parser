// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as path from "path";

import { ArrayUtils, DefaultSettings, Parser, Settings, Task, TaskUtils } from "../../powerquery-parser";
import { BenchmarkTraceManager, NoOpTraceManagerInstance } from "../../powerquery-parser/common/trace";
import { TestFileUtils, TestResourceUtils } from "../testUtils";

const IterationsPerFile: number = 100;
const BenchmarkDirectory: string = path.join(__dirname, "benchmark");
const WriteTracesToDisk: boolean = false;

const parserByParserName: Map<string, Parser.Parser> = new Map([
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
]);

interface ParserSummary {
    readonly durationAverage: number;
    readonly durations: ReadonlyArray<number>;
    readonly durationSummed: number;
    readonly parserName: string;
    readonly failedToParseResourcePaths: ReadonlyArray<string> | null;
}

interface ResourceSummary {
    readonly durationAverage: number;
    readonly durations: ReadonlyArray<number>;
    readonly durationSummed: number;
    readonly parserName: string;
    readonly resourcePath: string;
    readonly failedToParse: boolean;
}

function jsonStringify(value: unknown): string {
    return JSON.stringify(value, undefined, 4);
}

function zFill(value: number): string {
    return value.toString().padStart(Math.ceil(Math.log10(IterationsPerFile + 1)), "0");
}

// Triple for-loop with parsers, resource filepaths, and an iteration count being the parameters.
// The inner most loop is run ${IterationsPerFile} times and calls `TaskUtils.tryLexParse`.
// It's to find the average duration of a parse for a given (file, parser) pair.
// Durations are initially measured in fractional milliseconds, then the fractional component is dropped.
// The outer loop summarizes the aggregate durations for each parser across all files.
// Optionally writes traces to disk with $WriteTracesToDIsk.
async function main(): Promise<void> {
    // Even though we want to sum up the durations by parser it's better to order
    // the triple-for-loop this way due to file IO.
    const resourceSummariesByParserName: Map<string, ResourceSummary[]> = new Map();
    const resourceFilePaths: ReadonlyArray<string> = TestResourceUtils.getResourceFilePaths();
    const numResources: number = resourceFilePaths.length;

    for (let resourceIndex: number = 0; resourceIndex < numResources; resourceIndex += 1) {
        const resourcePath: string = ArrayUtils.assertGet(resourceFilePaths, resourceIndex);

        const resourceName: string = ArrayUtils.assertGet(
            resourcePath.split("microsoft-DataConnectors\\"),
            1,
            `expected ${resourcePath} to include "microsoft-DataConnectors\\"`,
        ).replace(/\\/g, "-");

        const resourceContents: string = TestFileUtils.readContents(resourcePath);

        console.log(`Starting resource ${zFill(resourceIndex + 1)} out of ${numResources}: ${resourcePath}`);

        for (const [parserName, parser] of parserByParserName.entries()) {
            let failedToParse: boolean = false;
            const durations: number[] = [];

            for (let iteration: number = 0; iteration < IterationsPerFile; iteration += 1) {
                console.log(`\tIteration ${zFill(iteration + 1)} out of ${IterationsPerFile} using ${parserName}`);

                let contents: string = "";

                const benchmarkSettings: Settings = {
                    ...DefaultSettings,
                    parser,
                    traceManager: WriteTracesToDisk
                        ? new BenchmarkTraceManager((message: string) => (contents = contents + message))
                        : NoOpTraceManagerInstance,
                };

                const iterationStart: number = performanceNow();

                // eslint-disable-next-line no-await-in-loop
                const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                    benchmarkSettings,
                    resourceContents,
                );

                durations.push(Math.floor(performanceNow() - iterationStart));

                if (!TaskUtils.isParseStageOk(triedLexParse)) {
                    failedToParse = true;
                }

                if (WriteTracesToDisk) {
                    TestFileUtils.writeContents(
                        path.join(
                            BenchmarkDirectory,
                            "traces",
                            parserName,
                            resourceName,
                            `iteration_${zFill(iteration)}.log`,
                        ),
                        contents,
                    );
                }
            }

            const durationSummed: number = Math.floor(durations.reduce((a: number, b: number) => a + b, 0));
            const durationAverage: number = Math.floor(durationSummed / durations.length);

            const resourceSummary: ResourceSummary = {
                durationAverage,
                durations,
                durationSummed,
                failedToParse,
                parserName,
                resourcePath,
            };

            const resourceSummaries: ResourceSummary[] = resourceSummariesByParserName.get(parserName) ?? [];
            resourceSummaries.push(resourceSummary);
            resourceSummariesByParserName.set(parserName, resourceSummaries);

            TestFileUtils.writeContents(
                path.join(BenchmarkDirectory, "summary", "byResource", parserName, `${resourceName}.log`),
                jsonStringify(resourceSummary),
            );
        }
    }

    for (const [parserName, resourceSummaries] of resourceSummariesByParserName.entries()) {
        const durations: ReadonlyArray<number> = resourceSummaries.map(
            (resourceSummary: ResourceSummary) => resourceSummary.durationAverage,
        );

        const failedToParseResourcePaths: ReadonlyArray<string> = resourceSummaries
            .filter((resourceSummary: ResourceSummary) => resourceSummary.failedToParse)
            .map((resourceSummary: ResourceSummary) => resourceSummary.resourcePath);

        const durationSummed: number = Math.floor(durations.reduce((a: number, b: number) => a + b, 0));
        const durationAverage: number = Math.floor(durationSummed / resourceSummariesByParserName.size);

        const parserSummary: ParserSummary = {
            durationAverage,
            durations,
            durationSummed,
            failedToParseResourcePaths: failedToParseResourcePaths ? failedToParseResourcePaths : null,
            parserName,
        };

        TestFileUtils.writeContents(
            path.join(BenchmarkDirectory, "summary", "byParser", `${parserName}.log`),
            jsonStringify(parserSummary),
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
