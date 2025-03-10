// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import "mocha";
import * as path from "path";

import { ArrayUtils, Settings, Task, TaskUtils } from "../../powerquery-parser";
import { FileTestUtils } from ".";

export interface ResourceTestRun {
    readonly fileContents: string;
    readonly filePath: string;
    readonly testDuration: number;
    readonly triedLexParse: Task.TriedLexParseTask;
}

export interface TestResource {
    readonly fileContents: string;
    readonly filePath: string;
    readonly resourceName: string;
}

export function getResourceFilePaths(): ReadonlyArray<string> {
    return FileTestUtils.getPowerQueryFilePathsRecursively(ResourcesDirectory);
}

export function getResources(): ReadonlyArray<TestResource> {
    return getResourceFilePaths().map((filePath: string) => {
        const fileContents: string = FileTestUtils.readContents(filePath);

        const resourceName: string = ArrayUtils.assertGet(
            filePath.split(ResourcesDirectory),
            1,
            `expected ${filePath} to include ResourcesDirectory: ${ResourcesDirectory}}`,
        )
            .replace(/\\/g, "-")
            .replace(/^-/g, "");

        return {
            fileContents,
            filePath,
            resourceName,
        };
    });
}

export async function visitResources(visitFn: (filePath: string) => Promise<void>): Promise<void> {
    for (const filePath of FileTestUtils.getPowerQueryFilePathsRecursively(ResourcesDirectory)) {
        // eslint-disable-next-line no-await-in-loop
        await visitFn(filePath);
    }
}

export function runResourceTestSuite(
    settings: Settings,
    suiteName: string,
    testNameFn: (filePath: string) => string,
    visitFn: (testRun: ResourceTestRun) => void,
): void {
    describe(suiteName, () => {
        for (const filePath of getResourceFilePaths()) {
            it(testNameFn(filePath), async () => {
                const fileContents: string = FileTestUtils.readContents(filePath);
                const testStart: number = performanceNow();

                // eslint-disable-next-line no-await-in-loop
                const triedLexParse: Task.TriedLexParseTask = await TaskUtils.tryLexParse(settings, fileContents);

                visitFn({
                    fileContents,
                    filePath,
                    testDuration: Math.floor(performanceNow() - testStart),
                    triedLexParse,
                });
            });
        }
    });
}

const ResourcesDirectory: string = path.join(path.dirname(__dirname), "resources");
