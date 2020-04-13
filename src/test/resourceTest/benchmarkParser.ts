// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import { IParser, TriedParse } from "../../parser/IParser";
import { IParserState, IParserStateUtils } from "../../parser/IParserState";
import { ParseSettings } from "../../settings";
import { Language } from "../..";
import { LexerSnapshot } from "../../lexer";

export interface BenchmarkState extends IParserState {
    readonly baseParser: IParser<IParserState>;
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

export const BenchmarkParser: IParser<BenchmarkState> = {
    // 12.1.6 Identifiers
    readIdentifier: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIdentifier),

    readGeneralizedIdentifier: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readGeneralizedIdentifier),
    readKeyword: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readKeyword),

    // 12.2.1 Documents
    readDocument: (state: BenchmarkState, parser: IParser<BenchmarkState>) => {
        const readDocumentLambda: () => TriedParse<BenchmarkState> = () =>
            state.baseParser.readDocument(state, (parser as unknown) as IParser<IParserState>) as TriedParse<
                BenchmarkState
            >;
        return traceFunction(state, parser, readDocumentLambda);
    },

    // 12.2.2 Section Documents
    readSectionDocument: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readSectionDocument),
    readSectionMembers: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readSectionMembers),
    readSectionMember: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readSectionMember),

    // 12.2.3.1 Expressions
    readExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readExpression),

    // 12.2.3.2 Logical expressions
    readLogicalExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readLogicalExpression),

    // 12.2.3.3 Is expression
    readIsExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIsExpression),
    readNullablePrimitiveType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readNullablePrimitiveType),

    // 12.2.3.4 As expression
    readAsExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readAsExpression),

    // 12.2.3.5 Equality expression
    readEqualityExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readEqualityExpression),

    // 12.2.3.6 Relational expression
    readRelationalExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRelationalExpression),

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readArithmeticExpression),

    // 12.2.3.8 Metadata expression
    readMetadataExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readMetadataExpression),

    // 12.2.3.9 Unary expression
    readUnaryExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readUnaryExpression),

    // 12.2.3.10 Primary expression
    readPrimaryExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readPrimaryExpression),
    readRecursivePrimaryExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>, head) => {
        const readRecursivePrimaryExpressionLambda: () => Language.Ast.RecursivePrimaryExpression = () =>
            state.baseParser.readRecursivePrimaryExpression(state, (parser as unknown) as IParser<IParserState>, head);
        return traceFunction(state, parser, readRecursivePrimaryExpressionLambda);
    },

    // 12.2.3.11 Literal expression
    readLiteralExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readLiteralExpression),

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIdentifierExpression),

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readParenthesizedExpression),

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readNotImplementedExpression),

    // 12.2.3.16 Invoke expression
    readInvokeExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readInvokeExpression),

    // 12.2.3.17 List expression
    readListExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListExpression),
    readListItem: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListItem),

    // 12.2.3.18 Record expression
    readRecordExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRecordExpression),

    // 12.2.3.19 Item access expression
    readItemAccessExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readItemAccessExpression),

    // 12.2.3.20 Field access expression
    readFieldSelection: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFieldSelection),
    readFieldProjection: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFieldProjection),
    readFieldSelector: (state: BenchmarkState, parser: IParser<BenchmarkState>, allowOptional: boolean) => {
        const readFieldSelectorLambda: () => Language.Ast.FieldSelector = () =>
            state.baseParser.readFieldSelector(state, (parser as unknown) as IParser<IParserState>, allowOptional);
        return traceFunction(state, parser, readFieldSelectorLambda);
    },

    // 12.2.3.21 Function expression
    readFunctionExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFunctionExpression),
    readParameterList: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readParameterList),
    readAsType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readAsType),

    // 12.2.3.22 Each expression
    readEachExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readEachExpression),

    // 12.2.3.23 Let expression
    readLetExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readLetExpression),

    // 12.2.3.24 If expression
    readIfExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIfExpression),

    // 12.2.3.25 Type expression
    readTypeExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readTypeExpression),
    readType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readType),
    readPrimaryType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readPrimaryType),
    readRecordType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRecordType),
    readTableType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readTableType),
    readFieldSpecificationList: (
        state: BenchmarkState,
        parser: IParser<BenchmarkState>,
        allowOpenMarker: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.FieldSpecificationList = () =>
            state.baseParser.readFieldSpecificationList(
                state,
                (parser as unknown) as IParser<IParserState>,
                allowOpenMarker,
                testPostCommaError,
            );
        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readListType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListType),
    readFunctionType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readFunctionType),
    readParameterSpecificationList: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readParameterSpecificationList),
    readNullableType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readNullableType),

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readErrorRaisingExpression),

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readErrorHandlingExpression),

    // 12.2.4 Literal Attributes
    readRecordLiteral: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readRecordLiteral),
    readFieldNamePairedAnyLiterals: (
        state: BenchmarkState,
        parser: IParser<BenchmarkState>,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldNamePairedAnyLiteralsLambda: () => Language.Ast.ICsvArray<
            Language.Ast.GeneralizedIdentifierPairedAnyLiteral
        > = () =>
            state.baseParser.readFieldNamePairedAnyLiterals(
                state,
                (parser as unknown) as IParser<IParserState>,
                onePairRequired,
                testPostCommaError,
            );

        return traceFunction(state, parser, readFieldNamePairedAnyLiteralsLambda);
    },
    readListLiteral: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readListLiteral),
    readAnyLiteral: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readAnyLiteral),
    readPrimitiveType: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readPrimitiveType),

    // Disambiguation
    disambiguateBracket: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.disambiguateBracket),
    disambiguateParenthesis: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.disambiguateParenthesis),

    // key-value pairs
    readIdentifierPairedExpressions: (
        state: BenchmarkState,
        parser: IParser<BenchmarkState>,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.ICsvArray<
            Language.Ast.IdentifierPairedExpression
        > = () =>
            state.baseParser.readIdentifierPairedExpressions(
                state,
                (parser as unknown) as IParser<IParserState>,
                onePairRequired,
                testPostCommaError,
            );

        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readIdentifierPairedExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readIdentifierPairedExpression),
    readGeneralizedIdentifierPairedExpressions: (
        state: BenchmarkState,
        parser: IParser<BenchmarkState>,
        onePairRequired: boolean,
        testPostCommaError,
    ) => {
        const readFieldSpecificationListLambda: () => Language.Ast.ICsvArray<
            Language.Ast.GeneralizedIdentifierPairedExpression
        > = () =>
            state.baseParser.readGeneralizedIdentifierPairedExpressions(
                state,
                (parser as unknown) as IParser<IParserState>,
                onePairRequired,
                testPostCommaError,
            );
        return traceFunction(state, parser, readFieldSpecificationListLambda);
    },
    readGeneralizedIdentifierPairedExpression: (state: BenchmarkState, parser: IParser<BenchmarkState>) =>
        traceFunction(state, parser, state.baseParser.readGeneralizedIdentifierPairedExpression),
};

export function newBenchmarkState<S = IParserState>(
    parseSettings: ParseSettings<S & IParserState>,
    lexerSnapshot: LexerSnapshot,
    baseParser: IParser<IParserState>,
): BenchmarkState {
    return {
        ...IParserStateUtils.newState(parseSettings, lexerSnapshot),
        baseParser,
        functionTimestamps: new Map(),
        functionTimestampCounter: 0,
    };
}

function traceFunction<T>(
    benchmarkState: BenchmarkState,
    benchmarkParser: IParser<BenchmarkState>,
    fn: (state: IParserState, parser: IParser<IParserState>) => T,
): T {
    const fnCallId: number = functionEntry(benchmarkState, fn);
    const result: T = fn(benchmarkState, (benchmarkParser as unknown) as IParser<IParserState>);
    functionExit(benchmarkState, fnCallId);
    return result;
}

function functionEntry<S, T>(state: BenchmarkState, fn: (state: S, parser: IParser<S>) => T): number {
    const tokenPosition: Language.TokenPosition = state.maybeCurrentToken!.positionStart;
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
    const tokenPosition: Language.TokenPosition = state.maybeCurrentToken!.positionStart;
    const fnTimestamp: FunctionTimestamp = state.functionTimestamps.get(id)!;
    const finish: number = performanceNow();
    const duration: number = finish - fnTimestamp.timeStart;

    fnTimestamp.timeEnd = finish;
    fnTimestamp.timeDuration = duration;
    fnTimestamp.lineNumberEnd = tokenPosition.lineNumber;
    fnTimestamp.lineCodeUnitEnd = tokenPosition.lineCodeUnit;
    fnTimestamp.codeUnitEnd = tokenPosition.codeUnit;
}
