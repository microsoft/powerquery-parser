// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, Constant, Token } from "../../../language";

export const enum CombinatorialParserV2TraceConstant {
    CombinatorialParseV2 = "CombinatorialParseV2",
}

export type TDuoReadKind =
    | Ast.NodeKind.LogicalExpression
    | Ast.NodeKind.NullablePrimitiveType
    | Ast.NodeKind.UnaryExpression;

export type TNextDuoRead = NextDuoReadLogicalExpression | NextDuoReadNullablePrimitiveType | NextDuoReadUnaryExpression;

export type NextDuoReadLogicalExpression = {
    readonly duoReadKind: Ast.NodeKind.LogicalExpression;
    readonly nodeKind: Ast.NodeKind.NullCoalescingExpression;
    readonly operatorTokenKind: Token.TokenKind.NullCoalescingOperator;
    readonly operatorConstantKind: Constant.MiscConstant.NullCoalescingOperator;
};

export type NextDuoReadNullablePrimitiveType = {
    readonly duoReadKind: Ast.NodeKind.NullablePrimitiveType;
} & (
    | {
          readonly nodeKind: Ast.NodeKind.AsExpression;
          readonly operatorTokenKind: Token.TokenKind.KeywordAs;
          readonly operatorConstantKind: Constant.KeywordConstant.As;
      }
    | {
          readonly nodeKind: Ast.NodeKind.IsExpression;
          readonly operatorTokenKind: Token.TokenKind.KeywordIs;
          readonly operatorConstantKind: Constant.KeywordConstant.Is;
      }
);

type NextDuoReadUnaryExpression = {
    readonly duoReadKind: Ast.NodeKind.UnaryExpression;
} & (
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: Token.TokenKind.Asterisk;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Multiplication;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: Token.TokenKind.Division;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Division;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: Token.TokenKind.Plus;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Addition;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: Token.TokenKind.Minus;
          readonly operatorConstantKind: Constant.ArithmeticOperator.Subtraction;
      }
    | {
          readonly nodeKind: Ast.NodeKind.ArithmeticExpression;
          readonly operatorTokenKind: Token.TokenKind.Ampersand;
          readonly operatorConstantKind: Constant.ArithmeticOperator.And;
      }
    | {
          readonly nodeKind: Ast.NodeKind.EqualityExpression;
          readonly operatorTokenKind: Token.TokenKind.Equal;
          readonly operatorConstantKind: Constant.EqualityOperator.EqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.EqualityExpression;
          readonly operatorTokenKind: Token.TokenKind.NotEqual;
          readonly operatorConstantKind: Constant.EqualityOperator.NotEqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.LogicalExpression;
          readonly operatorTokenKind: Token.TokenKind.KeywordAnd;
          readonly operatorConstantKind: Constant.LogicalOperator.And;
      }
    | {
          readonly nodeKind: Ast.NodeKind.LogicalExpression;
          readonly operatorTokenKind: Token.TokenKind.KeywordOr;
          readonly operatorConstantKind: Constant.LogicalOperator.Or;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: Token.TokenKind.LessThan;
          readonly operatorConstantKind: Constant.RelationalOperator.LessThan;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: Token.TokenKind.LessThanEqualTo;
          readonly operatorConstantKind: Constant.RelationalOperator.LessThanEqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: Token.TokenKind.GreaterThan;
          readonly operatorConstantKind: Constant.RelationalOperator.GreaterThan;
      }
    | {
          readonly nodeKind: Ast.NodeKind.RelationalExpression;
          readonly operatorTokenKind: Token.TokenKind.GreaterThanEqualTo;
          readonly operatorConstantKind: Constant.RelationalOperator.GreaterThanEqualTo;
      }
    | {
          readonly nodeKind: Ast.NodeKind.MetadataExpression;
          readonly operatorTokenKind: Token.TokenKind.KeywordMeta;
          readonly operatorConstantKind: Constant.KeywordConstant.Meta;
      }
);

export interface ReadAttempt {
    readonly operatorConstants: ReadonlyArray<Ast.TBinOpExpressionConstant>;
    readonly operands: ReadonlyArray<Ast.TBinOpExpression | Ast.TUnaryExpression | Ast.TNullablePrimitiveType>;
}
