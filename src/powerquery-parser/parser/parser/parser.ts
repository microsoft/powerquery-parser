// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError, ParseState } from "..";
import { Ast } from "../../language";
import { Result } from "../../common";

export type TriedParse = Result<ParseOk, ParseError.TParseError>;

export interface ParseStateCheckpoint {
    readonly tokenIndex: number;
    readonly contextStateIdCounter: number;
    readonly maybeContextNodeId: number | undefined;
}

export interface ParseOk {
    readonly root: Ast.TNode;
    readonly state: ParseState;
}

export interface Parser {
    // Update `state` to match the the `update`.
    readonly applyState: (state: ParseState, update: ParseState) => void;
    // Create a deep copy of S.
    readonly copyState: (state: ParseState) => ParseState;

    // Checkpoints are a snapshot for a particular state,
    // and should enable reverting the state to its earlier version. They do not work on later states.
    // Eg. given the history below:
    //  You can restore checkpoint 2 and then checkpoint 1,
    //  but restoring checkpoint 1 and then checkpoint 2 will result in undefined behavior.
    // Initial state ------- checkpoint 1 -- checkpoint 2 --- current.
    readonly createCheckpoint: (state: ParseState) => ParseStateCheckpoint;
    readonly restoreCheckpoint: (state: ParseState, checkpoint: ParseStateCheckpoint) => void;

    // 12.1.6 Identifiers
    readonly readIdentifier: (state: ParseState, parser: Parser) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (state: ParseState, parser: Parser) => Ast.GeneralizedIdentifier;
    readonly readKeyword: (state: ParseState, parser: Parser) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (state: ParseState, parser: Parser) => Ast.TDocument;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: ParseState, parser: Parser) => Ast.Section;
    readonly readSectionMembers: (state: ParseState, parser: Parser) => Ast.IArrayWrapper<Ast.SectionMember>;
    readonly readSectionMember: (state: ParseState, parser: Parser) => Ast.SectionMember;

    // 12.2.3.1 Expressions
    readonly readNullCoalescingExpression: (state: ParseState, Parser: Parser) => Ast.TExpression;
    readonly readExpression: (state: ParseState, parser: Parser) => Ast.TExpression;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (state: ParseState, parser: Parser) => Ast.TLogicalExpression;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (state: ParseState, parser: Parser) => Ast.TIsExpression;
    readonly readNullablePrimitiveType: (state: ParseState, parser: Parser) => Ast.TNullablePrimitiveType;

    // 12.2.3.4 As expression
    readonly readAsExpression: (state: ParseState, parser: Parser) => Ast.TAsExpression;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (state: ParseState, parser: Parser) => Ast.TEqualityExpression;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (state: ParseState, parser: Parser) => Ast.TRelationalExpression;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (state: ParseState, parser: Parser) => Ast.TArithmeticExpression;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (state: ParseState, parser: Parser) => Ast.TMetadataExpression;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (state: ParseState, parser: Parser) => Ast.TUnaryExpression;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (state: ParseState, parser: Parser) => Ast.TPrimaryExpression;
    readonly readRecursivePrimaryExpression: (
        state: ParseState,
        parser: Parser,
        head: Ast.TPrimaryExpression,
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (state: ParseState, parser: Parser) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (state: ParseState, parser: Parser) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (state: ParseState, parser: Parser) => Ast.ParenthesizedExpression;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (state: ParseState, parser: Parser) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (state: ParseState, parser: Parser) => Ast.InvokeExpression;

    // 12.2.3.17 List expression
    readonly readListExpression: (state: ParseState, parser: Parser) => Ast.ListExpression;
    readonly readListItem: (state: ParseState, parser: Parser) => Ast.TListItem;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (state: ParseState, parser: Parser) => Ast.RecordExpression;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (state: ParseState, parser: Parser) => Ast.ItemAccessExpression;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (state: ParseState, parser: Parser) => Ast.FieldSelector;
    readonly readFieldProjection: (state: ParseState, parser: Parser) => Ast.FieldProjection;
    readonly readFieldSelector: (state: ParseState, parser: Parser, allowOptional: boolean) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (state: ParseState, parser: Parser) => Ast.FunctionExpression;
    readonly readParameterList: (
        state: ParseState,
        parser: Parser,
    ) => Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;
    readonly readAsType: (state: ParseState, parser: Parser) => Ast.AsType;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (state: ParseState, parser: Parser) => Ast.EachExpression;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (state: ParseState, parser: Parser) => Ast.LetExpression;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: ParseState, parser: Parser) => Ast.IfExpression;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (state: ParseState, parser: Parser) => Ast.TTypeExpression;
    readonly readType: (state: ParseState, parser: Parser) => Ast.TType;
    readonly readPrimaryType: (state: ParseState, parser: Parser) => Ast.TPrimaryType;
    readonly readRecordType: (state: ParseState, parser: Parser) => Ast.RecordType;
    readonly readTableType: (state: ParseState, parser: Parser) => Ast.TableType;
    readonly readFieldSpecificationList: (
        state: ParseState,
        parser: Parser,
        allowOpenMarker: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.FieldSpecificationList;
    readonly readListType: (state: ParseState, parser: Parser) => Ast.ListType;
    readonly readFunctionType: (state: ParseState, parser: Parser) => Ast.FunctionType;
    readonly readParameterSpecificationList: (state: ParseState, parser: Parser) => Ast.IParameterList<Ast.AsType>;
    readonly readNullableType: (state: ParseState, parser: Parser) => Ast.NullableType;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (state: ParseState, parser: Parser) => Ast.ErrorRaisingExpression;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (state: ParseState, parser: Parser) => Ast.ErrorHandlingExpression;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (state: ParseState, parser: Parser) => Ast.RecordLiteral;
    readonly readFieldNamePairedAnyLiterals: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: (state: ParseState, parser: Parser) => Ast.ListLiteral;
    readonly readAnyLiteral: (state: ParseState, parser: Parser) => Ast.TAnyLiteral;
    readonly readPrimitiveType: (state: ParseState, parser: Parser) => Ast.PrimitiveType;

    readonly readIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readIdentifierPairedExpression: (state: ParseState, parser: Parser) => Ast.IdentifierPairedExpression;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: ParseState,
        parser: Parser,
    ) => Ast.GeneralizedIdentifierPairedExpression;
}
