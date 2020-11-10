// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import "mocha";
import { Task } from "../..";
import { ResultUtils } from "../../common";
import { LexerSnapshot } from "../../lexer";
import { DefaultLocale } from "../../localization";
import {
    CombinatorialParser,
    IParser,
    IParseState,
    IParseStateUtils,
    RecursiveDescentParser,
    TParseStateFactoryOverrides,
} from "../../parser";
import { ParseSettings } from "../../settings";
import { TestFileUtils } from "../testUtils";
import { BenchmarkParser, BenchmarkState, FunctionTimestamp } from "./benchmarkParser";

import * as path from "path";

interface FileSummary {
    readonly parserName: string;
    readonly fileName: string;
    readonly numberOfRuns: number;
    readonly allRunsStart: number;
    readonly allRunsEnd: number;
    readonly allRunsDuration: number;
    readonly singleRunDurationMin: number;
    readonly singleRunDurationMax: number;
}

const Parsers: ReadonlyArray<[ParseSettings<BenchmarkState>, string]> = [
    [benchmarkParseSettingsFactory(CombinatorialParser), "CombinatorialParser"],
    [benchmarkParseSettingsFactory(RecursiveDescentParser), "RecursiveDescentParser"],
];

const NumberOfRunsPerFile: number = 100;
const ReportFileName: string = `Report.perf`;
const ResourceDirectory: string = path.join(path.dirname(__filename), "benchmarkResources");

const allSummaries: FileSummary[] = [];
for (const [parseSettings, parserName] of Parsers) {
    allSummaries.push(...parseAllFiles(parseSettings, parserName));
}

writeReport(ResourceDirectory, allSummaries);

function benchmarkStateFactory(
    lexerSnapshot: LexerSnapshot,
    maybeOverrides: TParseStateFactoryOverrides | undefined,
    baseParser: IParser<IParseState>,
): BenchmarkState {
    return {
        ...IParseStateUtils.stateFactory(lexerSnapshot, maybeOverrides),
        baseParser,
        functionTimestamps: new Map(),
        functionTimestampCounter: 0,
    };
}

function benchmarkParseSettingsFactory(baseParser: IParser<IParseState>): ParseSettings<BenchmarkState> {
    return {
        maybeCancellationToken: undefined,
        parser: BenchmarkParser,
        parseStateFactory: (lexerSnapshot: LexerSnapshot, maybeOverrides: TParseStateFactoryOverrides | undefined) =>
            benchmarkStateFactory(lexerSnapshot, maybeOverrides, baseParser),
        maybeParserOptions: undefined,
        locale: DefaultLocale,
    };
}

function parseAllFiles(settings: ParseSettings<BenchmarkState>, parserName: string): ReadonlyArray<FileSummary> {
    const parserSummaries: FileSummary[] = [];

    for (const filePath of TestFileUtils.getPowerQueryFilesRecursively(ResourceDirectory)) {
        // tslint:disable-next-line: no-console
        console.log(`Starting ${parserName} test on ${filePath}`);
        const fileName: string = path.basename(filePath);

        const timings: Map<number, FunctionTimestamp>[] = [];
        const allRunsStart: number = performanceNow();

        for (let index: number = 0; index < NumberOfRunsPerFile; index += 1) {
            if (index % 10 === 0) {
                // tslint:disable-next-line: no-console
                console.log(`\tRun ${index} of ${NumberOfRunsPerFile}`);
            }
            const triedLexParse: Task.TriedLexParse<BenchmarkState> = TestFileUtils.tryLexParse(settings, filePath);
            if (!ResultUtils.isOk(triedLexParse)) {
                throw triedLexParse.error;
            }
            timings.push(triedLexParse.value.state.functionTimestamps);
        }

        let singleRunDurationMin: number = Number.MAX_SAFE_INTEGER;
        let singleRunDurationMax: number = Number.MIN_SAFE_INTEGER;

        // tslint:disable-next-line: no-console
        console.log(`Parsing results for ${parserName} test on ${filePath}`);
        for (const fnTimestamps of timings) {
            for (const entry of fnTimestamps.values()) {
                // When it switches from reading an expression document to a section documents
                // it can leave undefined duration values.
                // This is the easiest way to drop them.
                if (entry.timeDuration === undefined) {
                    continue;
                }
                singleRunDurationMin = Math.min(singleRunDurationMin, entry.timeDuration);
                singleRunDurationMax = Math.max(singleRunDurationMax, entry.timeDuration);
            }
        }

        const allRunsEnd: number = performanceNow();
        parserSummaries.push({
            parserName,
            fileName,
            numberOfRuns: NumberOfRunsPerFile,
            allRunsStart,
            allRunsEnd,
            allRunsDuration: allRunsEnd - allRunsStart,
            singleRunDurationMin,
            singleRunDurationMax,
        });

        for (let index: number = 0; index < NumberOfRunsPerFile; index += 1) {
            const perfFileName: string = `${fileName}_${parserName}_${index}.perf`;
            writeSingleRunTimestamps(ResourceDirectory, perfFileName, timings[index]);
        }
    }

    return parserSummaries;
}

function writeReport(resourceDirectory: string, summaries: ReadonlyArray<FileSummary>): void {
    const reportHeaders: ReadonlyArray<string> = [
        "parserName",
        "fileName",
        "numRuns",
        "allRunsStart",
        "allRunsEnd",
        "allRunsDuration",
        "singleRunDurationMin",
        "singleRunDurationMax",
    ];

    let csvContent: string = `${reportHeaders.join(",")}\n`;
    for (const summary of summaries) {
        csvContent += `${summary.parserName}`;
        csvContent += `,${summary.fileName}`;
        csvContent += `,${summary.numberOfRuns}`;
        csvContent += `,${summary.allRunsStart}`;
        csvContent += `,${summary.allRunsEnd}`;
        csvContent += `,${summary.allRunsDuration}`;
        csvContent += `,${summary.singleRunDurationMin}`;
        csvContent += `,${summary.singleRunDurationMax}`;
        csvContent += `\n`;
    }

    const logFilePath: string = path.join(resourceDirectory, "logs", ReportFileName);
    TestFileUtils.writeContents(logFilePath, csvContent);
}

function writeSingleRunTimestamps(
    resourceDirectory: string,
    perfFileName: string,
    fnTimestamps: Map<number, FunctionTimestamp>,
): void {
    const singleRunHeaders: ReadonlyArray<string> = [
        "fileName",
        "id",
        "fnName",
        "lineNumberStart",
        "lineCodeUnitStart",
        "codeUnitStart",
        "lineNumberEnd",
        "lineCodeUnitEnd",
        "codeUnitEnd",
        "timeStart",
        "timeEnd",
        "timeDuration",
    ];

    let csvContent: string = `${singleRunHeaders.join(",")}\n`;
    for (const fnTimestamp of fnTimestamps.values()) {
        csvContent += `${perfFileName}`;
        csvContent += `,${fnTimestamp.id}`;
        csvContent += `,${fnTimestamp.fnName}`;
        csvContent += `,${fnTimestamp.lineNumberStart}`;
        csvContent += `,${fnTimestamp.lineCodeUnitStart}`;
        csvContent += `,${fnTimestamp.codeUnitStart}`;
        csvContent += `,${fnTimestamp.lineNumberEnd}`;
        csvContent += `,${fnTimestamp.lineCodeUnitEnd}`;
        csvContent += `,${fnTimestamp.codeUnitEnd}`;
        csvContent += `,${fnTimestamp.timeStart}`;
        csvContent += `,${fnTimestamp.timeEnd}`;
        csvContent += `,${fnTimestamp.timeDuration}`;
        csvContent += `\n`;
    }

    const logFilePath: string = path.join(resourceDirectory, "logs", perfFileName);
    TestFileUtils.writeContents(logFilePath, csvContent);
}
