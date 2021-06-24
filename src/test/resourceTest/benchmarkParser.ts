// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import { Language, Lexer, ParseSettings, TypeScriptUtils } from "../..";
import { Parser, ParserUtils, ParseState, ParseStateCheckpoint, ParseStateUtils } from "../../powerquery-parser/parser";

export interface BenchmarkState extends ParseState {
    readonly baseParser: Parser;
    readonly functionTimestamps: Map<number, FunctionTimestamp>;
    functionTimestampCounter: number;
}

export interface FunctionTimestamp {
    readonly id: number;
    readonly fnName: string;
    readonly lineNumberStart: number;
    readonly lineCodeUnitStart: number;
    readonly codeUnitStart: number;
    lineNumberEnd: number | undefined;
    lineCodeUnitEnd: number | undefined;
    codeUnitEnd: number | undefined;
    readonly timeStart: number;
    timeEnd: number | undefined;
    timeDuration: number | undefined;
}

export const BenchmarkParser: Parser = {
    applyState: (state: ParseState, update: ParseState) => {
        const mutableState: TypeScriptUtils.StripReadonly<BenchmarkState> = state as BenchmarkState;
        ParseStateUtils.applyState(mutableState, update);
        mutableState.functionTimestamps = (update as BenchmarkState).functionTimestamps;
        mutableState.functionTimestampCounter = (update as BenchmarkState).functionTimestampCounter;
    },
    copyState: (state: ParseState) => {
        const benchmarkState: BenchmarkState = state as BenchmarkState;

        return {
            ...ParseStateUtils.copyState(state),
            baseParser: benchmarkState.baseParser,
            functionTimestampCounter: benchmarkState.functionTimestampCounter,
            functionTimestamps: new Map(
                [
                    ...benchmarkState.functionTimestamps.entries(),
                ].map(([counter, functionTimestamp]: [number, FunctionTimestamp]) => [
                    counter,
                    { ...functionTimestamp },
                ]),
            ),
        };
    },
    createCheckpoint: (state: ParseState) => ParserUtils.createCheckpoint(state),
    restoreCheckpoint: (state: ParseState, checkpoint: ParseStateCheckpoint) =>
        ParserUtils.restoreCheckpoint(state, checkpoint),

    // 12.1.6 Identifiers
    readIdentifier: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readIdentifier),

    readGeneralizedIdentifier: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readGeneralizedIdentifier),
    readKeyword: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readKeyword),

    // 12.2.1 Documents
    readDocument: (state: ParseState, parser: Parser) => {
        const readDocumentLambda: () => Language.Ast.TDocument = () =>
            (state as BenchmarkState).baseParser.readDocument(state, parser) as Language.Ast.TDocument;
        return traceFunction(state, parser, readDocumentLambda);
    },

    // 12.2.2 Section Documents
    readSectionDocument: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readSectionDocument),
    readSectionMembers: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readSectionMembers),
    readSectionMember: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readSectionMember),

    // 12.2.3.1 Expressions
    readNullCoalescingExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readNullCoalescingExpression),
    readExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readExpression),

    // 12.2.3.2 Logical expressions
    readLogicalExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readLogicalExpression),

    // 12.2.3.3 Is expression
    readIsExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readIsExpression),
    readNullablePrimitiveType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readNullablePrimitiveType),

    // 12.2.3.4 As expression
    readAsExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readAsExpression),

    // 12.2.3.5 Equality expression
    readEqualityExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readEqualityExpression),

    // 12.2.3.6 Relational expression
    readRelationalExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readRelationalExpression),

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readArithmeticExpression),

    // 12.2.3.8 Metadata expression
    readMetadataExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readMetadataExpression),

    // 12.2.3.9 Unary expression
    readUnaryExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readUnaryExpression),

    // 12.2.3.10 Primary expression
    readPrimaryExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readPrimaryExpression),
    readRecursivePrimaryExpression: (state: ParseState, parser: Parser, head) => {
        const readRecursivePrimaryExpressionLambda: () => Language.Ast.RecursivePrimaryExpression = () =>
            (state as BenchmarkState).baseParser.readRecursivePrimaryExpression(state, parser, head);
        return traceFunction(state, parser, readRecursivePrimaryExpressionLambda);
    },

    // 12.2.3.11 Literal expression
    readLiteralExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readLiteralExpression),

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readIdentifierExpression),

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readParenthesizedExpression),

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readNotImplementedExpression),

    // 12.2.3.16 Invoke expression
    readInvokeExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readInvokeExpression),

    // 12.2.3.17 List expression
    readListExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readListExpression),
    readListItem: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readListItem),

    // 12.2.3.18 Record expression
    readRecordExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readRecordExpression),

    // 12.2.3.19 Item access expression
    readItemAccessExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readItemAccessExpression),

    // 12.2.3.20 Field access expression
    readFieldSelection: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readFieldSelection),
    readFieldProjection: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readFieldProjection),
    readFieldSelector: (state: ParseState, parser: Parser, allowOptional: boolean) => {
        const readFieldSelectorLambda: () => Language.Ast.FieldSelector = () =>
            (state as BenchmarkState).baseParser.readFieldSelector(state, parser, allowOptional);
        return traceFunction(state, parser, readFieldSelectorLambda);
    },

    // 12.2.3.21 Function expression
    readFunctionExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readFunctionExpression),
    readParameterList: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readParameterList),
    readAsType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readAsType),

    // 12.2.3.22 Each expression
    readEachExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readEachExpression),

    // 12.2.3.23 Let expression
    readLetExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readLetExpression),

    // 12.2.3.24 If expression
    readIfExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readIfExpression),

    // 12.2.3.25 Type expression
    readTypeExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readTypeExpression),
    readType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readType),
    readPrimaryType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readPrimaryType),
    readRecordType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readRecordType),
    readTableType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readTableType),
    readFieldSpecificationList: (state: ParseState, parser: Parser, allowOpenMarker: boolean, testPostCommaError) => {
        const readFieldSpecificationListLambda: () => Language.Ast.FieldSpecificationList = () =>
            (state as BenchmarkState).baseParser.readFieldSpecificationList(
                state,
                parser,
                allowOpenMarker,
                testPostCommaError,
            );
        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readListType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readListType),
    readFunctionType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readFunctionType),
    readParameterSpecificationList: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readParameterSpecificationList),
    readNullableType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readNullableType),

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readErrorRaisingExpression),

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readErrorHandlingExpression),

    // 12.2.4 Literal Attributes
    readRecordLiteral: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readRecordLiteral),
    readFieldNamePairedAnyLiterals: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldNamePairedAnyLiteralsLambda: () => Language.Ast.ICsvArray<
            Language.Ast.GeneralizedIdentifierPairedAnyLiteral
        > = () =>
            (state as BenchmarkState).baseParser.readFieldNamePairedAnyLiterals(
                state,
                parser,
                onePairRequired,
                testPostCommaError,
            );

        return traceFunction(state, parser, readFieldNamePairedAnyLiteralsLambda);
    },
    readListLiteral: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readListLiteral),
    readAnyLiteral: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readAnyLiteral),
    readPrimitiveType: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readPrimitiveType),

    // key-value pairs
    readIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.ICsvArray<
            Language.Ast.IdentifierPairedExpression
        > = () =>
            (state as BenchmarkState).baseParser.readIdentifierPairedExpressions(
                state,
                parser,
                onePairRequired,
                testPostCommaError,
            );

        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readIdentifierPairedExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readIdentifierPairedExpression),
    readGeneralizedIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.ICsvArray<
            Language.Ast.GeneralizedIdentifierPairedExpression
        > = () =>
            (state as BenchmarkState).baseParser.readGeneralizedIdentifierPairedExpressions(
                state,
                parser,
                onePairRequired,
                testPostCommaError,
            );
        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readGeneralizedIdentifierPairedExpression: (state: ParseState, parser: Parser) =>
        traceFunction(state, parser, (state as BenchmarkState).baseParser.readGeneralizedIdentifierPairedExpression),
};

export function createBenchmarkState(
    parseSettings: ParseSettings,
    lexerSnapshot: Lexer.LexerSnapshot,
    baseParser: Parser,
): BenchmarkState {
    return {
        ...ParseStateUtils.createState(lexerSnapshot, {
            maybeCancellationToken: parseSettings.maybeCancellationToken,
        }),
        baseParser,
        functionTimestamps: new Map(),
        functionTimestampCounter: 0,
    };
}

function traceFunction<T>(
    benchmarkState: ParseState,
    benchmarkParser: Parser,
    tracedFn: (state: ParseState, parser: Parser) => T,
): T {
    const fnCallId: number = functionEntry(benchmarkState, tracedFn);
    const result: T = tracedFn(benchmarkState, benchmarkParser);
    functionExit(benchmarkState, fnCallId);
    return result;
}

function functionEntry<T>(state: ParseState, fn: (state: ParseState, parser: Parser) => T): number {
    const tokenPosition: Language.Token.TokenPosition = state.maybeCurrentToken!.positionStart;
    const benchmarkState: BenchmarkState = state as BenchmarkState;

    const id: number = benchmarkState.functionTimestampCounter;
    benchmarkState.functionTimestampCounter += 1;

    const functionTimestamp: FunctionTimestamp = {
        id,
        fnName: fn.name,
        lineNumberStart: tokenPosition.lineNumber,
        lineCodeUnitStart: tokenPosition.lineCodeUnit,
        codeUnitStart: tokenPosition.codeUnit,
        lineNumberEnd: undefined,
        lineCodeUnitEnd: undefined,
        codeUnitEnd: undefined,
        timeStart: performanceNow(),
        timeEnd: undefined,
        timeDuration: undefined,
    };
    benchmarkState.functionTimestamps.set(id, functionTimestamp);

    return id;
}

function functionExit(state: ParseState, id: number): void {
    const tokenPosition: Language.Token.TokenPosition = state.maybeCurrentToken!.positionStart;
    const fnTimestamp: FunctionTimestamp = (state as BenchmarkState).functionTimestamps.get(id)!;
    const finish: number = performanceNow();
    const duration: number = finish - fnTimestamp.timeStart;

    fnTimestamp.timeEnd = finish;
    fnTimestamp.timeDuration = duration;
    fnTimestamp.lineNumberEnd = tokenPosition.lineNumber;
    fnTimestamp.lineCodeUnitEnd = tokenPosition.lineCodeUnit;
    fnTimestamp.codeUnitEnd = tokenPosition.codeUnit;
}
