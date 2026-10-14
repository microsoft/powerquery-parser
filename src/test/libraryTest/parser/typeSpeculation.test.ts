// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { rejects } from "assert";

import {
    CommonError,
    CounterCancellationToken,
    DefaultSettings,
    NoOpCancellationToken,
    Parser,
    Task,
    TaskUtils,
} from "../../..";
import { Trace, TraceConstant, TraceManager } from "../../../powerquery-parser/common/trace";
import { Ast } from "../../../powerquery-parser/language";

// Strict primary-type reads still perform speculation. Only an unconsumed primitive-type
// failure is discarded here, reproducing readType's fallback without using its prediction.
async function readTypeWithoutPrediction(
    state: Parser.ParseState,
    parser: Parser.Parser,
    correlationId: number | undefined,
): Promise<Ast.TType> {
    const tokenIndex: number = state.tokenIndex;

    try {
        return await parser.readPrimaryType(state, parser, correlationId);
    } catch (error: unknown) {
        if (
            state.tokenIndex !== tokenIndex ||
            !(
                error instanceof Parser.ParseError.InvalidPrimitiveTypeError ||
                error instanceof Parser.ParseError.ExpectedAnyTokenKindError
            )
        ) {
            throw error;
        }

        return parser.readPrimaryExpression(state, parser, correlationId);
    }
}

class RecordingTraceManager extends TraceManager {
    public readonly events: { trace: Trace; message: string }[] = [];

    public emit(trace: Trace, message: string): void {
        this.events.push({ trace, message });
    }
}

function newState(overrides?: Partial<Parser.ParseState>): Parser.ParseState {
    const lex: Task.TriedLexTask = TaskUtils.tryLex(DefaultSettings, "unknown");
    TaskUtils.assertIsLexStageOk(lex);
    const state: Parser.ParseState = Parser.ParseStateUtils.newState(lex.lexerSnapshot, overrides);
    Parser.ParseStateUtils.startContext(state, Ast.NodeKind.ListType);

    return state;
}

describe("Parser primary-type prediction", () => {
    for (const parser of [Parser.CombinatorialParserV2, Parser.RecursiveDescentParser]) {
        for (const text of [
            "let a = type unknown in a",
            "let a = type (1 + 2) in a",
            "let a = type @unknown in a",
            "let a = type 1 in a",
            "let a = type in a",
            "let a = type table [x=",
            "let a = type function (x as",
            "let a = type function (x as number) as ",
            "let a = type [x = number] in a",
            "let a = type nullable number in a",
            "(x as number) as nullable number => x",
        ]) {
            it(`preserves full parse results for ${text}`, async () => {
                const actual: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                    { ...DefaultSettings, parser },
                    text,
                );

                const expected: Task.TriedLexParseTask = await TaskUtils.tryLexParse(
                    { ...DefaultSettings, parser: { ...parser, readType: readTypeWithoutPrediction } },
                    text,
                );

                expect(actual).to.deep.equal(expected);

                expect("nodeIdMapCollection" in actual ? actual.nodeIdMapCollection : undefined).to.deep.equal(
                    "nodeIdMapCollection" in expected ? expected.nodeIdMapCollection : undefined,
                );

                expect("parseState" in actual ? actual.parseState : undefined).to.deep.equal(
                    "parseState" in expected ? expected.parseState : undefined,
                );
            });
        }

        it("skips speculation with a cancellation token and custom parser hooks", async () => {
            const state: Parser.ParseState = newState({ cancellationToken: NoOpCancellationToken });
            let primaryReads: number = 0;

            const customParser: Parser.Parser = {
                ...parser,
                checkpoint: (): never => {
                    throw new Error("The skipped attempt must not create a checkpoint");
                },
                restoreCheckpoint: (): never => {
                    throw new Error("The skipped attempt must not restore a checkpoint");
                },
                readPrimaryExpression: async (
                    state: Parser.ParseState,
                    parser: Parser.Parser,
                    correlationId: number | undefined,
                ): Promise<Ast.TPrimaryExpression> => {
                    primaryReads += 1;

                    return await Parser.NaiveParseSteps.readPrimaryExpression(state, parser, correlationId);
                },
            };

            const result: Ast.TType = await customParser.readType(state, customParser, undefined);
            expect(result.kind).to.equal(Ast.NodeKind.IdentifierExpression);
            expect(primaryReads).to.equal(1);
        });

        it("traces only executed reads with matching entries, exits, and correlations", async () => {
            const traceManager: RecordingTraceManager = new RecordingTraceManager();
            const state: Parser.ParseState = newState({ traceManager });
            await parser.readType(state, parser, undefined);

            const entries: Map<number, Trace> = new Map();
            const exits: Set<number> = new Set();

            for (const { trace, message } of traceManager.events) {
                if (message === TraceConstant.Entry) {
                    expect(entries.has(trace.id)).to.equal(false);

                    if (trace.correlationId !== undefined) {
                        expect(entries.has(trace.correlationId)).to.equal(true);
                    }

                    entries.set(trace.id, trace);
                } else if (message === TraceConstant.Exit) {
                    expect(entries.has(trace.id)).to.equal(true);
                    expect(exits.has(trace.id)).to.equal(false);
                    exits.add(trace.id);
                }
            }

            const tasks: string[] = [...entries.values()].map((trace: Trace) => trace.task);
            expect(tasks).to.include("readType");
            expect(tasks).to.include("readPrimaryExpression");
            expect(tasks).not.to.include("tryReadPrimaryType");
            expect(tasks).not.to.include("tryReadPrimitiveType");
            expect(exits.size).to.equal(entries.size);
        });

        it("honors cancellation before prediction", async () => {
            const state: Parser.ParseState = newState({ cancellationToken: new CounterCancellationToken(1) });
            const tokenIndex: number = state.tokenIndex;
            const idCounter: number = state.contextState.idCounter;
            await rejects(parser.readType(state, parser, undefined), CommonError.CancellationError);
            expect(state.tokenIndex).to.equal(tokenIndex);
            expect(state.contextState.idCounter).to.equal(idCounter);
        });

        it("honors cancellation when entering the primary-expression fallback", async () => {
            const state: Parser.ParseState = newState({ cancellationToken: new CounterCancellationToken(2) });
            let enteredFallback: boolean = false;

            const customParser: Parser.Parser = {
                ...parser,
                readPrimaryExpression: async (
                    state: Parser.ParseState,
                    parser: Parser.Parser,
                    correlationId: number | undefined,
                ): Promise<Ast.TPrimaryExpression> => {
                    enteredFallback = true;

                    return await Parser.NaiveParseSteps.readPrimaryExpression(state, parser, correlationId);
                },
            };

            await rejects(customParser.readType(state, customParser, undefined), CommonError.CancellationError);
            expect(enteredFallback).to.equal(true);
            expect(state.tokenIndex).to.equal(0);
        });

        it("retains strict primitive-type diagnostics and their checkpoint hooks", async () => {
            let checkpoints: number = 0;

            const customParser: Parser.Parser = {
                ...parser,
                checkpoint: (state: Parser.ParseState): Promise<Parser.ParseStateCheckpoint> => {
                    checkpoints += 1;

                    return parser.checkpoint(state);
                },
            };

            await rejects(
                customParser.readPrimaryType(newState(), customParser, undefined),
                Parser.ParseError.InvalidPrimitiveTypeError,
            );

            expect(checkpoints).to.be.greaterThan(0);
        });

        it("retains EOF rollback and clears the stale cached token", async () => {
            const state: Parser.ParseState = newState();
            state.tokenIndex = state.lexerSnapshot.tokens.length;
            state.currentTokenKind = undefined;
            expect(state.currentToken).not.to.equal(undefined);
            let checkpoints: number = 0;

            const customParser: Parser.Parser = {
                ...parser,
                checkpoint: (state: Parser.ParseState): Promise<Parser.ParseStateCheckpoint> => {
                    checkpoints += 1;

                    return parser.checkpoint(state);
                },
            };

            await rejects(customParser.readType(state, customParser, undefined));
            expect(checkpoints).to.be.greaterThan(0);
            expect(state.currentToken).to.equal(undefined);
        });
    }
});
