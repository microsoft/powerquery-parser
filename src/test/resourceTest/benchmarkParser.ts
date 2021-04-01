// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import { Language, Lexer, Parser, ParseSettings, TypeScriptUtils } from "../..";

export interface BenchmarkState extends Parser.IParseState {
    readonly baseParser: Parser.IParser<Parser.IParseState>;
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

export const BenchmarkParser: Parser.IParser<BenchmarkState> = {
    applyState: (state: BenchmarkState, update: BenchmarkState) => {
        const mutableState: TypeScriptUtils.StripReadonly<BenchmarkState> = state;
        Parser.IParseStateUtils.applyState(mutableState, update);
        mutableState.functionTimestamps = update.functionTimestamps;
        mutableState.functionTimestampCounter = update.functionTimestampCounter;
    },
    copyState: (state: BenchmarkState) => {
        return {
            ...Parser.IParseStateUtils.copyState(state),
            baseParser: state.baseParser,
            functionTimestampCounter: state.functionTimestampCounter,
            functionTimestamps: new Map(
                [
                    ...state.functionTimestamps.entries(),
                ].map(([counter, functionTimestamp]: [number, FunctionTimestamp]) => [
                    counter,
                    { ...functionTimestamp },
                ]),
            ),
        };
    },
    createCheckpoint: (state: Parser.IParseState) => Parser.IParserUtils.createCheckpoint(state),
    restoreCheckpoint: (state: Parser.IParseState, checkpoint: Parser.IParseStateCheckpoint) =>
        Parser.IParserUtils.restoreCheckpoint(state, checkpoint),

    // 12.1.6 Identifiers
    readIdentifier: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIdentifier),

    readGeneralizedIdentifier: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readGeneralizedIdentifier),
    readKeyword: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readKeyword),

    // 12.2.1 Documents
    readDocument: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) => {
        const readDocumentLambda: () => Language.Ast.TDocument = () =>
            state.baseParser.readDocument(
                state,
                (parser as unknown) as Parser.IParser<Parser.IParseState>,
            ) as Language.Ast.TDocument;
        return traceFunction(state, parser, readDocumentLambda);
    },

    // 12.2.2 Section Documents
    readSectionDocument: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readSectionDocument),
    readSectionMembers: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readSectionMembers),
    readSectionMember: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readSectionMember),

    // 12.2.3.1 Expressions
    readNullCoalescingExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readNullCoalescingExpression),
    readExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readExpression),

    // 12.2.3.2 Logical expressions
    readLogicalExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readLogicalExpression),

    // 12.2.3.3 Is expression
    readIsExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIsExpression),
    readNullablePrimitiveType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readNullablePrimitiveType),

    // 12.2.3.4 As expression
    readAsExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readAsExpression),

    // 12.2.3.5 Equality expression
    readEqualityExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readEqualityExpression),

    // 12.2.3.6 Relational expression
    readRelationalExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRelationalExpression),

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readArithmeticExpression),

    // 12.2.3.8 Metadata expression
    readMetadataExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readMetadataExpression),

    // 12.2.3.9 Unary expression
    readUnaryExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readUnaryExpression),

    // 12.2.3.10 Primary expression
    readPrimaryExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readPrimaryExpression),
    readRecursivePrimaryExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>, head) => {
        const readRecursivePrimaryExpressionLambda: () => Language.Ast.RecursivePrimaryExpression = () =>
            state.baseParser.readRecursivePrimaryExpression(
                state,
                (parser as unknown) as Parser.IParser<Parser.IParseState>,
                head,
            );
        return traceFunction(state, parser, readRecursivePrimaryExpressionLambda);
    },

    // 12.2.3.11 Literal expression
    readLiteralExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readLiteralExpression),

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIdentifierExpression),

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readParenthesizedExpression),

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readNotImplementedExpression),

    // 12.2.3.16 Invoke expression
    readInvokeExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readInvokeExpression),

    // 12.2.3.17 List expression
    readListExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListExpression),
    readListItem: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListItem),

    // 12.2.3.18 Record expression
    readRecordExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRecordExpression),

    // 12.2.3.19 Item access expression
    readItemAccessExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readItemAccessExpression),

    // 12.2.3.20 Field access expression
    readFieldSelection: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFieldSelection),
    readFieldProjection: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFieldProjection),
    readFieldSelector: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>, allowOptional: boolean) => {
        const readFieldSelectorLambda: () => Language.Ast.FieldSelector = () =>
            state.baseParser.readFieldSelector(
                state,
                (parser as unknown) as Parser.IParser<Parser.IParseState>,
                allowOptional,
            );
        return traceFunction(state, parser, readFieldSelectorLambda);
    },

    // 12.2.3.21 Function expression
    readFunctionExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFunctionExpression),
    readParameterList: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readParameterList),
    readAsType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readAsType),

    // 12.2.3.22 Each expression
    readEachExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readEachExpression),

    // 12.2.3.23 Let expression
    readLetExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readLetExpression),

    // 12.2.3.24 If expression
    readIfExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIfExpression),

    // 12.2.3.25 Type expression
    readTypeExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readTypeExpression),
    readType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readType),
    readPrimaryType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readPrimaryType),
    readRecordType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRecordType),
    readTableType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readTableType),
    readFieldSpecificationList: (
        state: BenchmarkState,
        parser: Parser.IParser<BenchmarkState>,
        allowOpenMarker: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.FieldSpecificationList = () =>
            state.baseParser.readFieldSpecificationList(
                state,
                (parser as unknown) as Parser.IParser<Parser.IParseState>,
                allowOpenMarker,
                testPostCommaError,
            );
        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readListType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListType),
    readFunctionType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFunctionType),
    readParameterSpecificationList: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readParameterSpecificationList),
    readNullableType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readNullableType),

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readErrorRaisingExpression),

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readErrorHandlingExpression),

    // 12.2.4 Literal Attributes
    readRecordLiteral: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRecordLiteral),
    readFieldNamePairedAnyLiterals: (
        state: BenchmarkState,
        parser: Parser.IParser<BenchmarkState>,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldNamePairedAnyLiteralsLambda: () => Language.Ast.ICsvArray<
            Language.Ast.GeneralizedIdentifierPairedAnyLiteral
        > = () =>
            state.baseParser.readFieldNamePairedAnyLiterals(
                state,
                (parser as unknown) as Parser.IParser<Parser.IParseState>,
                onePairRequired,
                testPostCommaError,
            );

        return traceFunction(state, parser, readFieldNamePairedAnyLiteralsLambda);
    },
    readListLiteral: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListLiteral),
    readAnyLiteral: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readAnyLiteral),
    readPrimitiveType: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readPrimitiveType),

    // key-value pairs
    readIdentifierPairedExpressions: (
        state: BenchmarkState,
        parser: Parser.IParser<BenchmarkState>,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.ICsvArray<
            Language.Ast.IdentifierPairedExpression
        > = () =>
            state.baseParser.readIdentifierPairedExpressions(
                state,
                (parser as unknown) as Parser.IParser<Parser.IParseState>,
                onePairRequired,
                testPostCommaError,
            );

        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readIdentifierPairedExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIdentifierPairedExpression),
    readGeneralizedIdentifierPairedExpressions: (
        state: BenchmarkState,
        parser: Parser.IParser<BenchmarkState>,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.ICsvArray<
            Language.Ast.GeneralizedIdentifierPairedExpression
        > = () =>
            state.baseParser.readGeneralizedIdentifierPairedExpressions(
                state,
                (parser as unknown) as Parser.IParser<Parser.IParseState>,
                onePairRequired,
                testPostCommaError,
            );
        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readGeneralizedIdentifierPairedExpression: (state: BenchmarkState, parser: Parser.IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readGeneralizedIdentifierPairedExpression),
};

export function createBenchmarkState<S extends Parser.IParseState = Parser.IParseState>(
    parseSettings: ParseSettings<S>,
    lexerSnapshot: Lexer.LexerSnapshot,
    baseParser: Parser.IParser<Parser.IParseState>,
): BenchmarkState {
    return {
        ...Parser.IParseStateUtils.createState(lexerSnapshot, {
            maybeCancellationToken: parseSettings.maybeCancellationToken,
        }),
        baseParser,
        functionTimestamps: new Map(),
        functionTimestampCounter: 0,
    };
}

function traceFunction<T>(
    benchmarkState: BenchmarkState,
    benchmarkParser: Parser.IParser<BenchmarkState>,
    tracedFn: (state: Parser.IParseState, parser: Parser.IParser<Parser.IParseState>) => T,
): T {
    const fnCallId: number = functionEntry(benchmarkState, tracedFn);
    const result: T = tracedFn(benchmarkState, (benchmarkParser as unknown) as Parser.IParser<Parser.IParseState>);
    functionExit(benchmarkState, fnCallId);
    return result;
}

function functionEntry<S extends Parser.IParseState, T>(
    state: BenchmarkState,
    fn: (state: S, parser: Parser.IParser<S>) => T,
): number {
    const tokenPosition: Language.Token.TokenPosition = state.maybeCurrentToken!.positionStart;
    const id: number = state.functionTimestampCounter;
    state.functionTimestampCounter += 1;

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
    state.functionTimestamps.set(id, functionTimestamp);

    return id;
}

function functionExit(state: BenchmarkState, id: number): void {
    const tokenPosition: Language.Token.TokenPosition = state.maybeCurrentToken!.positionStart;
    const fnTimestamp: FunctionTimestamp = state.functionTimestamps.get(id)!;
    const finish: number = performanceNow();
    const duration: number = finish - fnTimestamp.timeStart;

    fnTimestamp.timeEnd = finish;
    fnTimestamp.timeDuration = duration;
    fnTimestamp.lineNumberEnd = tokenPosition.lineNumber;
    fnTimestamp.lineCodeUnitEnd = tokenPosition.lineCodeUnit;
    fnTimestamp.codeUnitEnd = tokenPosition.codeUnit;
}
