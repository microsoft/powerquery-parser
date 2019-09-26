// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, ParserError } from ".";
import { Option, Result } from "../common";
import { IParserState } from "./IParserState";

export type ParserFn<State, T> = (state: State, parser: IParser<State>) => T;
export type TriedParse = Result<ParseOk, ParserError.TParserError>;

export const enum ParenthesisDisambiguation {
    FunctionExpression = "FunctionExpression",
    ParenthesizedExpression = "ParenthesizedExpression",
}

export const enum BracketDisambiguation {
    FieldProjection = "FieldProjection",
    FieldSelection = "FieldSelection",
    Record = "Record",
}

export interface ParseOk {
    readonly document: Ast.TDocument;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
}

export interface IParser<State> {
    // 12.1.6 Identifiers
    readonly readIdentifier: ParserFn<State, Ast.Identifier>;
    readonly readGeneralizedIdentifier: ParserFn<State, Ast.GeneralizedIdentifier>;
    readonly readKeyword: ParserFn<State, Ast.IdentifierExpression>;

    // 12.2.1 Documents
    readonly readDocument: ParserFn<State, TriedParse>;

    // 12.2.2 Section Documents
    readonly readSectionDocument: ParserFn<State, Ast.Section>;
    readonly readSectionMembers: ParserFn<State, Ast.IArrayWrapper<Ast.SectionMember>>;
    readonly readSectionMember: ParserFn<State, Ast.SectionMember>;

    // 12.2.3.1 Expressions
    readonly readExpression: ParserFn<State, Ast.TExpression>;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: ParserFn<State, Ast.TLogicalExpression>;

    // 12.2.3.3 Is expression
    readonly readIsExpression: ParserFn<State, Ast.TIsExpression>;
    readonly readNullablePrimitiveType: ParserFn<State, Ast.TNullablePrimitiveType>;

    // 12.2.3.4 As expression
    readonly readAsExpression: ParserFn<State, Ast.TAsExpression>;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: ParserFn<State, Ast.TEqualityExpression>;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: ParserFn<State, Ast.TRelationalExpression>;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: ParserFn<State, Ast.TArithmeticExpression>;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: ParserFn<State, Ast.TMetadataExpression>;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: ParserFn<State, Ast.TUnaryExpression>;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: ParserFn<State, Ast.TPrimaryExpression>;
    readonly readRecursivePrimaryExpression: (
        state: State,
        parser: IParser<State>,
        head: Ast.TPrimaryExpression,
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: ParserFn<State, Ast.LiteralExpression>;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: ParserFn<State, Ast.IdentifierExpression>;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: ParserFn<State, Ast.ParenthesizedExpression>;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: ParserFn<State, Ast.NotImplementedExpression>;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: ParserFn<State, Ast.InvokeExpression>;

    // 12.2.3.17 List expression
    readonly readListExpression: ParserFn<State, Ast.ListExpression>;
    readonly readListItem: ParserFn<State, Ast.TListItem>;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: ParserFn<State, Ast.RecordExpression>;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: ParserFn<State, Ast.ItemAccessExpression>;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: ParserFn<State, Ast.FieldSelector>;
    readonly readFieldProjection: ParserFn<State, Ast.FieldProjection>;
    readonly readFieldSelector: (state: State, parser: IParser<State>, allowOptional: boolean) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: ParserFn<State, Ast.FunctionExpression>;
    readonly readParameterList: (
        state: State,
        parser: IParser<State>,
    ) => Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>>;
    readonly readAsType: ParserFn<State, Ast.AsType>;

    // 12.2.3.22 Each expression
    readonly readEachExpression: ParserFn<State, Ast.EachExpression>;

    // 12.2.3.23 Let expression
    readonly readLetExpression: ParserFn<State, Ast.LetExpression>;

    // 12.2.3.24 If expression
    readonly readIfExpression: ParserFn<State, Ast.IfExpression>;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: ParserFn<State, Ast.TTypeExpression>;
    readonly readType: ParserFn<State, Ast.TType>;
    readonly readPrimaryType: ParserFn<State, Ast.TPrimaryType>;
    readonly readRecordType: ParserFn<State, Ast.RecordType>;
    readonly readTableType: ParserFn<State, Ast.TableType>;
    readonly readFieldSpecificationList: (
        state: State,
        parser: IParser<State>,
        allowOpenMarker: boolean,
        testPostCommaError: (state: IParserState) => Option<ParserError.TInnerParserError>,
    ) => Ast.FieldSpecificationList;
    readonly readListType: ParserFn<State, Ast.ListType>;
    readonly readFunctionType: ParserFn<State, Ast.FunctionType>;
    readonly readParameterSpecificationList: ParserFn<State, Ast.IParameterList<Ast.AsType>>;
    readonly readNullableType: ParserFn<State, Ast.NullableType>;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: ParserFn<State, Ast.ErrorRaisingExpression>;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: ParserFn<State, Ast.ErrorHandlingExpression>;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: ParserFn<State, Ast.RecordLiteral>;
    readonly readFieldNamePairedAnyLiterals: (
        state: State,
        parser: IParser<State>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => Option<ParserError.TInnerParserError>,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: ParserFn<State, Ast.ListLiteral>;
    readonly readAnyLiteral: ParserFn<State, Ast.TAnyLiteral>;
    readonly readPrimitiveType: ParserFn<State, Ast.PrimitiveType>;

    // Disambiguation
    readonly disambiguateBracket: (
        state: State,
        parser: IParser<State>,
    ) => Result<BracketDisambiguation, ParserError.UnterminatedBracketError>;
    readonly disambiguateParenthesis: (
        state: State,
        parser: IParser<State>,
    ) => Result<ParenthesisDisambiguation, ParserError.UnterminatedParenthesesError>;

    readonly readIdentifierPairedExpressions: (
        state: State,
        parser: IParser<State>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => Option<ParserError.TInnerParserError>,
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: State,
        parser: IParser<State>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => Option<ParserError.TInnerParserError>,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: State,
        parser: IParser<State>,
    ) => Ast.GeneralizedIdentifierPairedExpression;
    readonly readIdentifierPairedExpression: ParserFn<State, Ast.IdentifierPairedExpression>;
}
