// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IParserState, ParseError } from "..";
import { Result } from "../../common";
import { Ast } from "../../language";

export type TriedParse<S extends IParserState = IParserState> = Result<ParseOk<S>, ParseError.TParseError<S>>;

export const enum ParenthesisDisambiguation {
    FunctionExpression = "FunctionExpression",
    ParenthesizedExpression = "ParenthesizedExpression",
}

export const enum BracketDisambiguation {
    FieldProjection = "FieldProjection",
    FieldSelection = "FieldSelection",
    Record = "Record",
}

export interface ParseOk<S extends IParserState = IParserState> {
    readonly ast: Ast.TNode;
    readonly state: S;
}

export interface IParser<State extends IParserState = IParserState> {
    readonly read: (state: State, parser: IParser<State>) => Ast.TNode;

    // 12.1.6 Identifiers
    readonly readIdentifier: (state: State, parser: IParser<State>) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (state: State, parser: IParser<State>) => Ast.GeneralizedIdentifier;
    readonly readKeyword: (state: State, parser: IParser<State>) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (state: State, parser: IParser<State>) => Ast.TDocument;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: State, parser: IParser<State>) => Ast.Section;
    readonly readSectionMembers: (state: State, parser: IParser<State>) => Ast.IArrayWrapper<Ast.SectionMember>;
    readonly readSectionMember: (state: State, parser: IParser<State>) => Ast.SectionMember;

    // 12.2.3.1 Expressions
    readonly readExpression: (state: State, parser: IParser<State>) => Ast.TExpression;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (state: State, parser: IParser<State>) => Ast.TLogicalExpression;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (state: State, parser: IParser<State>) => Ast.TIsExpression;
    readonly readNullablePrimitiveType: (state: State, parser: IParser<State>) => Ast.TNullablePrimitiveType;

    // 12.2.3.4 As expression
    readonly readAsExpression: (state: State, parser: IParser<State>) => Ast.TAsExpression;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (state: State, parser: IParser<State>) => Ast.TEqualityExpression;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (state: State, parser: IParser<State>) => Ast.TRelationalExpression;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (state: State, parser: IParser<State>) => Ast.TArithmeticExpression;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (state: State, parser: IParser<State>) => Ast.TMetadataExpression;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (state: State, parser: IParser<State>) => Ast.TUnaryExpression;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (state: State, parser: IParser<State>) => Ast.TPrimaryExpression;
    readonly readRecursivePrimaryExpression: (
        state: State,
        parser: IParser<State>,
        head: Ast.TPrimaryExpression,
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (state: State, parser: IParser<State>) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (state: State, parser: IParser<State>) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (state: State, parser: IParser<State>) => Ast.ParenthesizedExpression;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (state: State, parser: IParser<State>) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (state: State, parser: IParser<State>) => Ast.InvokeExpression;

    // 12.2.3.17 List expression
    readonly readListExpression: (state: State, parser: IParser<State>) => Ast.ListExpression;
    readonly readListItem: (state: State, parser: IParser<State>) => Ast.TListItem;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (state: State, parser: IParser<State>) => Ast.RecordExpression;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (state: State, parser: IParser<State>) => Ast.ItemAccessExpression;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (state: State, parser: IParser<State>) => Ast.FieldSelector;
    readonly readFieldProjection: (state: State, parser: IParser<State>) => Ast.FieldProjection;
    readonly readFieldSelector: (state: State, parser: IParser<State>, allowOptional: boolean) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (state: State, parser: IParser<State>) => Ast.FunctionExpression;
    readonly readParameterList: (
        state: State,
        parser: IParser<State>,
    ) => Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;
    readonly readAsType: (state: State, parser: IParser<State>) => Ast.AsType;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (state: State, parser: IParser<State>) => Ast.EachExpression;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (state: State, parser: IParser<State>) => Ast.LetExpression;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: State, parser: IParser<State>) => Ast.IfExpression;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (state: State, parser: IParser<State>) => Ast.TTypeExpression;
    readonly readType: (state: State, parser: IParser<State>) => Ast.TType;
    readonly readPrimaryType: (state: State, parser: IParser<State>) => Ast.TPrimaryType;
    readonly readRecordType: (state: State, parser: IParser<State>) => Ast.RecordType;
    readonly readTableType: (state: State, parser: IParser<State>) => Ast.TableType;
    readonly readFieldSpecificationList: (
        state: State,
        parser: IParser<State>,
        allowOpenMarker: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.FieldSpecificationList;
    readonly readListType: (state: State, parser: IParser<State>) => Ast.ListType;
    readonly readFunctionType: (state: State, parser: IParser<State>) => Ast.FunctionType;
    readonly readParameterSpecificationList: (state: State, parser: IParser<State>) => Ast.IParameterList<Ast.AsType>;
    readonly readNullableType: (state: State, parser: IParser<State>) => Ast.NullableType;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (state: State, parser: IParser<State>) => Ast.ErrorRaisingExpression;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (state: State, parser: IParser<State>) => Ast.ErrorHandlingExpression;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (state: State, parser: IParser<State>) => Ast.RecordLiteral;
    readonly readFieldNamePairedAnyLiterals: (
        state: State,
        parser: IParser<State>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: (state: State, parser: IParser<State>) => Ast.ListLiteral;
    readonly readAnyLiteral: (state: State, parser: IParser<State>) => Ast.TAnyLiteral;
    readonly readPrimitiveType: (state: State, parser: IParser<State>) => Ast.PrimitiveType;

    // Disambiguation
    readonly disambiguateBracket: (
        state: State,
        parser: IParser<State>,
    ) => Result<BracketDisambiguation, ParseError.UnterminatedBracketError>;
    readonly disambiguateParenthesis: (
        state: State,
        parser: IParser<State>,
    ) => Result<ParenthesisDisambiguation, ParseError.UnterminatedParenthesesError>;

    readonly readIdentifierPairedExpressions: (
        state: State,
        parser: IParser<State>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readIdentifierPairedExpression: (state: State, parser: IParser<State>) => Ast.IdentifierPairedExpression;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: State,
        parser: IParser<State>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: State,
        parser: IParser<State>,
    ) => Ast.GeneralizedIdentifierPairedExpression;
}
