// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT license.

// import { expect } from "chai";
// import "mocha";
// import { LexerSnapshot } from "../../lexer";
// import { DefaultTemplates } from "../../localization";
// import { IParser, IParserState, IParserStateUtils } from "../../parser";
// import { CombinatorialParser } from "../../parser/parsers";
// import { ParseSettings } from "../../settings";
// import { BenchmarkParser, BenchmarkState } from "./benchmarkParser";

// function createCombinatorialBenchmarkState(
//     settings: ParseSettings<BenchmarkState>,
//     lexerSnapshot: LexerSnapshot,
// ): BenchmarkState {
//     return createBenchmarkState(settings, lexerSnapshot, CombinatorialParser);
// }

// function createBenchmarkState(
//     settings: ParseSettings<BenchmarkState>,
//     lexerSnapshot: LexerSnapshot,
//     baseParser: IParser<IParserState>,
// ): BenchmarkState {
//     return {
//         ...IParserStateUtils.newState(settings, lexerSnapshot),
//         baseParser,
//         functionTimestamps: new Map(),
//         functionTimestampCounter: 0,
//     };
// }

// function createBenchmarkParseSettings(
//     newParserStateFn: (settings: ParseSettings<BenchmarkState>, lexerSnapshot: LexerSnapshot) => BenchmarkState,
// ): ParseSettings<BenchmarkState> {
//     return {
//         localizationTemplates: DefaultTemplates,
//         parser: BenchmarkParser,
//         newParserState: newParserStateFn,
//     };
// }

// describe("Parser.Error", () => {
//     it(`Dangling Comma for TableType`, () => {});
// });
