// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IParseState, ParseError } from "..";
import { Result } from "../../common";
import { Ast } from "../../language";
import { TParseStateFactoryOverrides } from "../IParseState";

export type TriedParse<S extends IParseState = IParseState> = Result<ParseOk<S>, ParseError.TParseError<S>>;

export interface IParseStateCheckpoint {
    readonly tokenIndex: number;
    readonly contextStateIdCounter: number;
    readonly maybeContextNodeId: number | undefined;
}

export interface ParseOk<S extends IParseState = IParseState> {
    readonly root: Ast.TNode;
    readonly state: S;
}

export interface IParser<S extends IParseState = IParseState, C extends IParseStateCheckpoint = IParseStateCheckpoint> {
    readonly applyState: (state: S, update: S) => void;
    readonly copyState: (state: S) => S;
    readonly checkpointFactory: (state: S) => C;
    readonly restoreCheckpoint: (state: S, checkpoint: C) => void;

    // 12.1.6 Identifiers
    readonly readIdentifier: (state: S, parser: IParser<S>) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (state: S, parser: IParser<S>) => Ast.GeneralizedIdentifier;
    readonly readKeyword: (state: S, parser: IParser<S>) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (state: S, parser: IParser<S>) => Ast.TDocument;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: S, parser: IParser<S>) => Ast.Section;
    readonly readSectionMembers: (state: S, parser: IParser<S>) => Ast.IArrayWrapper<Ast.SectionMember>;
    readonly readSectionMember: (state: S, parser: IParser<S>) => Ast.SectionMember;

    // 12.2.3.1 Expressions
    readonly readNullCoalescingExpression: (state: S, Parser: IParser<S>) => Ast.TExpression;
    readonly readExpression: (state: S, parser: IParser<S>) => Ast.TExpression;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (state: S, parser: IParser<S>) => Ast.TLogicalExpression;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (state: S, parser: IParser<S>) => Ast.TIsExpression;
    readonly readNullablePrimitiveType: (state: S, parser: IParser<S>) => Ast.TNullablePrimitiveType;

    // 12.2.3.4 As expression
    readonly readAsExpression: (state: S, parser: IParser<S>) => Ast.TAsExpression;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (state: S, parser: IParser<S>) => Ast.TEqualityExpression;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (state: S, parser: IParser<S>) => Ast.TRelationalExpression;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (state: S, parser: IParser<S>) => Ast.TArithmeticExpression;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (state: S, parser: IParser<S>) => Ast.TMetadataExpression;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (state: S, parser: IParser<S>) => Ast.TUnaryExpression;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (state: S, parser: IParser<S>) => Ast.TPrimaryExpression;
    readonly readRecursivePrimaryExpression: (
        state: S,
        parser: IParser<S>,
        head: Ast.TPrimaryExpression,
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (state: S, parser: IParser<S>) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (state: S, parser: IParser<S>) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (state: S, parser: IParser<S>) => Ast.ParenthesizedExpression;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (state: S, parser: IParser<S>) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (state: S, parser: IParser<S>) => Ast.InvokeExpression;

    // 12.2.3.17 List expression
    readonly readListExpression: (state: S, parser: IParser<S>) => Ast.ListExpression;
    readonly readListItem: (state: S, parser: IParser<S>) => Ast.TListItem;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (state: S, parser: IParser<S>) => Ast.RecordExpression;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (state: S, parser: IParser<S>) => Ast.ItemAccessExpression;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (state: S, parser: IParser<S>) => Ast.FieldSelector;
    readonly readFieldProjection: (state: S, parser: IParser<S>) => Ast.FieldProjection;
    readonly readFieldSelector: (state: S, parser: IParser<S>, allowOptional: boolean) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (state: S, parser: IParser<S>) => Ast.FunctionExpression;
    readonly readParameterList: (
        state: S,
        parser: IParser<S>,
    ) => Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;
    readonly readAsType: (state: S, parser: IParser<S>) => Ast.AsType;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (state: S, parser: IParser<S>) => Ast.EachExpression;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (state: S, parser: IParser<S>) => Ast.LetExpression;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: S, parser: IParser<S>) => Ast.IfExpression;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (state: S, parser: IParser<S>) => Ast.TTypeExpression;
    readonly readType: (state: S, parser: IParser<S>) => Ast.TType;
    readonly readPrimaryType: (state: S, parser: IParser<S>) => Ast.TPrimaryType;
    readonly readRecordType: (state: S, parser: IParser<S>) => Ast.RecordType;
    readonly readTableType: (state: S, parser: IParser<S>) => Ast.TableType;
    readonly readFieldSpecificationList: (
        state: S,
        parser: IParser<S>,
        allowOpenMarker: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.FieldSpecificationList;
    readonly readListType: (state: S, parser: IParser<S>) => Ast.ListType;
    readonly readFunctionType: (state: S, parser: IParser<S>) => Ast.FunctionType;
    readonly readParameterSpecificationList: (state: S, parser: IParser<S>) => Ast.IParameterList<Ast.AsType>;
    readonly readNullableType: (state: S, parser: IParser<S>) => Ast.NullableType;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (state: S, parser: IParser<S>) => Ast.ErrorRaisingExpression;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (state: S, parser: IParser<S>) => Ast.ErrorHandlingExpression;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (state: S, parser: IParser<S>) => Ast.RecordLiteral;
    readonly readFieldNamePairedAnyLiterals: (
        state: S,
        parser: IParser<S>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: (state: S, parser: IParser<S>) => Ast.ListLiteral;
    readonly readAnyLiteral: (state: S, parser: IParser<S>) => Ast.TAnyLiteral;
    readonly readPrimitiveType: (state: S, parser: IParser<S>) => Ast.PrimitiveType;

    readonly readIdentifierPairedExpressions: (
        state: S,
        parser: IParser<S>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readIdentifierPairedExpression: (state: S, parser: IParser<S>) => Ast.IdentifierPairedExpression;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: S,
        parser: IParser<S>,
        onePairRequired: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: S,
        parser: IParser<S>,
    ) => Ast.GeneralizedIdentifierPairedExpression;
}
