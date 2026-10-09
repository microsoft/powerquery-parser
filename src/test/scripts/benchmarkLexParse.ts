// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";

import { DefaultSettings, ResultKind, Task, TaskUtils } from "../../powerquery-parser";
import { createHash } from "crypto";

const DefaultFileCount: number = 7;
const DefaultMeasuredIterations: number = 12;
const WarmupIterations: number = 2;

interface PhaseSummary {
    readonly meanMs: number;
    readonly medianMs: number;
    readonly minMs: number;
    readonly maxMs: number;
    readonly samplesMs: ReadonlyArray<number>;
}

interface BenchmarkResult {
    readonly file: string;
    readonly filePath: string;
    readonly bytes: number;
    readonly characters: number;
    readonly sourceSha256: string;
    readonly hadByteOrderMark: boolean;
    readonly parseSucceeded: boolean;
    readonly parseError: string | undefined;
    readonly lex: PhaseSummary;
    readonly parse: PhaseSummary;
    readonly parseFreshSnapshot: PhaseSummary;
    readonly totalMeanMs: number;
    readonly lexPercentage: number;
    readonly parsePercentage: number;
    readonly parseToLexRatio: number;
}

function elapsedMilliseconds(start: bigint): number {
    return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function findPowerQueryFiles(directoryPath: string): ReadonlyArray<string> {
    const filePaths: string[] = [];

    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
        const entryPath: string = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
            if (entry.name.toLowerCase() !== "tests") {
                filePaths.push(...findPowerQueryFiles(entryPath));
            }
        } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pq") {
            filePaths.push(entryPath);
        }
    }

    return filePaths;
}

function parsePositiveInteger(
    value: string | undefined,
    fallback: number,
    argumentName: string,
    minimum: number,
): number {
    if (value === undefined) {
        return fallback;
    }

    const parsed: number = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < minimum) {
        throw new Error(`${argumentName} must be an integer at least ${minimum}`);
    }

    return parsed;
}

function summarize(samples: ReadonlyArray<number>): PhaseSummary {
    const sorted: ReadonlyArray<number> = [...samples].sort((left: number, right: number) => left - right);
    const trimmed: ReadonlyArray<number> = sorted.slice(1, -1);
    const sum: number = trimmed.reduce((total: number, value: number) => total + value, 0);
    const middleIndex: number = sorted.length / 2;
    const medianMs: number =
        sorted.length % 2 === 0 ? (sorted[middleIndex - 1] + sorted[middleIndex]) / 2 : sorted[Math.floor(middleIndex)];

    return {
        meanMs: sum / trimmed.length,
        medianMs,
        minMs: sorted[0],
        maxMs: sorted[sorted.length - 1],
        samplesMs: samples,
    };
}

async function benchmarkFile(filePath: string, measuredIterations: number): Promise<BenchmarkResult> {
    const rawSource: string = fs.readFileSync(filePath, "utf8");
    const hadByteOrderMark: boolean = rawSource.charCodeAt(0) === 0xfeff;
    const source: string = hadByteOrderMark ? rawSource.slice(1) : rawSource;
    let lexerSnapshot: Task.LexTaskOk["lexerSnapshot"] | undefined;

    for (let iteration: number = 0; iteration < WarmupIterations; iteration += 1) {
        const lexResult: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, source);
        TaskUtils.assertIsLexStageOk(lexResult);
        lexerSnapshot = lexResult.lexerSnapshot;
        // eslint-disable-next-line no-await-in-loop
        const parseResult: Task.TriedParseTask = await TaskUtils.tryParse(DefaultSettings, lexerSnapshot);
        TaskUtils.assertIsParseStageOk(parseResult);
    }

    const lexSamples: number[] = [];

    for (let iteration: number = 0; iteration < measuredIterations; iteration += 1) {
        const start: bigint = process.hrtime.bigint();
        const lexResult: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, source);
        lexSamples.push(elapsedMilliseconds(start));
        TaskUtils.assertIsLexStageOk(lexResult);
        lexerSnapshot = lexResult.lexerSnapshot;
    }

    if (lexerSnapshot === undefined) {
        throw new Error(`No lexer snapshot was produced for ${filePath}`);
    }

    const parseSamples: number[] = [];
    let parseSucceeded: boolean = true;
    let parseError: string | undefined;

    for (let iteration: number = 0; iteration < measuredIterations; iteration += 1) {
        const start: bigint = process.hrtime.bigint();
        // eslint-disable-next-line no-await-in-loop
        const parseResult: Task.TriedParseTask = await TaskUtils.tryParse(DefaultSettings, lexerSnapshot);
        parseSamples.push(elapsedMilliseconds(start));

        if (parseResult.resultKind !== ResultKind.Ok) {
            parseSucceeded = false;
            parseError = parseResult.error.message;
        }
    }

    const freshParseSamples: number[] = [];

    for (let iteration: number = 0; iteration < measuredIterations; iteration += 1) {
        const lexResult: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, source);
        TaskUtils.assertIsLexStageOk(lexResult);
        const start: bigint = process.hrtime.bigint();
        // eslint-disable-next-line no-await-in-loop
        const parseResult: Task.TriedParseTask = await TaskUtils.tryParse(DefaultSettings, lexResult.lexerSnapshot);
        freshParseSamples.push(elapsedMilliseconds(start));

        if (parseResult.resultKind !== ResultKind.Ok) {
            parseSucceeded = false;
            parseError = parseResult.error.message;
        }
    }

    const lex: PhaseSummary = summarize(lexSamples);
    const parse: PhaseSummary = summarize(parseSamples);
    const totalMeanMs: number = lex.meanMs + parse.meanMs;

    return {
        file: path.basename(filePath),
        filePath,
        bytes: fs.statSync(filePath).size,
        characters: source.length,
        sourceSha256: createHash("sha256").update(rawSource).digest("hex"),
        hadByteOrderMark,
        parseSucceeded,
        parseError,
        lex,
        parse,
        parseFreshSnapshot: summarize(freshParseSamples),
        totalMeanMs,
        lexPercentage: (lex.meanMs / totalMeanMs) * 100,
        parsePercentage: (parse.meanMs / totalMeanMs) * 100,
        parseToLexRatio: parse.meanMs / lex.meanMs,
    };
}

async function main(): Promise<void> {
    const dataConnectorsRoot: string | undefined = process.argv[2];

    if (dataConnectorsRoot === undefined) {
        throw new Error("Usage: npm run script:benchmark-lex-parse -- <DataConnectors root> [file count] [iterations]");
    }

    const fileCount: number = parsePositiveInteger(process.argv[3], DefaultFileCount, "file count", 1);
    const measuredIterations: number = parsePositiveInteger(
        process.argv[4],
        DefaultMeasuredIterations,
        "iterations",
        3,
    );

    const filePaths: ReadonlyArray<string> = [...findPowerQueryFiles(path.resolve(dataConnectorsRoot))]
        .sort((left: string, right: string) => fs.statSync(right).size - fs.statSync(left).size)
        .slice(0, fileCount);

    if (filePaths.length === 0) {
        throw new Error(`No .pq files found under ${dataConnectorsRoot}`);
    }

    const results: BenchmarkResult[] = [];

    for (const filePath of filePaths) {
        process.stderr.write(`Benchmarking ${path.basename(filePath)}...\n`);
        // eslint-disable-next-line no-await-in-loop
        results.push(await benchmarkFile(filePath, measuredIterations));
    }

    const aggregateLexMs: number = results.reduce(
        (total: number, result: BenchmarkResult) => total + result.lex.meanMs,
        0,
    );

    const aggregateParseMs: number = results.reduce(
        (total: number, result: BenchmarkResult) => total + result.parse.meanMs,
        0,
    );

    const aggregateTotalMs: number = aggregateLexMs + aggregateParseMs;
    const aggregateFreshParseMs: number = results.reduce(
        (total: number, result: BenchmarkResult) => total + result.parseFreshSnapshot.meanMs,
        0,
    );
    const cpu: os.CpuInfo | undefined = os.cpus()[0];

    process.stdout.write(
        JSON.stringify(
            {
                recordedAt: new Date().toISOString(),
                nodeVersion: process.version,
                platform: `${os.type()} ${os.release()}`,
                cpu: cpu?.model,
                parser: "CombinatorialParserV2 (DefaultSettings)",
                dataConnectorsRoot: path.resolve(dataConnectorsRoot),
                fileCount,
                warmupIterations: WarmupIterations,
                measuredIterations,
                parseMode: "Repeated parsing of one snapshot, followed by fresh snapshots with lexing excluded",
                outlierPolicy: `Drop one fastest and one slowest sample; mean remaining ${measuredIterations - 2}`,
                results,
                aggregate: {
                    lexMs: aggregateLexMs,
                    parseMs: aggregateParseMs,
                    parseFreshSnapshotMs: aggregateFreshParseMs,
                    totalMs: aggregateTotalMs,
                    lexPercentage: (aggregateLexMs / aggregateTotalMs) * 100,
                    parsePercentage: (aggregateParseMs / aggregateTotalMs) * 100,
                    parseToLexRatio: aggregateParseMs / aggregateLexMs,
                },
            },
            undefined,
            2,
        ),
    );

    if (results.some((result: BenchmarkResult) => !result.parseSucceeded)) {
        throw new Error("Benchmark included unsuccessful parses; timings are not comparable to successful parses");
    }
}

void main();
