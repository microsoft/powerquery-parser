// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Token } from "../../../language";

export type TNextDuoRead = NextDuoReadLogicalExpression | NextDuoReadNullablePrimitiveType | NextDuoReadUnaryExpression;

type TSupportedTokenKinds =
    | Token.TokenKind.Asterisk
    | Token.TokenKind.Division
    | Token.TokenKind.Plus
    | Token.TokenKind.Minus
    | Token.TokenKind.Ampersand
    | Token.TokenKind.Equal
    | Token.TokenKind.NotEqual
    | Token.TokenKind.LessThan
    | Token.TokenKind.LessThanEqualTo
    | Token.TokenKind.GreaterThan
    | Token.TokenKind.GreaterThanEqualTo
    | Token.TokenKind.KeywordAnd
    | Token.TokenKind.KeywordOr
    | Token.TokenKind.KeywordAs
    | Token.TokenKind.KeywordIs
    | Token.TokenKind.KeywordMeta
    | Token.TokenKind.NullCoalescingOperator;

type NextDuoTrio<T extends TSupportedTokenKinds> = {
    readonly nodeKind: NodeKindByTokenKind[T];
    readonly operatorTokenKind: T;
    readonly operatorConstantKind: OperatorConstantKindByTokenKind[T];
};

interface NodeKindByTokenKind {
    // ArithmeticExpression
    [Token.TokenKind.Asterisk]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Division]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Plus]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Minus]: Ast.NodeKind.ArithmeticExpression;
    [Token.TokenKind.Ampersand]: Ast.NodeKind.ArithmeticExpression;
    // EqualityExpression
    [Token.TokenKind.Equal]: Ast.NodeKind.EqualityExpression;
    [Token.TokenKind.NotEqual]: Ast.NodeKind.EqualityExpression;
    // RelationalExpression
    [Token.TokenKind.LessThan]: Ast.NodeKind.RelationalExpression;
    [Token.TokenKind.LessThanEqualTo]: Ast.NodeKind.RelationalExpression;
    [Token.TokenKind.GreaterThan]: Ast.NodeKind.RelationalExpression;
    [Token.TokenKind.GreaterThanEqualTo]: Ast.NodeKind.RelationalExpression;
    // LogicalExpression
    [Token.TokenKind.KeywordAnd]: Ast.NodeKind.LogicalExpression;
    [Token.TokenKind.KeywordOr]: Ast.NodeKind.LogicalExpression;
    // KeywordConstant
    [Token.TokenKind.KeywordAs]: Ast.NodeKind.AsExpression;
    [Token.TokenKind.KeywordIs]: Ast.NodeKind.IsExpression;
    [Token.TokenKind.KeywordMeta]: Ast.NodeKind.MetadataExpression;
    // MiscConstant
    [Token.TokenKind.NullCoalescingOperator]: Ast.NodeKind.NullCoalescingExpression;
}

interface OperatorConstantKindByTokenKind {
    // ArithmeticExpression
    [Token.TokenKind.Asterisk]: Constant.ArithmeticOperator.Multiplication;
    [Token.TokenKind.Division]: Constant.ArithmeticOperator.Division;
    [Token.TokenKind.Plus]: Constant.ArithmeticOperator.Addition;
    [Token.TokenKind.Minus]: Constant.ArithmeticOperator.Subtraction;
    [Token.TokenKind.Ampersand]: Constant.ArithmeticOperator.And;
    // EqualityExpression
    [Token.TokenKind.Equal]: Constant.EqualityOperator.EqualTo;
    [Token.TokenKind.NotEqual]: Constant.EqualityOperator.NotEqualTo;
    // RelationalExpression
    [Token.TokenKind.LessThan]: Constant.RelationalOperator.LessThan;
    [Token.TokenKind.LessThanEqualTo]: Constant.RelationalOperator.LessThanEqualTo;
    [Token.TokenKind.GreaterThan]: Constant.RelationalOperator.GreaterThan;
    [Token.TokenKind.GreaterThanEqualTo]: Constant.RelationalOperator.GreaterThanEqualTo;
    // LogicalExpression
    [Token.TokenKind.KeywordAnd]: Constant.LogicalOperator.And;
    [Token.TokenKind.KeywordOr]: Constant.LogicalOperator.Or;
    // KeywordConstant
    [Token.TokenKind.KeywordAs]: Constant.KeywordConstant.As;
    [Token.TokenKind.KeywordIs]: Constant.KeywordConstant.Is;
    [Token.TokenKind.KeywordMeta]: Constant.KeywordConstant.Meta;
    // MiscConstant
    [Token.TokenKind.NullCoalescingOperator]: Constant.MiscConstant.NullCoalescingOperator;
}

type NextDuoReadLogicalExpression = {
    readonly duoReadKind: Ast.NodeKind.LogicalExpression;
} & NextDuoTrio<Token.TokenKind.NullCoalescingOperator>;

type NextDuoReadNullablePrimitiveType = {
    readonly duoReadKind: Ast.NodeKind.NullablePrimitiveType;
} & (NextDuoTrio<Token.TokenKind.KeywordAs> | NextDuoTrio<Token.TokenKind.KeywordIs>);

type NextDuoReadUnaryExpression = {
    readonly duoReadKind: Ast.NodeKind.UnaryExpression;
} & (
    | NextDuoTrio<Token.TokenKind.Asterisk>
    | NextDuoTrio<Token.TokenKind.Division>
    | NextDuoTrio<Token.TokenKind.Plus>
    | NextDuoTrio<Token.TokenKind.Minus>
    | NextDuoTrio<Token.TokenKind.Ampersand>
    | NextDuoTrio<Token.TokenKind.Equal>
    | NextDuoTrio<Token.TokenKind.NotEqual>
    | NextDuoTrio<Token.TokenKind.KeywordAnd>
    | NextDuoTrio<Token.TokenKind.KeywordOr>
    | NextDuoTrio<Token.TokenKind.LessThan>
    | NextDuoTrio<Token.TokenKind.LessThanEqualTo>
    | NextDuoTrio<Token.TokenKind.GreaterThan>
    | NextDuoTrio<Token.TokenKind.GreaterThanEqualTo>
    | NextDuoTrio<Token.TokenKind.KeywordAs>
    | NextDuoTrio<Token.TokenKind.KeywordIs>
    | NextDuoTrio<Token.TokenKind.KeywordMeta>
);
