// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as path from "path";

import { ArrayUtils, DefaultSettings, Settings, Task, TaskUtils } from "../../powerquery-parser";
import { BenchmarkTraceManager, NoOpTraceManagerInstance } from "../../powerquery-parser/common/trace";
import { TestConstants, TestFileUtils, TestResourceUtils } from "../testUtils";
import { TestResource } from "../testUtils/resourceUtils";

const BenchmarkDirectory: string = path.join(__dirname, "benchmark");

// We want to run each file ${IterationsPerFile} times to get a more accurate average duration.
const IterationsPerFile: number = 100;
// Additionally, we drop the top and bottom ${IterationPercentageDropped}% of
// durations from iterations to reduce the impact of outliers.
const IterationPercentageDropped: number = 0.05;
const NumIterationsDropped: number = Math.floor(IterationsPerFile * IterationPercentageDropped);

// Writes a bunch of trace entries to disk.
// Usually not useful or needed, especially since it adds a bunch of IO overhead.
const WriteTracesToDisk: boolean = false;

interface ParserSummary {
    readonly durations: Durations;
    readonly durationsFiltered: Durations;
    readonly failedToParseResourcePaths: ReadonlyArray<string> | null;
    readonly parserName: string;
}

interface ResourceSummary {
    readonly durations: Durations;
    readonly durationsFiltered: Durations;
    readonly failedToParse: boolean;
    readonly filePath: string;
    readonly parserName: string;
}

interface Durations {
    readonly average: number;
    readonly durations: ReadonlyArray<number>;
    readonly summed: number;
}

function jsonStringify(value: unknown): string {
    return JSON.stringify(value, undefined, 4);
}

function zFill(currentValue: number, upperBound: number): string {
    return currentValue.toString().padStart(Math.ceil(Math.log10(upperBound + 1)), "0");
}

function createParserSummaryDurations(
    resourceSummaries: ReadonlyArray<ResourceSummary>,
    filterOutOutliers: boolean,
): Durations {
    const durations: ReadonlyArray<number> = [...resourceSummaries].map((resourceSummary: ResourceSummary) =>
        filterOutOutliers ? resourceSummary.durationsFiltered.average : resourceSummary.durations.average,
    );

    const summed: number = durations.reduce((acc: number, curr: number) => acc + curr, 0);

    return {
        durations,
        summed,
        average: summed / resourceSummaries.length,
    };
}

function createResourceSummaryDurations(durations: ReadonlyArray<number>, filterOutOutliers: boolean): Durations {
    if (filterOutOutliers) {
        durations = [...durations].sort().slice(NumIterationsDropped, durations.length - NumIterationsDropped);
    }

    const summed: number = durations.reduce((acc: number, curr: number) => acc + curr, 0);
    const average: number = summed / durations.length;

    return {
        durations,
        summed,
        average,
    };
}

// Triple for-loop with parsers, resource filepaths, and an iteration count being the parameters.
// The inner most loop is run ${IterationsPerFile} times and calls `TaskUtils.tryLexParse`.
// It's to find the average duration of a parse for a given (file, parser) pair.
// Durations are initially measured in fractional milliseconds, then the fractional component is dropped.
// The outer loop summarizes the aggregate durations for each parser across all files.
// Optionally writes traces to disk with $WriteTracesToDisk.
async function main(): Promise<void> {
    const resourceSummariesByParserName: Map<string, ReadonlyArray<ResourceSummary>> = new Map();
    const resources: ReadonlyArray<TestResource> = TestResourceUtils.getResources();
    const numResources: number = resources.length;

    for (let resourceIndex: number = 0; resourceIndex < numResources; resourceIndex += 1) {
        const { fileContents, filePath, resourceName }: TestResource = ArrayUtils.assertGet(resources, resourceIndex);

        console.log(`Starting resource ${zFill(resourceIndex + 1, numResources)} out of ${numResources}: ${filePath}`);

        for (const [parserName, parser] of TestConstants.ParserByParserName.entries()) {
            let failedToParse: boolean = false;
            const durations: number[] = [];

            for (let iteration: number = 0; iteration < IterationsPerFile; iteration += 1) {
                console.log(
                    `\tIteration ${zFill(
                        iteration + 1,
                        IterationsPerFile,
                    )} out of ${IterationsPerFile} using ${parserName}`,
                );

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
                    fileContents,
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
                            `iteration_${zFill(iteration, IterationsPerFile)}.log`,
                        ),
                        contents,
                    );
                }
            }

            const resourceSummary: ResourceSummary = {
                durations: createResourceSummaryDurations(durations, false),
                durationsFiltered: createResourceSummaryDurations(durations, true),
                failedToParse,
                parserName,
                filePath,
            };

            const resourceSummaries: ResourceSummary[] = [...(resourceSummariesByParserName.get(parserName) ?? [])];
            resourceSummaries.push(resourceSummary);
            resourceSummariesByParserName.set(parserName, resourceSummaries);

            TestFileUtils.writeContents(
                path.join(BenchmarkDirectory, "summary", "byResource", parserName, `${resourceName}.log`),
                jsonStringify(resourceSummary),
            );
        }
    }

    for (const [parserName, resourceSummaries] of resourceSummariesByParserName.entries()) {
        const failedToParseResourcePaths: ReadonlyArray<string> = resourceSummaries
            .filter((resourceSummary: ResourceSummary) => resourceSummary.failedToParse)
            .map((resourceSummary: ResourceSummary) => resourceSummary.filePath)
            .sort();

        const parserSummary: ParserSummary = {
            durations: createParserSummaryDurations(resourceSummaries, false),
            durationsFiltered: createParserSummaryDurations(resourceSummaries, true),
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
