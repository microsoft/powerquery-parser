// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Result } from "../../common";
import { TokenPosition } from "../../lexer";
import { Ast, ParseError } from "../../parser";
import { BracketDisambiguation, IParser, ParenthesisDisambiguation, TriedParse } from "../../parser/IParser";
import { IParserState } from "../../parser/IParserState";

export interface BenchmarkState extends IParserState {
    readonly baseParser: IParser<IParserState>;
    functionTimestamps: Map<number, FunctionTimestamp>;
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

export interface BenchmarkParser {
    // 12.1.6 Identifiers
    readonly readIdentifier: (state: BenchmarkState, parser: BenchmarkParser) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (state: BenchmarkState, parser: BenchmarkParser) => Ast.GeneralizedIdentifier;
    readonly readKeyword: (state: BenchmarkState, parser: BenchmarkParser) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (state: BenchmarkState, parser: BenchmarkParser) => TriedParse;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: BenchmarkState, parser: BenchmarkParser) => Ast.Section;
    readonly readSectionMembers: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.IArrayWrapper<Ast.SectionMember>;
    readonly readSectionMember: (state: BenchmarkState, parser: BenchmarkParser) => Ast.SectionMember;

    // 12.2.3.1 Expressions
    readonly readExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TExpression;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TLogicalExpression;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TIsExpression;
    readonly readNullablePrimitiveType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TNullablePrimitiveType;

    // 12.2.3.4 As expression
    readonly readAsExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TAsExpression;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TEqualityExpression;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TRelationalExpression;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TArithmeticExpression;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TMetadataExpression;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TUnaryExpression;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TPrimaryExpression;
    readonly readRecursivePrimaryExpression: (
        state: BenchmarkState,
        parser: BenchmarkParser,
        head: Ast.TPrimaryExpression,
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.ParenthesizedExpression;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.InvokeExpression;

    // 12.2.3.17 List expression
    readonly readListExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.ListExpression;
    readonly readListItem: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TListItem;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.RecordExpression;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.ItemAccessExpression;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (state: BenchmarkState, parser: BenchmarkParser) => Ast.FieldSelector;
    readonly readFieldProjection: (state: BenchmarkState, parser: BenchmarkParser) => Ast.FieldProjection;
    readonly readFieldSelector: (
        state: BenchmarkState,
        parser: BenchmarkParser,
        allowOptional: boolean,
    ) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.FunctionExpression;
    readonly readParameterList: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;
    readonly readAsType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.AsType;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.EachExpression;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.LetExpression;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.IfExpression;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TTypeExpression;
    readonly readType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TType;
    readonly readPrimaryType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TPrimaryType;
    readonly readRecordType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.RecordType;
    readonly readTableType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TableType;
    readonly readFieldSpecificationList: (
        state: BenchmarkState,
        parser: BenchmarkParser,
        allowOpenMarker: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.FieldSpecificationList;
    readonly readListType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.ListType;
    readonly readFunctionType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.FunctionType;
    readonly readParameterSpecificationList: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.IParameterList<Ast.AsType>;
    readonly readNullableType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.NullableType;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (state: BenchmarkState, parser: BenchmarkParser) => Ast.ErrorRaisingExpression;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.ErrorHandlingExpression;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (state: BenchmarkState, parser: BenchmarkParser) => Ast.RecordLiteral;
    readonly readFieldNamePairedAnyLiterals: (
        state: BenchmarkState,
        parser: BenchmarkParser,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: (state: BenchmarkState, parser: BenchmarkParser) => Ast.ListLiteral;
    readonly readAnyLiteral: (state: BenchmarkState, parser: BenchmarkParser) => Ast.TAnyLiteral;
    readonly readPrimitiveType: (state: BenchmarkState, parser: BenchmarkParser) => Ast.PrimitiveType;

    // Disambiguation
    readonly disambiguateBracket: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Result<BracketDisambiguation, ParseError.UnterminatedBracketError>;
    readonly disambiguateParenthesis: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Result<ParenthesisDisambiguation, ParseError.UnterminatedParenthesesError>;

    readonly readIdentifierPairedExpressions: (
        state: BenchmarkState,
        parser: BenchmarkParser,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readIdentifierPairedExpression: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.IdentifierPairedExpression;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: BenchmarkState,
        parser: BenchmarkParser,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: BenchmarkState,
        parser: BenchmarkParser,
    ) => Ast.GeneralizedIdentifierPairedExpression;
}

export const CombinatorialBenchmarkParser: BenchmarkParser = {
    // 12.1.6 Identifiers
    readIdentifier: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readIdentifier),

    // traceFunction(s, p, s.baseParser.readIdentifier),
    readGeneralizedIdentifier: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readGeneralizedIdentifier),
    readKeyword: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readKeyword),

    // 12.2.1 Documents
    readDocument: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readDocument),

    // 12.2.2 Section Documents
    readSectionDocument: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readSectionDocument),
    readSectionMembers: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readSectionMembers),
    readSectionMember: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readSectionMember),

    // 12.2.3.1 Expressions
    readExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readExpression),

    // 12.2.3.2 Logical expressions
    readLogicalExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readLogicalExpression),

    // 12.2.3.3 Is expression
    readIsExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readIsExpression),
    readNullablePrimitiveType: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readNullablePrimitiveType),

    // 12.2.3.4 As expression
    readAsExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readAsExpression),

    // 12.2.3.5 Equality expression
    readEqualityExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readEqualityExpression),

    // 12.2.3.6 Relational expression
    readRelationalExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readRelationalExpression),

    // 12.2.3.7 Arithmetic expressions
    readArithmeticExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readArithmeticExpression),

    // 12.2.3.8 Metadata expression
    readMetadataExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readMetadataExpression),

    // 12.2.3.9 Unary expression
    readUnaryExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readUnaryExpression),

    // 12.2.3.10 Primary expression
    readPrimaryExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readPrimaryExpression),
    readRecursivePrimaryExpression: (s: BenchmarkState, p: BenchmarkParser, head) =>
        traceFunction(s, p, () => s.baseParser.readRecursivePrimaryExpression(s, s.baseParser, head)),

    // 12.2.3.11 Literal expression
    readLiteralExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readLiteralExpression),

    // 12.2.3.12 Identifier expression
    readIdentifierExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readIdentifierExpression),

    // 12.2.3.14 Parenthesized expression
    readParenthesizedExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readParenthesizedExpression),

    // 12.2.3.15 Not-implemented expression
    readNotImplementedExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readNotImplementedExpression),

    // 12.2.3.16 Invoke expression
    readInvokeExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readInvokeExpression),

    // 12.2.3.17 List expression
    readListExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readListExpression),
    readListItem: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readListItem),

    // 12.2.3.18 Record expression
    readRecordExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readRecordExpression),

    // 12.2.3.19 Item access expression
    readItemAccessExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readItemAccessExpression),

    // 12.2.3.20 Field access expression
    readFieldSelection: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readFieldSelection),
    readFieldProjection: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readFieldProjection),
    readFieldSelector: (s: BenchmarkState, p: BenchmarkParser, allowOptional: boolean) =>
        traceFunction(s, p, () => s.baseParser.readFieldSelector(s, s.baseParser, allowOptional)),

    // 12.2.3.21 Function expression
    readFunctionExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readFunctionExpression),
    readParameterList: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readParameterList),
    readAsType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readAsType),

    // 12.2.3.22 Each expression
    readEachExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readEachExpression),

    // 12.2.3.23 Let expression
    readLetExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readLetExpression),

    // 12.2.3.24 If expression
    readIfExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readIfExpression),

    // 12.2.3.25 Type expression
    readTypeExpression: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readTypeExpression),
    readType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readType),
    readPrimaryType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readPrimaryType),
    readRecordType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readRecordType),
    readTableType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readTableType),
    readFieldSpecificationList: (s: BenchmarkState, p: BenchmarkParser, allowOpenMarker: boolean, testPostCommaError) =>
        traceFunction(s, p, () =>
            s.baseParser.readFieldSpecificationList(s, s.baseParser, allowOpenMarker, testPostCommaError),
        ),
    readListType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readListType),
    readFunctionType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readFunctionType),
    readParameterSpecificationList: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readParameterSpecificationList),
    readNullableType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readNullableType),

    // 12.2.3.26 Error raising expression
    readErrorRaisingExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readErrorRaisingExpression),

    // 12.2.3.27 Error handling expression
    readErrorHandlingExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readErrorHandlingExpression),

    // 12.2.4 Literal Attributes
    readRecordLiteral: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readRecordLiteral),
    readFieldNamePairedAnyLiterals: (s: BenchmarkState, p: BenchmarkParser, onePairRequired, testPostCommaError) =>
        traceFunction(s, p, () =>
            s.baseParser.readFieldNamePairedAnyLiterals(s, s.baseParser, onePairRequired, testPostCommaError),
        ),
    readListLiteral: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readListLiteral),
    readAnyLiteral: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readAnyLiteral),
    readPrimitiveType: (s: BenchmarkState, p: BenchmarkParser) => traceFunction(s, p, s.baseParser.readPrimitiveType),

    // Disambiguation
    disambiguateBracket: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.disambiguateBracket),
    disambiguateParenthesis: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.disambiguateParenthesis),

    // key-value pairs
    readIdentifierPairedExpressions: (s: BenchmarkState, p: BenchmarkParser, onePairRequired, testPostCommaError) =>
        traceFunction(s, p, () =>
            s.baseParser.readIdentifierPairedExpressions(s, s.baseParser, onePairRequired, testPostCommaError),
        ),
    readIdentifierPairedExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readIdentifierPairedExpression),
    readGeneralizedIdentifierPairedExpressions: (
        s: BenchmarkState,
        p: BenchmarkParser,
        onePairRequired,
        testPostCommaError,
    ) =>
        traceFunction(s, p, () =>
            s.baseParser.readGeneralizedIdentifierPairedExpressions(
                s,
                s.baseParser,
                onePairRequired,
                testPostCommaError,
            ),
        ),
    readGeneralizedIdentifierPairedExpression: (s: BenchmarkState, p: BenchmarkParser) =>
        traceFunction(s, p, s.baseParser.readGeneralizedIdentifierPairedExpression),
};

function functionEntry<T, S>(state: BenchmarkState, fn: (state: S, parser: IParser<S>) => T): number {
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
    benchmarkState: BenchmarkState,
    benchmarkParser: BenchmarkParser,
    fn: (state: IParserState, parser: IParser<IParserState>) => T,
): T {
    const fnCallId: number = functionEntry(benchmarkState, fn);
    const result: T = fn(benchmarkState, (benchmarkParser as unknown) as IParser<IParserState>);
    functionExit(benchmarkState, fnCallId);
    return result;
}
