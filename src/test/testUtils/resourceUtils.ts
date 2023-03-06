// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import "mocha";
import * as path from "path";

import { Settings, Task, TaskUtils } from "../../powerquery-parser";
import { TestFileUtils } from ".";

export interface ResourceTestRun {
    readonly fileContents: string;
    readonly filePath: string;
    readonly testDuration: number;
    readonly triedLexParse: Task.TriedLexParseTask;
}

export function getResourceFilePaths(): ReadonlyArray<string> {
    return TestFileUtils.getPowerQueryFilePathsRecursively(ResourcesDirectory);
}

export async function visitResources(visitFn: (filePath: string) => Promise<void>): Promise<void> {
    for (const filePath of TestFileUtils.getPowerQueryFilePathsRecursively(ResourcesDirectory)) {
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
                const fileContents: string = TestFileUtils.readContents(filePath);
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
