// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils, NodeIdMap, ParserContext } from "..";
import { ArrayUtils, CommonError, isNever, Option, TypeUtils } from "../../common";
import { TokenKind, TokenRange, TokenPosition } from "../../lexer";
import { BracketDisambiguation, IParser } from "../IParser";
import { IParserState, IParserStateUtils } from "../IParserState";
import { readBracketDisambiguation, readTokenKindAsConstant } from "./common";

export interface BenchmarkState extends IParserState {
    functionTimestamps: Map<number, FunctionTimestamp>;
    functionTimestampCounter: number;
}

export interface BenchmarkParser<S> extends IParser<S & BenchmarkState> {
    getThis: Option<() => BenchmarkParser<S>>;
}

export interface FunctionTimestamp {
    readonly id: number;
    readonly fnName: string;
    readonly lineNumberStart: number;
    readonly lineCodeUnitStart: number;
    readonly codeUnitStart: number;
    lineNumberEnd: Option<number>;
    lineCodeUnitEnd: Option<number>;
    codeUnitEnd: Option<number>;
    readonly timeStart: number;
    timeEnd: Option<number>;
    timeDuration: Option<number>;
}

export const BenchmarkParser: IParser<BenchmarkState> = {
    // 12.1.6 Identifiers
    readIdentifier: (state, parser) => traceFunction(state, parser, parser.readIdentifier),
    readGeneralizedIdentifier: (state, parser) => traceFunction(state, parser, parser.readGeneralizedIdentifier),
    readKeyword: (state, parser) => traceFunction(state, parser, parser.readKeyword),

    // 12.2.1 Documents
    readDocument: (state, parser) => traceFunction(state, parser, parser.readDocument),

    // 12.2.2 Section Documents
    readSectionDocument: (state, parser) => traceFunction(state, parser, parser.readSectionDocument),
    readSectionMembers: (state, parser) => traceFunction(state, parser, parser.readSectionMembers),
    readSectionMember: (state, parser) => traceFunction(state, parser, parser.readSectionMember),

    // 12.2.3.1 Expressions
    readExpression: (state, parser) => traceFunction(state, parser, parser.readExpression),

    // 12.2.3.2 Logical expressions
    readLogicalExpression: (state, parser) => traceFunction(state, parser, parser.readLogicalExpression),

    // 12.2.3.3 Is expression
    readIsExpression: (state, parser) => traceFunction(state, parser, parser.readIsExpression),
    readNullablePrimitiveType: (state, parser) => traceFunction(state, parser, parser.readNullablePrimitiveType),

    // 12.2.3.4 As expression
    readAsExpression: (state, parser) => traceFunction(state, parser, parser.readAsExpression),

    // 12.2.3.5 Equality expression
    readEqualityExpression: (state, parser) => traceFunction(state, parser, parser.readEqualityExpression),

    // 12.2.3.6 Relational expression
    readRelationalExpression: (state, parser) => traceFunction(state, parser, parser.readRelationalExpression),

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: (state, parser) => traceFunction(state, parser, parser.readArithmeticExpression),

    // 12.2.3.8 Metadata expression
    readMetadataExpression: (state, parser) => traceFunction(state, parser, parser.readMetadataExpression),

    // 12.2.3.9 Unary expression
    readUnaryExpression: (state, parser) => traceFunction(state, parser, parser.readUnaryExpression),

    // 12.2.3.10 Primary expression
    readPrimaryExpression: (state, parser) => traceFunction(state, parser, parser.readPrimaryExpression),
    readRecursivePrimaryExpression: (state, parser, head) =>
        traceFunction(state, parser, () => parser.readRecursivePrimaryExpression(state, parser, head)),

    // 12.2.3.11 Literal expression
    readLiteralExpression: (state, parser) => traceFunction(state, parser, parser.readLiteralExpression),

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: (state, parser) => traceFunction(state, parser, parser.readIdentifierExpression),

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: (state, parser) => traceFunction(state, parser, parser.readParenthesizedExpression),

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: (state, parser) => traceFunction(state, parser, parser.readNotImplementedExpression),

    // 12.2.3.16 Invoke expression
    readInvokeExpression: (state, parser) => traceFunction(state, parser, parser.readInvokeExpression),

    // 12.2.3.17 List expression
    readListExpression: (state, parser) => traceFunction(state, parser, parser.readListExpression),
    readListItem: (state, parser) => traceFunction(state, parser, parser.readListItem),

    // 12.2.3.18 Record expression
    readRecordExpression: (state, parser) => traceFunction(state, parser, parser.readRecordExpression),

    // 12.2.3.19 Item access expression
    readItemAccessExpression: (state, parser) => traceFunction(state, parser, parser.readItemAccessExpression),

    // 12.2.3.20 Field access expression
    readFieldSelection: (state, parser) => traceFunction(state, parser, parser.readFieldSelection),
    readFieldProjection: (state, parser) => traceFunction(state, parser, parser.readFieldProjection),
    readFieldSelector: (state, parser, allowOptional) =>
        traceFunction(state, parser, () => parser.readFieldSelector(state, parser, allowOptional)),

    // 12.2.3.21 Function expression
    readFunctionExpression: (state, parser) => traceFunction(state, parser, parser.readFunctionExpression),
    readParameterList: (state, parser) => traceFunction(state, parser, parser.readParameterList),
    readAsType: (state, parser) => traceFunction(state, parser, parser.readAsType),

    // 12.2.3.22 Each expression
    readEachExpression: (state, parser) => traceFunction(state, parser, parser.readEachExpression),

    // 12.2.3.23 Let expression
    readLetExpression: (state, parser) => traceFunction(state, parser, parser.readLetExpression),

    // 12.2.3.24 If expression
    readIfExpression: (state, parser) => traceFunction(state, parser, parser.readIfExpression),

    // 12.2.3.25 Type expression
    readTypeExpression: (state, parser) => traceFunction(state, parser, parser.readTypeExpression),
    readType: (state, parser) => traceFunction(state, parser, parser.readType),
    readPrimaryType: (state, parser) => traceFunction(state, parser, parser.readPrimaryType),
    readRecordType: (state, parser) => traceFunction(state, parser, parser.readRecordType),
    readTableType: (state, parser) => traceFunction(state, parser, parser.readTableType),
    readFieldSpecificationList: (state, parser, allowOpenMarker, testPostCommaError) =>
        traceFunction(state, parser, () =>
            parser.readFieldSpecificationList(state, parser, allowOpenMarker, testPostCommaError),
        ),
    readListType: (state, parser) => traceFunction(state, parser, parser.readListType),
    readFunctionType: (state, parser) => traceFunction(state, parser, parser.readFunctionType),
    readParameterSpecificationList: (state, parser) =>
        traceFunction(state, parser, parser.readParameterSpecificationList),
    readNullableType: (state, parser) => traceFunction(state, parser, parser.readNullableType),

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: (state, parser) => traceFunction(state, parser, parser.readErrorRaisingExpression),

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: (state, parser) => traceFunction(state, parser, parser.readErrorHandlingExpression),

    // 12.2.4 Literal Attributes
    readRecordLiteral: (state, parser) => traceFunction(state, parser, parser.readRecordLiteral),
    readFieldNamePairedAnyLiterals: (state, parser, onePairRequired, testPostCommaError) =>
        traceFunction(state, parser, () =>
            parser.readFieldNamePairedAnyLiterals(state, parser, onePairRequired, testPostCommaError),
        ),
    readListLiteral: (state, parser) => traceFunction(state, parser, parser.readListLiteral),
    readAnyLiteral: (state, parser) => traceFunction(state, parser, parser.readAnyLiteral),
    readPrimitiveType: (state, parser) => traceFunction(state, parser, parser.readPrimitiveType),

    // Disambiguation
    disambiguateBracket: (state, parser) => traceFunction(state, parser, parser.disambiguateBracket),
    disambiguateParenthesis: (state, parser) => traceFunction(state, parser, parser.disambiguateParenthesis),

    // key-value pairs
    readIdentifierPairedExpressions: (state, parser, onePairRequired, testPostCommaError) =>
        traceFunction(state, parser, () =>
            parser.readIdentifierPairedExpressions(state, parser, onePairRequired, testPostCommaError),
        ),
    readIdentifierPairedExpression: (state, parser) =>
        traceFunction(state, parser, parser.readIdentifierPairedExpression),
    readGeneralizedIdentifierPairedExpressions: (state, parser, onePairRequired, testPostCommaError) =>
        traceFunction(state, parser, () =>
            parser.readGeneralizedIdentifierPairedExpressions(state, parser, onePairRequired, testPostCommaError),
        ),
    readGeneralizedIdentifierPairedExpression: (state, parser) =>
        traceFunction(state, parser, parser.readGeneralizedIdentifierPairedExpression),
};

function functionEntry<T>(
    state: BenchmarkState,
    fn: (state: BenchmarkState, parser: IParser<BenchmarkState>) => T,
): number {
    const tokenPosition: TokenPosition = state.maybeCurrentToken!.positionStart;
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
        timeStart: new Date().getTime(),
        timeEnd: undefined,
        timeDuration: undefined,
    };
    state.functionTimestamps.set(id, functionTimestamp);

    return id;
}

function functionExit(state: BenchmarkState, id: number): void {
    const tokenPosition: TokenPosition = state.maybeCurrentToken!.positionStart;
    const fnTimestamp: FunctionTimestamp = state.functionTimestamps.get(id)!;
    const finish: number = new Date().getTime();
    const duration: number = finish - fnTimestamp.timeStart;

    fnTimestamp.timeEnd = finish;
    fnTimestamp.timeDuration = duration;
    fnTimestamp.lineNumberEnd = tokenPosition.lineNumber;
    fnTimestamp.lineCodeUnitEnd = tokenPosition.lineCodeUnit;
    fnTimestamp.codeUnitEnd = tokenPosition.codeUnit;
}

function traceFunction<T>(
    state: BenchmarkState,
    parser: IParser<BenchmarkState>,
    fn: (state: BenchmarkState, parser: IParser<BenchmarkState>) => T,
): T {
    const fnCallId: number = functionEntry(state, fn);
    const result: T = fn(state, parser);
    functionExit(state, fnCallId);
    return result;
}
