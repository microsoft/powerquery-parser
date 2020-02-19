// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import "mocha";
import { ResultUtils } from "../../common";
import { LexerSnapshot } from "../../lexer";
import { DefaultTemplates } from "../../localization";
import { IParser, IParserState, IParserStateUtils } from "../../parser";
import { CombinatorialParser } from "../../parser/parsers";
import { ParseSettings, Settings } from "../../settings";
import { TriedLexParse } from "../../tasks";
import { BenchmarkParser, BenchmarkState, FunctionTimestamp } from "./benchmarkParser";

import * as path from "path";
import * as FileUtils from "../fileUtils";

interface FileSummary {
    readonly fileName: string;
    readonly numberOfRuns: number;
    readonly allRunsTimeStart: number;
    readonly allRunsTimeEnd: number;
    readonly allRunsTimeDuration: number;
    readonly singleRunDurationMin: number;
    readonly singleRunDurationMax: number;
}

const Parsers: ReadonlyArray<[ParseSettings<BenchmarkState>, string]> = [
    [createBenchmarkParseSettings(createCombinatorialBenchmarkState), "CombinatorialParser"],
    [createBenchmarkParseSettings(createRecurisveDescentBenchmarkState), "RecursiveDescentParser"],
];

const NumberOfRunsPerFile: number = 100;

const RunHeaders: ReadonlyArray<string> = [
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

const ReportHeaders: ReadonlyArray<string> = [
    "fileName",
    "numRuns",
    "timeStart",
    "timeEnd",
    "timeDuration",
    "timeDurationMin",
    "timeDurationMax",
];

for (const [settings, parserName] of Parsers) {
    parseAllFiles(settings, parserName);
}

function createRecurisveDescentBenchmarkState(
    settings: ParseSettings<BenchmarkState>,
    lexerSnapshot: LexerSnapshot,
): BenchmarkState {
    return createBenchmarkState(settings, lexerSnapshot, CombinatorialParser);
}

function createCombinatorialBenchmarkState(
    settings: ParseSettings<BenchmarkState>,
    lexerSnapshot: LexerSnapshot,
): BenchmarkState {
    return createBenchmarkState(settings, lexerSnapshot, CombinatorialParser);
}

function createBenchmarkState(
    settings: ParseSettings<BenchmarkState>,
    lexerSnapshot: LexerSnapshot,
    baseParser: IParser<IParserState>,
): BenchmarkState {
    return {
        ...IParserStateUtils.newState(settings, lexerSnapshot),
        baseParser,
        functionTimestamps: new Map(),
        functionTimestampCounter: 0,
    };
}

function createBenchmarkParseSettings(
    newParserStateFn: (settings: ParseSettings<BenchmarkState>, lexerSnapshot: LexerSnapshot) => BenchmarkState,
): ParseSettings<BenchmarkState> {
    return {
        localizationTemplates: DefaultTemplates,
        parser: BenchmarkParser,
        newParserState: newParserStateFn,
    };
}

function parseAllFiles(settings: Settings<BenchmarkState>, parserName: string): void {
    throw new Error()
    const resourceDirectory: string = path.join(path.dirname(__filename), "benchmarkResources");
    const summaries: FileSummary[] = [];

    for (const filePath of FileUtils.getPowerQueryFilesRecursively(resourceDirectory)) {
        const fileName: string = path.basename(filePath);

        const timings: Map<number, FunctionTimestamp>[] = [];
        const allRunsTimeStart: number = performanceNow();

        for (let index: number = 0; index < NumberOfRunsPerFile; index += 1) {
            const triedLexParse: TriedLexParse<BenchmarkState> = FileUtils.tryLexParse(settings, filePath);
            if (!ResultUtils.isOk(triedLexParse)) {
                throw triedLexParse.error;
            }
            timings.push(triedLexParse.value.state.functionTimestamps);
        }

        let singleRunDurationMin: number = Number.MAX_SAFE_INTEGER;
        let singleRunDurationMax: number = Number.MIN_SAFE_INTEGER;
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

        const allRunsTimeEnd: number = performanceNow();
        summaries.push({
            fileName,
            numberOfRuns: NumberOfRunsPerFile,
            allRunsTimeStart,
            allRunsTimeEnd,
            allRunsTimeDuration: allRunsTimeEnd - allRunsTimeStart,
            singleRunDurationMin,
            singleRunDurationMax,
        });

        for (let index: number = 0; index < NumberOfRunsPerFile; index += 1) {
            const perfFileName: string = `${fileName}_${parserName}_${index}.perf`;
            writeSingleRunTimestamps(resourceDirectory, perfFileName, timings[index]);
        }

        const reportFileName: string = `${fileName}_${parserName}`;
        writeReport(resourceDirectory, reportFileName, summaries);
    }
}

function writeReport(resourceDirectory: string, reportFileName: string, summaries: ReadonlyArray<FileSummary>): void {
    let csvContent: string = `${ReportHeaders.join(",")}\n`;
    for (const summary of summaries) {
        csvContent += `${summary.fileName}`;
        csvContent += `,${summary.numberOfRuns}`;
        csvContent += `,${summary.allRunsTimeStart}`;
        csvContent += `,${summary.allRunsTimeEnd}`;
        csvContent += `,${summary.allRunsTimeDuration}`;
        csvContent += `,${summary.singleRunDurationMin}`;
        csvContent += `,${summary.singleRunDurationMin}`;
    }

    const logFilePath: string = path.join(resourceDirectory, "logs", reportFileName);
    FileUtils.writeContents(logFilePath, csvContent);
}

function writeSingleRunTimestamps(
    resourceDirectory: string,
    perfFileName: string,
    fnTimestamps: Map<number, FunctionTimestamp>,
): void {
    let csvContent: string = `${RunHeaders.join(",")}\n`;
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
        csvContent += `,${fnTimestamp.timeDuration}\n`;
    }

    const logFilePath: string = path.join(resourceDirectory, "logs", perfFileName);
    FileUtils.writeContents(logFilePath, csvContent);
}
