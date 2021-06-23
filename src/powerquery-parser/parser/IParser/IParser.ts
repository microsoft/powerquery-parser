// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IParseState, ParseError } from "..";
import { Result } from "../../common";
import { Ast } from "../../language";

export type TriedParse = Result<ParseOk, ParseError.TParseError>;

export interface IParseStateCheckpoint {
    readonly tokenIndex: number;
    readonly contextStateIdCounter: number;
    readonly maybeContextNodeId: number | undefined;
}

export interface ParseOk {
    readonly root: Ast.TNode;
    readonly state: IParseState;
}

export interface IParser {
    // Update `state` to match the the `update`.
    readonly applyState: (state: IParseState, update: IParseState) => void;
    // Create a deep copy of S.
    readonly copyState: (state: IParseState) => IParseState;

    // Checkpoints are a snapshot for a particular state,
    // and should enable reverting the state to its earlier version. They do not work on later states.
    // Eg. given the history below:
    //  You can restore checkpoint 2 and then checkpoint 1,
    //  but restoring checkpoint 1 and then checkpoint 2 will result in undefined behavior.
    // Initial state ------- checkpoint 1 -- checkpoint 2 --- current.
    readonly createCheckpoint: (state: IParseState) => IParseStateCheckpoint;
    readonly restoreCheckpoint: (state: IParseState, checkpoint: IParseStateCheckpoint) => void;

    // 12.1.6 Identifiers
    readonly readIdentifier: (state: IParseState, parser: IParser) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (state: IParseState, parser: IParser) => Ast.GeneralizedIdentifier;
    readonly readKeyword: (state: IParseState, parser: IParser) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (state: IParseState, parser: IParser) => Ast.TDocument;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: IParseState, parser: IParser) => Ast.Section;
    readonly readSectionMembers: (state: IParseState, parser: IParser) => Ast.IArrayWrapper<Ast.SectionMember>;
    readonly readSectionMember: (state: IParseState, parser: IParser) => Ast.SectionMember;

    // 12.2.3.1 Expressions
    readonly readNullCoalescingExpression: (state: IParseState, Parser: IParser) => Ast.TExpression;
    readonly readExpression: (state: IParseState, parser: IParser) => Ast.TExpression;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (state: IParseState, parser: IParser) => Ast.TLogicalExpression;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (state: IParseState, parser: IParser) => Ast.TIsExpression;
    readonly readNullablePrimitiveType: (state: IParseState, parser: IParser) => Ast.TNullablePrimitiveType;

    // 12.2.3.4 As expression
    readonly readAsExpression: (state: IParseState, parser: IParser) => Ast.TAsExpression;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (state: IParseState, parser: IParser) => Ast.TEqualityExpression;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (state: IParseState, parser: IParser) => Ast.TRelationalExpression;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (state: IParseState, parser: IParser) => Ast.TArithmeticExpression;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (state: IParseState, parser: IParser) => Ast.TMetadataExpression;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (state: IParseState, parser: IParser) => Ast.TUnaryExpression;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (state: IParseState, parser: IParser) => Ast.TPrimaryExpression;
    readonly readRecursivePrimaryExpression: (
        state: IParseState,
        parser: IParser,
        head: Ast.TPrimaryExpression,
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (state: IParseState, parser: IParser) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (state: IParseState, parser: IParser) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (state: IParseState, parser: IParser) => Ast.ParenthesizedExpression;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (state: IParseState, parser: IParser) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (state: IParseState, parser: IParser) => Ast.InvokeExpression;

    // 12.2.3.17 List expression
    readonly readListExpression: (state: IParseState, parser: IParser) => Ast.ListExpression;
    readonly readListItem: (state: IParseState, parser: IParser) => Ast.TListItem;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (state: IParseState, parser: IParser) => Ast.RecordExpression;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (state: IParseState, parser: IParser) => Ast.ItemAccessExpression;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (state: IParseState, parser: IParser) => Ast.FieldSelector;
    readonly readFieldProjection: (state: IParseState, parser: IParser) => Ast.FieldProjection;
    readonly readFieldSelector: (state: IParseState, parser: IParser, allowOptional: boolean) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (state: IParseState, parser: IParser) => Ast.FunctionExpression;
    readonly readParameterList: (
        state: IParseState,
        parser: IParser,
    ) => Ast.IParameterList<Ast.AsNullablePrimitiveType | undefined>;
    readonly readAsType: (state: IParseState, parser: IParser) => Ast.AsType;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (state: IParseState, parser: IParser) => Ast.EachExpression;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (state: IParseState, parser: IParser) => Ast.LetExpression;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: IParseState, parser: IParser) => Ast.IfExpression;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (state: IParseState, parser: IParser) => Ast.TTypeExpression;
    readonly readType: (state: IParseState, parser: IParser) => Ast.TType;
    readonly readPrimaryType: (state: IParseState, parser: IParser) => Ast.TPrimaryType;
    readonly readRecordType: (state: IParseState, parser: IParser) => Ast.RecordType;
    readonly readTableType: (state: IParseState, parser: IParser) => Ast.TableType;
    readonly readFieldSpecificationList: (
        state: IParseState,
        parser: IParser,
        allowOpenMarker: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.FieldSpecificationList;
    readonly readListType: (state: IParseState, parser: IParser) => Ast.ListType;
    readonly readFunctionType: (state: IParseState, parser: IParser) => Ast.FunctionType;
    readonly readParameterSpecificationList: (state: IParseState, parser: IParser) => Ast.IParameterList<Ast.AsType>;
    readonly readNullableType: (state: IParseState, parser: IParser) => Ast.NullableType;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (state: IParseState, parser: IParser) => Ast.ErrorRaisingExpression;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (state: IParseState, parser: IParser) => Ast.ErrorHandlingExpression;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (state: IParseState, parser: IParser) => Ast.RecordLiteral;
    readonly readFieldNamePairedAnyLiterals: (
        state: IParseState,
        parser: IParser,
        onePairRequired: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: (state: IParseState, parser: IParser) => Ast.ListLiteral;
    readonly readAnyLiteral: (state: IParseState, parser: IParser) => Ast.TAnyLiteral;
    readonly readPrimitiveType: (state: IParseState, parser: IParser) => Ast.PrimitiveType;

    readonly readIdentifierPairedExpressions: (
        state: IParseState,
        parser: IParser,
        onePairRequired: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readIdentifierPairedExpression: (state: IParseState, parser: IParser) => Ast.IdentifierPairedExpression;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: IParseState,
        parser: IParser,
        onePairRequired: boolean,
        testPostCommaError: (state: IParseState) => ParseError.TInnerParseError | undefined,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (
        state: IParseState,
        parser: IParser,
    ) => Ast.GeneralizedIdentifierPairedExpression;
}
