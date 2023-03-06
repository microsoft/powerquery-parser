// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import * as path from "path";

import { ArrayUtils, DefaultSettings, Parser, Settings, TaskUtils } from "../../powerquery-parser";
import { TestFileUtils, TestResourceUtils } from "../testUtils";
import { BenchmarkTraceManager } from "../../powerquery-parser/common/trace";

type ParserSummary = Omit<ResourceSummary, "resourceName">;

interface ResourceSummary {
    readonly durationAverage: number;
    readonly durations: ReadonlyArray<number>;
    readonly durationSummed: number;
    readonly parserName: string;
    readonly resourceName: string;
}

const NumberOfRunsPerFile: number = 25;
const BaseOutputDirectory: string = path.join(__dirname, "benchmark");
const TraceOutputDirectory: string = path.join(BaseOutputDirectory, "traces");
const ResourceSummariesDirectory: string = path.join(BaseOutputDirectory, "resourceSummaries");
const ParserSummariesDirectory: string = path.join(BaseOutputDirectory, "parserSummaries");

const parserByParserName: Map<string, Parser.Parser> = new Map([
    ["CombinatorialParser", Parser.CombinatorialParser],
    ["RecursiveDescentParser", Parser.RecursiveDescentParser],
]);

function jsonStringify(value: unknown): string {
    return JSON.stringify(value, undefined, 4);
}

async function main(): Promise<void> {
    const resourcePaths: ReadonlyArray<string> = TestResourceUtils.getResourcePaths();

    // Even though we want to sum up the durations by parser it's better to order
    // the triple-for-loop this way due to file IO.
    const resourceSummariesByParserName: Map<string, ResourceSummary[]> = new Map();

    for (const filePath of resourcePaths) {
        const resourceContents: string = TestFileUtils.readContents(filePath);

        for (const [parserName, parser] of parserByParserName.entries()) {
            const resourceName: string = ArrayUtils.assertGet(filePath.split("microsoft-DataConnectors\\"), 1).replace(
                /\\/g,
                "-",
            );

            const durations: number[] = [];

            for (let iteration: number = 0; iteration < NumberOfRunsPerFile; iteration += 1) {
                console.log(
                    `Starting iteration ${
                        iteration + 1
                    } out of ${NumberOfRunsPerFile} for ${resourceName} using ${parserName}`,
                );

                let contents: string = "";

                const benchmarkSettings: Settings = {
                    ...DefaultSettings,
                    parser,
                    traceManager: new BenchmarkTraceManager((message: string) => (contents = contents + message)),
                };

                const iterationStart: number = performanceNow();

                // eslint-disable-next-line no-await-in-loop
                await TaskUtils.tryLexParse(benchmarkSettings, resourceContents);

                TestFileUtils.writeContents(
                    path.join(TraceOutputDirectory, `${resourceName}_${parserName}_${iteration}.log`),
                    contents,
                );

                durations.push(performanceNow() - iterationStart);
            }

            const durationSummed: number = durations.reduce((a: number, b: number) => a + b, 0);
            const durationAverage: number = durationSummed / durations.length;

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
                path.join(ResourceSummariesDirectory, `${resourceName}_${parserName}.log`),
                jsonStringify(resourceSummary),
            );
        }
    }

    for (const [parserName, resourceSummaries] of resourceSummariesByParserName.entries()) {
        const durations: ReadonlyArray<number> = resourceSummaries.map(
            (resourceSummary: ResourceSummary) => resourceSummary.durationAverage,
        );

        const durationSummed: number = durations.reduce((a: number, b: number) => a + b, 0);
        const durationAverage: number = durationSummed / resourceSummariesByParserName.size;

        const parserSummary: ParserSummary = {
            durationAverage,
            durations,
            durationSummed,
            parserName,
        };

        TestFileUtils.writeContents(
            path.join(ParserSummariesDirectory, `${parserName}.log`),
            jsonStringify(parserSummary),
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    void (await main());
})();
