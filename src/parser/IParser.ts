// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, IParserState, NodeIdMap, ParseError } from ".";
import { Result } from "../common";

export type TriedParse<S = IParserState> = Result<ParseOk<S>, ParseError.TParseError<S>>;

export const enum ParenthesisDisambiguation {
    FunctionExpression = "FunctionExpression",
    ParenthesizedExpression = "ParenthesizedExpression",
}

export const enum BracketDisambiguation {
    FieldProjection = "FieldProjection",
    FieldSelection = "FieldSelection",
    Record = "Record",
}

export interface ParseOk<S = IParserState> {
    readonly ast: Ast.TDocument;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly leafNodeIds: ReadonlyArray<number>;
    readonly state: S & IParserState;
}

export interface IParser<State = IParserState> {
    // 12.1.6 Identifiers
    readonly readIdentifier: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.GeneralizedIdentifier;
    readonly readKeyword: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => TriedParse<State & IParserState>;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.Section;
    readonly readSectionMembers: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.IArrayWrapper<Ast.SectionMember>;
    readonly readSectionMember: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.SectionMember;

    // 12.2.3.1 Expressions
    readonly readExpression: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.TExpression;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TLogicalExpression;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TIsExpression;
    readonly readNullablePrimitiveType: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TNullablePrimitiveType;

    // 12.2.3.4 As expression
    readonly readAsExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TAsExpression;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TEqualityExpression;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TRelationalExpression;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TArithmeticExpression;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TMetadataExpression;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TUnaryExpression;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TPrimaryExpression;
    readonly readRecursivePrimaryExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>,
        head: Ast.TPrimaryExpression
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.ParenthesizedExpression;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.InvokeExpression;

    // 12.2.3.17 List expression
    readonly readListExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.ListExpression;
    readonly readListItem: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.TListItem;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.RecordExpression;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.ItemAccessExpression;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.FieldSelector;
    readonly readFieldProjection: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.FieldProjection;
    readonly readFieldSelector: (
        state: State & IParserState,
        parser: IParser<State & IParserState>,
        allowOptional: boolean
    ) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.FunctionExpression;
    readonly readParameterList: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;
    readonly readAsType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.AsType;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.EachExpression;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.LetExpression;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.IfExpression;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.TTypeExpression;
    readonly readType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.TType;
    readonly readPrimaryType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.TPrimaryType;
    readonly readRecordType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.RecordType;
    readonly readTableType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.TableType;
    readonly readFieldSpecificationList: (
        state: State & IParserState,
        parser: IParser<State & IParserState>,
        allowOpenMarker: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined
    ) => Ast.FieldSpecificationList;
    readonly readListType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.ListType;
    readonly readFunctionType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.FunctionType;
    readonly readParameterSpecificationList: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.IParameterList<Ast.AsType>;
    readonly readNullableType: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.NullableType;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.ErrorRaisingExpression;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.ErrorHandlingExpression;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.RecordLiteral;
    readonly readFieldNamePairedAnyLiterals: (
        state: State & IParserState,
        parser: IParser<State & IParserState>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.ListLiteral;
    readonly readAnyLiteral: (state: State & IParserState, parser: IParser<State & IParserState>) => Ast.TAnyLiteral;
    readonly readPrimitiveType: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.PrimitiveType;

    // Disambiguation
    readonly disambiguateBracket: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Result<BracketDisambiguation, ParseError.UnterminatedBracketError>;
    readonly disambiguateParenthesis: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Result<ParenthesisDisambiguation, ParseError.UnterminatedParenthesesError>;

    readonly readIdentifierPairedExpressions: (
        state: State & IParserState,
        parser: IParser<State & IParserState>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readIdentifierPairedExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.IdentifierPairedExpression;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: State & IParserState,
        parser: IParser<State & IParserState>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParserState) => ParseError.TInnerParseError | undefined
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: State & IParserState,
        parser: IParser<State & IParserState>
    ) => Ast.GeneralizedIdentifierPairedExpression;
}
