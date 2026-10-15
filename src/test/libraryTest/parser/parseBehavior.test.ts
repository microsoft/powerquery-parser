// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { rejects } from "assert";

import * as ParserTestUtils from "./parserTestUtils";
import {
    Assert,
    CommonError,
    CounterCancellationToken,
    DefaultSettings,
    Language,
    NoOpCancellationToken,
    Parser,
    Task,
    TaskUtils,
} from "../../../powerquery-parser";
import { Trace, TraceConstant, TraceManager } from "../../../powerquery-parser/common/trace";
import { AssertTestUtils } from "../../testUtils";
import { Ast } from "../../../powerquery-parser/language";
import { NodeKind } from "../../../powerquery-parser/language/ast/ast";
import { ParseBehavior } from "../../../powerquery-parser/parser/parseBehavior";
import { ParseError } from "../../../powerquery-parser/parser";

describe("ParseBehavior", () => {
    async function runParseBehaviorTest(params: {
        readonly parseBehavior: ParseBehavior;
        readonly text: string;
        readonly expectedAbridgedNodes: ReadonlyArray<ParserTestUtils.AbridgedNode>;
        readonly expectedStatus: "ExpectedAnyTokenKindError" | "ExpectedTokenKindError" | "ParseStageOk";
    }): Promise<Task.ParseTaskOk | Task.ParseTaskParseError> {
        const result: Task.ParseTaskOk | Task.ParseTaskParseError = await ParserTestUtils.runAbridgedNodeTest(
            params.text,
            params.expectedAbridgedNodes,
            {
                astOnly: true,
                settings: {
                    ...DefaultSettings,
                    parseBehavior: params.parseBehavior,
                },
            },
        );

        switch (params.expectedStatus) {
            case "ExpectedAnyTokenKindError":
                TaskUtils.assertIsParseStageError(result);
                expect(result.error.innerError).to.be.instanceOf(ParseError.ExpectedAnyTokenKindError);
                break;

            case "ExpectedTokenKindError":
                TaskUtils.assertIsParseStageError(result);
                expect(result.error.innerError).to.be.instanceOf(ParseError.ExpectedTokenKindError);
                break;

            case "ParseStageOk":
                TaskUtils.assertIsParseStageOk(result);
                break;

            default:
                throw Assert.isNever(params.expectedStatus);
        }

        return result;
    }

    it(`1 // with ParseEitherExpressionOrSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseEitherExpressionOrSection,
            text: `1`,
            expectedAbridgedNodes: [[NodeKind.LiteralExpression, undefined]],
            expectedStatus: "ParseStageOk",
        });
    });

    it(`1 // with ParseExpression`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseExpression,
            text: `1`,
            expectedAbridgedNodes: [[NodeKind.LiteralExpression, undefined]],
            expectedStatus: "ParseStageOk",
        });
    });

    it(`1 // with ParseSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseSection,
            text: `1`,
            expectedAbridgedNodes: [],
            expectedStatus: "ExpectedTokenKindError",
        });
    });

    it(`section Foo; shared Bar = 1; // with ParseEitherExpressionOrSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseEitherExpressionOrSection,
            text: `section Foo; shared Bar = 1;`,
            expectedAbridgedNodes: [
                [NodeKind.Section, undefined],
                [NodeKind.Constant, 1],
                [NodeKind.Identifier, 2],
                [NodeKind.Constant, 3],
                [NodeKind.ArrayWrapper, 4],
                [NodeKind.SectionMember, 0],
                [NodeKind.Constant, 1],
                [NodeKind.IdentifierPairedExpression, 2],
                [NodeKind.Identifier, 0],
                [NodeKind.Constant, 1],
                [NodeKind.LiteralExpression, 2],
                [NodeKind.Constant, 3],
            ],
            expectedStatus: "ParseStageOk",
        });
    });

    it(`section Foo; shared Bar = 1; // with ParseExpression`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseExpression,
            text: `section Foo; shared Bar = 1;`,
            expectedAbridgedNodes: [],
            expectedStatus: "ExpectedAnyTokenKindError",
        });
    });

    it(`section Foo; shared Bar = 1; // with ParseSection`, async () => {
        await runParseBehaviorTest({
            parseBehavior: ParseBehavior.ParseSection,
            text: `section Foo; shared Bar = 1;`,
            expectedAbridgedNodes: [
                [NodeKind.Section, undefined],
                [NodeKind.Constant, 1],
                [NodeKind.Identifier, 2],
                [NodeKind.Constant, 3],
                [NodeKind.ArrayWrapper, 4],
                [NodeKind.SectionMember, 0],
                [NodeKind.Constant, 1],
                [NodeKind.IdentifierPairedExpression, 2],
                [NodeKind.Identifier, 0],
                [NodeKind.Constant, 1],
                [NodeKind.LiteralExpression, 2],
                [NodeKind.Constant, 3],
            ],
            expectedStatus: "ParseStageOk",
        });
    });

    it(`invalid parseBehavior throws InvariantError`, async () => {
        // Missing `throw` before Assert.isNever means TypeScript
        // doesn't guarantee the default branch is recognized as unreachable.
        // Verify the default branch actually throws for invalid enum values.
        const invalidBehavior: ParseBehavior = "InvalidBehavior" as unknown as ParseBehavior;

        let threw: boolean = false;

        try {
            await TaskUtils.tryLexParse(
                {
                    ...DefaultSettings,
                    parseBehavior: invalidBehavior,
                },
                "1",
            );
        } catch (error: unknown) {
            threw = true;
            expect((error as Error).message).to.contain("Should never be reached");
        }

        expect(threw).to.equal(true, "An invalid parseBehavior should throw an InvariantError");
    });
});

type ParseOk = Awaited<ReturnType<typeof AssertTestUtils.assertGetLexParseOk>>;

describe("Type directives - regression", () => {
    // BUG: type directive scoping — directive on x's line incorrectly attaches to y
    xit("should not attach directive from previous variable to next variable", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            `let
    x = 1, /// @type number
    y = 2
in
    y`,
        );

        const letExpression: Language.Ast.LetExpression = parseOk.ast as Language.Ast.LetExpression;
        const yVariable: Language.Ast.IdentifierPairedExpression = letExpression.variableList.elements[1]!.node;

        expect(yVariable.precedingDirectives).to.equal(undefined, "y should not have directives from x's line");
    });

    it("should handle multiple consecutive directives in correct order", async () => {
        const parseOk: ParseOk = await AssertTestUtils.assertGetLexParseOk(
            {
                ...DefaultSettings,
                isTypeDirectiveAllowed: true,
            },
            `let
    /// @type text
    /// @type number
    value = []
in
    value`,
        );

        const letExpression: Language.Ast.LetExpression = parseOk.ast as Language.Ast.LetExpression;
        const variable: Language.Ast.IdentifierPairedExpression = letExpression.variableList.elements[0]!.node;

        expect(variable.precedingDirectives).to.not.equal(undefined);
        expect(variable.precedingDirectives?.length).to.equal(2);

        expect(
            variable.precedingDirectives?.map((directive: Language.Comment.TDirective) => directive.value),
        ).to.deep.equal(["text", "number"]);
    });
});

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
