// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast } from "..";
import { Option } from "../../common";

export interface IParser<State> {
    // 12.1.6 Identifiers
    readonly readIdentifier: (state: State) => Ast.Identifier;
    readonly readGeneralizedIdentifier: (state: State) => Ast.GeneralizedIdentifier;
    readonly readKeyword: (state: State) => Ast.IdentifierExpression;

    // 12.2.1 Documents
    readonly readDocument: (state: State) => Ast.TDocument;

    // 12.2.2 Section Documents
    readonly readSectionDocument: (state: State) => Ast.Section;
    readonly readSectionMembers: (state: State) => Ast.IArrayWrapper<Ast.SectionMember>;
    readonly readSectionMember: (state: State) => Ast.SectionMember;

    // 12.2.3.1 Expressions
    readonly readExpression: (state: State) => Ast.TExpression;

    // 12.2.3.2 Logical expressions
    readonly readLogicalExpression: (state: State) => Ast.TLogicalExpression;

    // 12.2.3.3 Is expression
    readonly readIsExpression: (state: State) => Ast.TIsExpression;
    readonly readNullablePrimitiveType: (state: State) => Ast.TNullablePrimitiveType;

    // 12.2.3.4 As expression
    readonly readAsExpression: (state: State) => Ast.TAsExpression;

    // 12.2.3.5 Equality expression
    readonly readEqualityExpression: (state: State) => Ast.TEqualityExpression;

    // 12.2.3.6 Relational expression
    readonly readRelationalExpression: (state: State) => Ast.TRelationalExpression;

    // 12.2.3.7 Arithmetic expressions
    readonly readArithmeticExpression: (state: State) => Ast.TArithmeticExpression;

    // 12.2.3.8 Metadata expression
    readonly readMetadataExpression: (state: State) => Ast.TMetadataExpression;

    // 12.2.3.9 Unary expression
    readonly readUnaryExpression: (state: State) => Ast.TUnaryExpression;

    // 12.2.3.10 Primary expression
    readonly readPrimaryExpression: (state: State) => Ast.TPrimaryExpression;
    readonly readRecursivePrimaryExpression: (
        state: State,
        head: Ast.TPrimaryExpression,
    ) => Ast.RecursivePrimaryExpression;

    // 12.2.3.11 Literal expression
    readonly readLiteralExpression: (state: State) => Ast.LiteralExpression;

    // 12.2.3.12 Identifier expression
    readonly readIdentifierExpression: (state: State) => Ast.IdentifierExpression;

    // 12.2.3.14 Parenthesized expression
    readonly readParenthesizedExpression: (state: State) => Ast.ParenthesizedExpression;

    // 12.2.3.15 Not-implemented expression
    readonly readNotImplementedExpression: (state: State) => Ast.NotImplementedExpression;

    // 12.2.3.16 Invoke expression
    readonly readInvokeExpression: (state: State) => Ast.InvokeExpression;

    // 12.2.3.17 List expression
    readonly readListExpression: (state: State) => Ast.ListExpression;
    readonly readListItem: (state: State) => Ast.TListItem;

    // 12.2.3.18 Record expression
    readonly readRecordExpression: (state: State) => Ast.RecordExpression;

    // 12.2.3.19 Item access expression
    readonly readItemAccessExpression: (state: State) => Ast.ItemAccessExpression;

    // 12.2.3.20 Field access expression
    readonly readFieldSelection: (state: State) => Ast.FieldSelector;
    readonly readFieldProjection: (state: State) => Ast.FieldProjection;
    readonly readFieldSelector: (state: State, allowOptional: boolean) => Ast.FieldSelector;

    // 12.2.3.21 Function expression
    readonly readFunctionExpression: (state: State) => Ast.FunctionExpression;
    readonly readParameterList: (state: State) => Ast.IParameterList<Option<Ast.AsNullablePrimitiveType>>;
    readonly readAsType: (state: State) => Ast.AsType;

    // 12.2.3.22 Each expression
    readonly readEachExpression: (state: State) => Ast.EachExpression;

    // 12.2.3.23 Let expression
    readonly readLetExpression: (state: State) => Ast.LetExpression;

    // 12.2.3.24 If expression
    readonly readIfExpression: (state: State) => Ast.IfExpression;

    // 12.2.3.25 Type expression
    readonly readTypeExpression: (state: State) => Ast.TTypeExpression;
    readonly readType: (state: State) => Ast.TType;
    readonly readPrimaryType: (state: State) => Ast.TPrimaryType;
    readonly readRecordType: (state: State) => Ast.RecordType;
    readonly readTableType: (state: State) => Ast.TableType;
    readonly readFieldSpecificationList: (state: State, allowOpenMarker: boolean) => Ast.FieldSpecificationList;
    readonly readListType: (state: State) => Ast.ListType;
    readonly readFunctionType: (state: State) => Ast.FunctionType;
    readonly readParameterSpecificationList: (state: State) => Ast.IParameterList<Ast.AsType>;
    readonly readNullableType: (state: State) => Ast.NullableType;

    // 12.2.3.26 Error raising expression
    readonly readErrorRaisingExpression: (state: State) => Ast.ErrorRaisingExpression;

    // 12.2.3.27 Error handling expression
    readonly readErrorHandlingExpression: (state: State) => Ast.ErrorHandlingExpression;

    // 12.2.4 Literal Attributes
    readonly readRecordLiteral: (state: State) => Ast.RecordLiteral;
    readonly readFieldNamePairedAnyLiterals: (
        state: State,
        onePairRequired: boolean,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedAnyLiteral>;
    readonly readListLiteral: (state: State) => Ast.ListLiteral;
    readonly readAnyLiteral: (state: State) => Ast.TAnyLiteral;
    readonly readPrimitiveType: (state: State) => Ast.PrimitiveType;

    readonly readIdentifierPairedExpressions: (
        state: State,
        onePairRequired: boolean,
    ) => Ast.ICsvArray<Ast.IdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpressions: (
        state: State,
        onePairRequired: boolean,
    ) => Ast.ICsvArray<Ast.GeneralizedIdentifierPairedExpression>;
    readonly readGeneralizedIdentifierPairedExpression: (state: State) => Ast.GeneralizedIdentifierPairedExpression;
    readonly readIdentifierPairedExpression: (state: State) => Ast.IdentifierPairedExpression;
}
