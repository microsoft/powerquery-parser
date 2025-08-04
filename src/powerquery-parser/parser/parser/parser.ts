// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParseError, ParseState } from "..";
import { Ast } from "../../language";
import { Result } from "../../common";

export type TriedParse = Result<ParseOk, ParseError.TParseError>;

export interface ParseStateCheckpoint {
    readonly tokenIndex: number;
    readonly contextStateIdCounter: number;
    readonly contextNodeId: number | undefined;
}

export interface ParseOk {
    readonly root: Ast.TNode;
    readonly state: ParseState;
}

export interface Parser {
    // Update `state` to match the the `update`.
    readonly applyState: (state: ParseState, update: ParseState) => Promise<void>;
    // Create a deep copy of ParseState.
    readonly copyState: (state: ParseState) => Promise<ParseState>;

    // Checkpoints are a snapshot at a particular time.
    // You can use a checkpoint to restore the parser's state back to when the checkpoint was created.
    // If the checkpoint is used on a parser that didn't create the checkpoint it results in undefiend behavior.
    // If the checkpoint is used on a parser whose state is earlier than what the checkpoint recorded
    // it results in undefined behavior.
    readonly checkpoint: (state: ParseState) => Promise<ParseStateCheckpoint>;
    readonly restoreCheckpoint: (state: ParseState, checkpoint: ParseStateCheckpoint) => Promise<void>;

    // 12.1.6 Identifiers
    readonly readIdentifier: (
        state: ParseState,
        parser: Parser,
        identifierContextKind: Ast.IdentifierContextKind,
        correlationId: number | undefined,
    ) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.GeneralizedIdentifier>;
    readonly readKeyword: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Ast.IdentifierExpression;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.Section>;
    readonly readSectionMembers: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.IArrayWrapper<Ast.SectionMember>>;
    readonly readSectionMember: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.SectionMember>;

    // 12.2.3.1 Expressions
    readonly readNullCoalescingExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TExpression>;
    readonly readExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TExpression>;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TLogicalExpression>;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TIsExpression>;
    readonly readNullablePrimitiveType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TNullablePrimitiveType>;

    // 12.2.3.4 As expression
    readonly readAsExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TAsExpression>;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TEqualityExpression>;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TRelationalExpression>;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TArithmeticExpression>;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TMetadataExpression>;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TUnaryExpression>;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TPrimaryExpression>;
    readonly readRecursivePrimaryExpression: (
        state: ParseState,
        parser: Parser,
        head: Ast.TPrimaryExpression,
        correlationId: number | undefined,
    ) => Promise<Ast.RecursivePrimaryExpression>;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.ParenthesizedExpression>;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.InvokeExpression>;

    // 12.2.3.17 List expression
    readonly readListExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.ListExpression>;
    readonly readListItem: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TListItem>;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.RecordExpression>;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.ItemAccessExpression>;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.FieldSelector>;
    readonly readFieldProjection: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.FieldProjection>;
    readonly readFieldSelector: (
        state: ParseState,
        parser: Parser,
        allowOptional: boolean,
        correlationId: number | undefined,
    ) => Promise<Ast.FieldSelector>;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.FunctionExpression>;
    readonly readParameterList: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>>;
    readonly readAsType: (state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<Ast.AsType>;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.EachExpression>;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.LetExpression>;

    // 12.2.3.24 If expression
    readonly readIfExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.IfExpression>;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TTypeExpression>;
    readonly readType: (state: ParseState, parser: Parser, correlationId: number | undefined) => Promise<Ast.TType>;
    readonly readPrimaryType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TPrimaryType>;
    readonly readRecordType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.RecordType>;
    readonly readTableType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TableType>;
    readonly readFieldSpecificationList: (
        state: ParseState,
        parser: Parser,
        allowOpenMarker: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
        correlationId: number | undefined,
    ) => Promise<Ast.FieldSpecificationList>;
    readonly readListType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.ListType>;
    readonly readFunctionType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.FunctionType>;
    readonly readParameterSpecificationList: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.IParameterList<Ast.AsType>>;
    readonly readNullableType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.NullableType>;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.ErrorRaisingExpression>;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TErrorHandlingExpression>;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.RecordLiteral>;
    readonly readFieldNamePairedAnyLiterals: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
        correlationId: number | undefined,
    ) => Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>>;
    readonly readListLiteral: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.ListLiteral>;
    readonly readAnyLiteral: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.TAnyLiteral>;
    readonly readPrimitiveType: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.PrimitiveType>;

    readonly readIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
        correlationId: number | undefined,
    ) => Promise<Ast.ICsvArray<Ast.IdentifierPairedExpression>>;
    readonly readIdentifierPairedExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.IdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: ParseState,
        parser: Parser,
        onePairRequired: boolean,
        testPostCommaError: (state: ParseState) => ParseError.TInnerParseError | undefined,
        correlationId: number | undefined,
    ) => Promise<Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: ParseState,
        parser: Parser,
        correlationId: number | undefined,
    ) => Promise<Ast.GeneralizedIdentifierPairedExpression>;
}
