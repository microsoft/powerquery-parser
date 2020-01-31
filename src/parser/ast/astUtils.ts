// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever, Option } from "../../common";
import { TokenKind } from "../../lexer";
import * as Ast from "./ast";

export function maybeUnaryOperatorFrom(maybeTokenKind: Option<TokenKind>): Option<Ast.UnaryOperator> {
    switch (maybeTokenKind) {
        case TokenKind.Plus:
            return Ast.UnaryOperator.Positive;
        case TokenKind.Minus:
            return Ast.UnaryOperator.Negative;
        case TokenKind.KeywordNot:
            return Ast.UnaryOperator.Not;
        default:
            return undefined;
    }
}

export function maybeArithmeticOperatorFrom(maybeTokenKind: Option<TokenKind>): Option<Ast.ArithmeticOperator> {
    switch (maybeTokenKind) {
        case TokenKind.Asterisk:
            return Ast.ArithmeticOperator.Multiplication;
        case TokenKind.Division:
            return Ast.ArithmeticOperator.Division;
        case TokenKind.Plus:
            return Ast.ArithmeticOperator.Addition;
        case TokenKind.Minus:
            return Ast.ArithmeticOperator.Subtraction;
        case TokenKind.Ampersand:
            return Ast.ArithmeticOperator.And;
        default:
            return undefined;
    }
}

export function maybeEqualityOperatorFrom(maybeTokenKind: Option<TokenKind>): Option<Ast.EqualityOperator> {
    switch (maybeTokenKind) {
        case TokenKind.Equal:
            return Ast.EqualityOperator.EqualTo;
        case TokenKind.NotEqual:
            return Ast.EqualityOperator.NotEqualTo;
        default:
            return undefined;
    }
}

export function maybeLogicalOperatorFrom(maybeTokenKind: Option<TokenKind>): Option<Ast.LogicalOperator> {
    switch (maybeTokenKind) {
        case TokenKind.KeywordAnd:
            return Ast.LogicalOperator.And;
        case TokenKind.KeywordOr:
            return Ast.LogicalOperator.Or;
        default:
            return undefined;
    }
}

export function maybeRelationalOperatorFrom(maybeTokenKind: Option<TokenKind>): Option<Ast.RelationalOperator> {
    switch (maybeTokenKind) {
        case TokenKind.LessThan:
            return Ast.RelationalOperator.LessThan;
        case TokenKind.LessThanEqualTo:
            return Ast.RelationalOperator.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Ast.RelationalOperator.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Ast.RelationalOperator.GreaterThanEqualTo;
        default:
            return undefined;
    }
}

export function maybeBinOpExpressionOperatorFrom(
    maybeTokenKind: Option<TokenKind>,
): Option<Ast.TBinOpExpressionOperator> {
    switch (maybeTokenKind) {
        // ArithmeticOperator
        case TokenKind.Asterisk:
            return Ast.ArithmeticOperator.Multiplication;
        case TokenKind.Division:
            return Ast.ArithmeticOperator.Division;
        case TokenKind.Plus:
            return Ast.ArithmeticOperator.Addition;
        case TokenKind.Minus:
            return Ast.ArithmeticOperator.Subtraction;
        case TokenKind.Ampersand:
            return Ast.ArithmeticOperator.And;

        // EqualityOperator
        case TokenKind.Equal:
            return Ast.EqualityOperator.EqualTo;
        case TokenKind.NotEqual:
            return Ast.EqualityOperator.NotEqualTo;

        // LogicalOperator
        case TokenKind.KeywordAnd:
            return Ast.LogicalOperator.And;
        case TokenKind.KeywordOr:
            return Ast.LogicalOperator.Or;

        // RelationalOperator
        case TokenKind.LessThan:
            return Ast.RelationalOperator.LessThan;
        case TokenKind.LessThanEqualTo:
            return Ast.RelationalOperator.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Ast.RelationalOperator.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Ast.RelationalOperator.GreaterThanEqualTo;

        // Keyword operator
        case TokenKind.KeywordAs:
            return Ast.ConstantKind.As;
        case TokenKind.KeywordIs:
            return Ast.ConstantKind.Is;
        case TokenKind.KeywordMeta:
            return Ast.ConstantKind.Meta;

        default:
            return undefined;
    }
}

export function maybeBinOpExpressionOperatorPrecedence(operator: Ast.TBinOpExpressionOperator): number {
    switch (operator) {
        case Ast.ConstantKind.Meta:
            return 110;

        case Ast.ArithmeticOperator.Multiplication:
        case Ast.ArithmeticOperator.Division:
            return 100;

        case Ast.ArithmeticOperator.Addition:
        case Ast.ArithmeticOperator.Subtraction:
        case Ast.ArithmeticOperator.And:
            return 90;

        case Ast.RelationalOperator.GreaterThan:
        case Ast.RelationalOperator.GreaterThanEqualTo:
        case Ast.RelationalOperator.LessThan:
        case Ast.RelationalOperator.LessThanEqualTo:
            return 80;

        case Ast.EqualityOperator.EqualTo:
        case Ast.EqualityOperator.NotEqualTo:
            return 70;

        case Ast.ConstantKind.As:
            return 60;

        case Ast.ConstantKind.Is:
            return 50;

        case Ast.LogicalOperator.And:
            return 40;

        case Ast.LogicalOperator.Or:
            return 30;

        default:
            throw isNever(operator);
    }
}

export function maybeLiteralKindFrom(maybeTokenKind: Option<TokenKind>): Option<Ast.LiteralKind> {
    switch (maybeTokenKind) {
        case TokenKind.HexLiteral:
        case TokenKind.KeywordHashNan:
        case TokenKind.NumericLiteral:
            return Ast.LiteralKind.Numeric;

        case TokenKind.KeywordFalse:
        case TokenKind.KeywordTrue:
            return Ast.LiteralKind.Logical;

        case TokenKind.NullLiteral:
            return Ast.LiteralKind.Null;

        case TokenKind.StringLiteral:
            return Ast.LiteralKind.Str;

        default:
            return undefined;
    }
}

export function maybeConstantKindFromIdentifieConstant(
    identifierConstant: Ast.IdentifierConstant,
): Option<Ast.ConstantKind> {
    switch (identifierConstant) {
        case Ast.IdentifierConstant.Action:
            return Ast.ConstantKind.Action;
        case Ast.IdentifierConstant.Any:
            return Ast.ConstantKind.Any;
        case Ast.IdentifierConstant.AnyNonNull:
            return Ast.ConstantKind.AnyNonNull;
        case Ast.IdentifierConstant.Binary:
            return Ast.ConstantKind.Binary;
        case Ast.IdentifierConstant.Date:
            return Ast.ConstantKind.Date;
        case Ast.IdentifierConstant.DateTime:
            return Ast.ConstantKind.DateTime;
        case Ast.IdentifierConstant.DateTimeZone:
            return Ast.ConstantKind.DateTimeZone;
        case Ast.IdentifierConstant.Duration:
            return Ast.ConstantKind.Duration;
        case Ast.IdentifierConstant.Function:
            return Ast.ConstantKind.Function;
        case Ast.IdentifierConstant.List:
            return Ast.ConstantKind.List;
        case Ast.IdentifierConstant.Logical:
            return Ast.ConstantKind.Logical;
        case Ast.IdentifierConstant.None:
            return Ast.ConstantKind.None;
        case Ast.IdentifierConstant.Nullable:
            return Ast.ConstantKind.Nullable;
        case Ast.IdentifierConstant.Number:
            return Ast.ConstantKind.Number;
        case Ast.IdentifierConstant.Optional:
            return Ast.ConstantKind.Optional;
        case Ast.IdentifierConstant.Record:
            return Ast.ConstantKind.Record;
        case Ast.IdentifierConstant.Table:
            return Ast.ConstantKind.Table;
        case Ast.IdentifierConstant.Text:
            return Ast.ConstantKind.Text;
        case Ast.IdentifierConstant.Time:
            return Ast.ConstantKind.Time;
        default:
            return undefined;
    }
}

export function isIdentifierConstant(
    maybeIdentifierConstant: string,
): maybeIdentifierConstant is Ast.IdentifierConstant {
    switch (maybeIdentifierConstant) {
        case Ast.IdentifierConstant.Any:
        case Ast.IdentifierConstant.AnyNonNull:
        case Ast.IdentifierConstant.Binary:
        case Ast.IdentifierConstant.Date:
        case Ast.IdentifierConstant.DateTime:
        case Ast.IdentifierConstant.DateTimeZone:
        case Ast.IdentifierConstant.Duration:
        case Ast.IdentifierConstant.Function:
        case Ast.IdentifierConstant.List:
        case Ast.IdentifierConstant.Logical:
        case Ast.IdentifierConstant.None:
        case Ast.IdentifierConstant.Nullable:
        case Ast.IdentifierConstant.Number:
        case Ast.IdentifierConstant.Optional:
        case Ast.IdentifierConstant.Record:
        case Ast.IdentifierConstant.Table:
        case Ast.IdentifierConstant.Text:
        case Ast.IdentifierConstant.Time:
            return true;
        default:
            return false;
    }
}

export function isTBinOpExpression(node: Ast.TNode): node is Ast.TBinOpExpression {
    switch (node.kind) {
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.MetadataExpression:
        case Ast.NodeKind.RelationalExpression:
            return true;

        default:
            return false;
    }
}

export function isPairedConstant(x: Ast.ConstantKind, y: Ast.ConstantKind): boolean {
    if (x.length !== 1 || y.length !== 1) {
        return false;
    }

    // If given x === ')' and y === '(' then swap positions.
    const low: Ast.ConstantKind = x < y ? x : y;
    const high: Ast.ConstantKind = low === x ? y : x;

    return (
        (low === Ast.ConstantKind.LeftBrace && high === Ast.ConstantKind.RightBrace) ||
        (low === Ast.ConstantKind.LeftBracket && high === Ast.ConstantKind.RightBracket) ||
        (low === Ast.ConstantKind.LeftParenthesis && high === Ast.ConstantKind.RightParenthesis)
    );
}

export function testAnyNodeKind(
    value: Ast.NodeKind,
    allowedNodeKinds: ReadonlyArray<Ast.NodeKind>,
    details: Option<{}> = undefined,
): Option<CommonError.InvariantError> {
    return allowedNodeKinds.indexOf(value) === -1
        ? new CommonError.InvariantError(`NodeKind value is not an allowed NodeKind value`, details)
        : undefined;
}
