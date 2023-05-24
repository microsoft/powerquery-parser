// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Token } from "../../../language";
import { TNextDuoRead } from "./commonTypes";

export const EqualityExpressionAndBelowOperatorConstantKinds: Set<string> = new Set<
    Constant.ArithmeticOperator | Constant.EqualityOperator | Constant.RelationalOperator
>([
    Constant.ArithmeticOperator.Multiplication,
    Constant.ArithmeticOperator.Division,
    Constant.ArithmeticOperator.Addition,
    Constant.ArithmeticOperator.Subtraction,
    Constant.ArithmeticOperator.And,
    Constant.EqualityOperator.EqualTo,
    Constant.EqualityOperator.NotEqualTo,
    Constant.RelationalOperator.LessThan,
    Constant.RelationalOperator.LessThanEqualTo,
    Constant.RelationalOperator.GreaterThan,
    Constant.RelationalOperator.GreaterThanEqualTo,
]);

export const NextDuoReadByTokenKind: ReadonlyMap<Token.TokenKind | undefined, TNextDuoRead> = new Map<
    Token.TokenKind | undefined,
    TNextDuoRead
>([
    [
        Token.TokenKind.Asterisk,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Asterisk,
            operatorConstantKind: Constant.ArithmeticOperator.Multiplication,
        },
    ],
    [
        Token.TokenKind.Division,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Division,
            operatorConstantKind: Constant.ArithmeticOperator.Division,
        },
    ],
    [
        Token.TokenKind.Plus,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Plus,
            operatorConstantKind: Constant.ArithmeticOperator.Addition,
        },
    ],
    [
        Token.TokenKind.Minus,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Minus,
            operatorConstantKind: Constant.ArithmeticOperator.Subtraction,
        },
    ],
    [
        Token.TokenKind.Ampersand,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.ArithmeticExpression,
            operatorTokenKind: Token.TokenKind.Ampersand,
            operatorConstantKind: Constant.ArithmeticOperator.And,
        },
    ],
    [
        Token.TokenKind.Equal,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.EqualityExpression,
            operatorTokenKind: Token.TokenKind.Equal,
            operatorConstantKind: Constant.EqualityOperator.EqualTo,
        },
    ],
    [
        Token.TokenKind.NotEqual,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.EqualityExpression,
            operatorTokenKind: Token.TokenKind.NotEqual,
            operatorConstantKind: Constant.EqualityOperator.NotEqualTo,
        },
    ],
    [
        Token.TokenKind.KeywordAnd,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.LogicalExpression,
            operatorTokenKind: Token.TokenKind.KeywordAnd,
            operatorConstantKind: Constant.LogicalOperator.And,
        },
    ],
    [
        Token.TokenKind.KeywordOr,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.LogicalExpression,
            operatorTokenKind: Token.TokenKind.KeywordOr,
            operatorConstantKind: Constant.LogicalOperator.Or,
        },
    ],
    [
        Token.TokenKind.LessThan,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.LessThan,
            operatorConstantKind: Constant.RelationalOperator.LessThan,
        },
    ],
    [
        Token.TokenKind.LessThanEqualTo,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.LessThanEqualTo,
            operatorConstantKind: Constant.RelationalOperator.LessThanEqualTo,
        },
    ],
    [
        Token.TokenKind.GreaterThan,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.GreaterThan,
            operatorConstantKind: Constant.RelationalOperator.GreaterThan,
        },
    ],
    [
        Token.TokenKind.GreaterThanEqualTo,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.RelationalExpression,
            operatorTokenKind: Token.TokenKind.GreaterThanEqualTo,
            operatorConstantKind: Constant.RelationalOperator.GreaterThanEqualTo,
        },
    ],
    [
        Token.TokenKind.KeywordAs,
        {
            duoReadKind: Ast.NodeKind.NullablePrimitiveType,
            nodeKind: Ast.NodeKind.AsExpression,
            operatorTokenKind: Token.TokenKind.KeywordAs,
            operatorConstantKind: Constant.KeywordConstant.As,
        },
    ],
    [
        Token.TokenKind.KeywordIs,
        {
            duoReadKind: Ast.NodeKind.NullablePrimitiveType,
            nodeKind: Ast.NodeKind.IsExpression,
            operatorTokenKind: Token.TokenKind.KeywordIs,
            operatorConstantKind: Constant.KeywordConstant.Is,
        },
    ],
    [
        Token.TokenKind.KeywordMeta,
        {
            duoReadKind: Ast.NodeKind.UnaryExpression,
            nodeKind: Ast.NodeKind.MetadataExpression,
            operatorTokenKind: Token.TokenKind.KeywordMeta,
            operatorConstantKind: Constant.KeywordConstant.Meta,
        },
    ],
    [
        Token.TokenKind.NullCoalescingOperator,
        {
            duoReadKind: Ast.NodeKind.LogicalExpression,
            nodeKind: Ast.NodeKind.NullCoalescingExpression,
            operatorTokenKind: Token.TokenKind.NullCoalescingOperator,
            operatorConstantKind: Constant.MiscConstant.NullCoalescingOperator,
        },
    ],
]);
