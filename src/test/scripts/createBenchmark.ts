// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as path from "path";

import { ArrayUtils, DefaultSettings, Parser, Settings, TaskUtils } from "../../powerquery-parser";
import { BenchmarkTraceManager, NoOpTraceManagerInstance } from "../../powerquery-parser/common/trace";
import { TestFileUtils, TestResourceUtils } from "../testUtils";

const IterationsPerFile: number = 100;
const BenchmarkDirectory: string = path.join(__dirname, "benchmark");
const WriteTracesToDisk: boolean = false;

const parserByParserName: Map<string, Parser.Parser> = new Map([
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
]);

type ParserSummary = Omit<ResourceSummary, "resourceName">;

interface ResourceSummary {
    readonly durationAverage: number;
    readonly durations: ReadonlyArray<number>;
    readonly durationSummed: number;
    readonly parserName: string;
    readonly resourceName: string;
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
    const resourcePaths: ReadonlyArray<string> = TestResourceUtils.getResourceFilePaths();

    // Even though we want to sum up the durations by parser it's better to order
    // the triple-for-loop this way due to file IO.
    const resourceSummariesByParserName: Map<string, ResourceSummary[]> = new Map();

    const numResources: number = resourcePaths.length;

    for (let resourceIndex: number = 0; resourceIndex <= numResources; resourceIndex += 1) {
        const filePath: string = ArrayUtils.assertGet(resourcePaths, resourceIndex);
        const resourceContents: string = TestFileUtils.readContents(filePath);

        console.log(`Starting resource ${zFill(resourceIndex)} out of ${numResources}: ${filePath}`);

        for (const [parserName, parser] of parserByParserName.entries()) {
            const resourceName: string = ArrayUtils.assertGet(filePath.split("microsoft-DataConnectors\\"), 1).replace(
                /\\/g,
                "-",
            );

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
                await TaskUtils.tryLexParse(benchmarkSettings, resourceContents);

                durations.push(Math.floor(performanceNow() - iterationStart));

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
                parserName,
                resourceName,
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

        const durationSummed: number = Math.floor(durations.reduce((a: number, b: number) => a + b, 0));
        const durationAverage: number = Math.floor(durationSummed / resourceSummariesByParserName.size);

        const parserSummary: ParserSummary = {
            durationAverage,
            durations,
            durationSummed,
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
