// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { ResultUtils } from "../../common";
import { LexerSnapshot } from "../../lexer";
import { DefaultTemplates } from "../../localization";
import { IParser, IParserState, IParserStateUtils } from "../../parser";
import { CombinatorialParser } from "../../parser/parsers";
import { ParseSettings, Settings } from "../../settings";
import { TriedLexParse } from "../../tasks";
import { BenchmarkParser, BenchmarkState } from "./benchmarkParser";

import * as path from "path";
import * as FileUtils from "../fileUtils";

const parsers: ReadonlyArray<[ParseSettings<BenchmarkState>, string]> = [
    [createBenchmarkParseSettings(createCombinatorialBenchmarkState), "CombinatorialParser"],
    [createBenchmarkParseSettings(createRecurisveDescentBenchmarkState), "RecursiveDescentParser"],
];

const headers: ReadonlyArray<string> = [
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

for (const [settings, parserName] of parsers) {
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
    describe(`Benchmark ${parserName} on benchmarkResources directory`, () => {
        const fileDirectory: string = path.join(path.dirname(__filename), "benchmarkResources");

        for (const filePath of FileUtils.getPowerQueryFilesRecursively(fileDirectory)) {
            const fileName: string = path.basename(filePath);

            it(fileName, () => {
                const triedLexParse: TriedLexParse<BenchmarkState> = FileUtils.tryLexParse(settings, filePath);
                if (!ResultUtils.isOk(triedLexParse)) {
                    throw triedLexParse.error;
                }

                let csvContent: string = `${headers.join(",")}\n`;
                for (const fnTimestamp of triedLexParse.value.state.functionTimestamps.values()) {
                    csvContent += `${fileName}`;
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

                const logFilePath: string = path.join(fileDirectory, "logs", `${fileName}.${parserName}.perf`);
                FileUtils.writeContents(logFilePath, csvContent);
            });
        }
    });
}
