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
    readonly applyState: (state: ParseState, update: ParseState) => Promise<void>;
    // Create a deep copy of S.
    readonly copyState: (state: ParseState) => Promise<ParseState>;

    // Checkpoints are a snapshot at a particular time.
    // You can use a checkpoint to restore the parser's state back to when the checkpoint was created.
    // If the checkpoint is used on a parser that didn't create the checkpoint it results in undefiend behavior.
    // If the checkpoint is used on a parser whose state is earlier than what the checkpoint recorded
    // it results in undefined behavior.
    readonly createCheckpoint: (state: ParseState) => Promise<ParseStateCheckpoint>;
    readonly restoreCheckpoint: (state: ParseState, checkpoint: ParseStateCheckpoint) => Promise<void>;

    // 12.1.6 Identifiers
    readonly readIdentifier: (state: ParseState, parser: Parser) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (state: ParseState, parser: Parser) => Promise<Ast.GeneralizedIdentifier>;
    readonly readKeyword: (state: ParseState, parser: Parser) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (state: ParseState, parser: Parser) => Promise<Ast.TDocument>;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: ParseState, parser: Parser) => Promise<Ast.Section>;
    readonly readSectionMembers: (state: ParseState, parser: Parser) => Promise<Ast.IArrayWrapper<Ast.SectionMember>>;
    readonly readSectionMember: (state: ParseState, parser: Parser) => Promise<Ast.SectionMember>;

    // 12.2.3.1 Expressions
    readonly readNullCoalescingExpression: (state: ParseState, Parser: Parser) => Promise<Ast.TExpression>;
    readonly readExpression: (state: ParseState, parser: Parser) => Promise<Ast.TExpression>;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (state: ParseState, parser: Parser) => Promise<Ast.TLogicalExpression>;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (state: ParseState, parser: Parser) => Promise<Ast.TIsExpression>;
    readonly readNullablePrimitiveType: (state: ParseState, parser: Parser) => Promise<Ast.TNullablePrimitiveType>;

    // 12.2.3.4 As expression
    readonly readAsExpression: (state: ParseState, parser: Parser) => Promise<Ast.TAsExpression>;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (state: ParseState, parser: Parser) => Promise<Ast.TEqualityExpression>;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (state: ParseState, parser: Parser) => Promise<Ast.TRelationalExpression>;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (state: ParseState, parser: Parser) => Promise<Ast.TArithmeticExpression>;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (state: ParseState, parser: Parser) => Promise<Ast.TMetadataExpression>;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (state: ParseState, parser: Parser) => Promise<Ast.TUnaryExpression>;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (state: ParseState, parser: Parser) => Promise<Ast.TPrimaryExpression>;
    readonly readRecursivePrimaryExpression: (
        state: ParseState,
        parser: Parser,
        head: Ast.TPrimaryExpression,
    ) => Promise<Ast.RecursivePrimaryExpression>;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (state: ParseState, parser: Parser) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (state: ParseState, parser: Parser) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (state: ParseState, parser: Parser) => Promise<Ast.ParenthesizedExpression>;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (state: ParseState, parser: Parser) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (state: ParseState, parser: Parser) => Promise<Ast.InvokeExpression>;

    // 12.2.3.17 List expression
    readonly readListExpression: (state: ParseState, parser: Parser) => Promise<Ast.ListExpression>;
    readonly readListItem: (state: ParseState, parser: Parser) => Promise<Ast.TListItem>;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (state: ParseState, parser: Parser) => Promise<Ast.RecordExpression>;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (state: ParseState, parser: Parser) => Promise<Ast.ItemAccessExpression>;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (state: ParseState, parser: Parser) => Promise<Ast.FieldSelector>;
    readonly readFieldProjection: (state: ParseState, parser: Parser) => Promise<Ast.FieldProjection>;
    readonly readFieldSelector: (
        state: ParseState,
        parser: Parser,
        allowOptional: boolean,
    ) => Promise<Ast.FieldSelector>;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (state: ParseState, parser: Parser) => Promise<Ast.FunctionExpression>;
    readonly readParameterList: (
        state: ParseState,
        parser: Parser,
    ) => Promise<Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>>;
    readonly readAsType: (state: ParseState, parser: Parser) => Promise<Ast.AsType>;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (state: ParseState, parser: Parser) => Promise<Ast.EachExpression>;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (state: ParseState, parser: Parser) => Promise<Ast.LetExpression>;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: ParseState, parser: Parser) => Promise<Ast.IfExpression>;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (state: ParseState, parser: Parser) => Promise<Ast.TTypeExpression>;
    readonly readType: (state: ParseState, parser: Parser) => Promise<Ast.TType>;
    readonly readPrimaryType: (state: ParseState, parser: Parser) => Promise<Ast.TPrimaryType>;
    readonly readRecordType: (state: ParseState, parser: Parser) => Promise<Ast.RecordType>;
    readonly readTableType: (state: ParseState, parser: Parser) => Promise<Ast.TableType>;
    readonly readFieldSpecificationList: (
        state: ParseState,
        parser: Parser,
        allowOpenMarker: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Promise<Ast.FieldSpecificationList>;
    readonly readListType: (state: ParseState, parser: Parser) => Promise<Ast.ListType>;
    readonly readFunctionType: (state: ParseState, parser: Parser) => Promise<Ast.FunctionType>;
    readonly readParameterSpecificationList: (
        state: ParseState,
        parser: Parser,
    ) => Promise<Ast.IParameterList<Ast.AsType>>;
    readonly readNullableType: (state: ParseState, parser: Parser) => Promise<Ast.NullableType>;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (state: ParseState, parser: Parser) => Promise<Ast.ErrorRaisingExpression>;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (state: ParseState, parser: Parser) => Promise<Ast.ErrorHandlingExpression>;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (state: ParseState, parser: Parser) => Promise<Ast.RecordLiteral>;
    readonly readFieldNamePairedAnyLiterals: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>>;
    readonly readListLiteral: (state: ParseState, parser: Parser) => Promise<Ast.ListLiteral>;
    readonly readAnyLiteral: (state: ParseState, parser: Parser) => Promise<Ast.TAnyLiteral>;
    readonly readPrimitiveType: (state: ParseState, parser: Parser) => Promise<Ast.PrimitiveType>;

    readonly readIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Promise<Ast.ICsvArray<Ast.IdentifierPairedExpression>>;
    readonly readIdentifierPairedExpression: (
        state: ParseState,
        parser: Parser,
    ) => Promise<Ast.IdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
    ) => Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: ParseState,
        parser: Parser,
    ) => Promise<Ast.GeneralizedIdentifierPairedExpression>;
}
