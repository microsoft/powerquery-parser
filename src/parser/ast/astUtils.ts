// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, isNever } from "../../common";
import { TokenKind } from "../../lexer";
import { Ast } from "../ast";

export function maybeUnaryOperatorKindFrom(maybeTokenKind: TokenKind | undefined): Ast.UnaryOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Plus:
            return Ast.UnaryOperatorKind.Positive;
        case TokenKind.Minus:
            return Ast.UnaryOperatorKind.Negative;
        case TokenKind.KeywordNot:
            return Ast.UnaryOperatorKind.Not;
        default:
            return undefined;
    }
}

export function maybeArithmeticOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Ast.ArithmeticOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Asterisk:
            return Ast.ArithmeticOperatorKind.Multiplication;
        case TokenKind.Division:
            return Ast.ArithmeticOperatorKind.Division;
        case TokenKind.Plus:
            return Ast.ArithmeticOperatorKind.Addition;
        case TokenKind.Minus:
            return Ast.ArithmeticOperatorKind.Subtraction;
        case TokenKind.Ampersand:
            return Ast.ArithmeticOperatorKind.And;
        default:
            return undefined;
    }
}

export function maybeEqualityOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Ast.EqualityOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Equal:
            return Ast.EqualityOperatorKind.EqualTo;
        case TokenKind.NotEqual:
            return Ast.EqualityOperatorKind.NotEqualTo;
        default:
            return undefined;
    }
}

export function maybeLogicalOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Ast.LogicalOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.KeywordAnd:
            return Ast.LogicalOperatorKind.And;
        case TokenKind.KeywordOr:
            return Ast.LogicalOperatorKind.Or;
        default:
            return undefined;
    }
}

export function maybeRelationalOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Ast.RelationalOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.LessThan:
            return Ast.RelationalOperatorKind.LessThan;
        case TokenKind.LessThanEqualTo:
            return Ast.RelationalOperatorKind.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Ast.RelationalOperatorKind.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Ast.RelationalOperatorKind.GreaterThanEqualTo;
        default:
            return undefined;
    }
}

export function maybeBinOpExpressionOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Ast.TBinOpExpressionOperator | undefined {
    switch (maybeTokenKind) {
        // ArithmeticOperator
        case TokenKind.Asterisk:
            return Ast.ArithmeticOperatorKind.Multiplication;
        case TokenKind.Division:
            return Ast.ArithmeticOperatorKind.Division;
        case TokenKind.Plus:
            return Ast.ArithmeticOperatorKind.Addition;
        case TokenKind.Minus:
            return Ast.ArithmeticOperatorKind.Subtraction;
        case TokenKind.Ampersand:
            return Ast.ArithmeticOperatorKind.And;

        // EqualityOperator
        case TokenKind.Equal:
            return Ast.EqualityOperatorKind.EqualTo;
        case TokenKind.NotEqual:
            return Ast.EqualityOperatorKind.NotEqualTo;

        // LogicalOperator
        case TokenKind.KeywordAnd:
            return Ast.LogicalOperatorKind.And;
        case TokenKind.KeywordOr:
            return Ast.LogicalOperatorKind.Or;

        // RelationalOperator
        case TokenKind.LessThan:
            return Ast.RelationalOperatorKind.LessThan;
        case TokenKind.LessThanEqualTo:
            return Ast.RelationalOperatorKind.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Ast.RelationalOperatorKind.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Ast.RelationalOperatorKind.GreaterThanEqualTo;

        // Keyword operator
        case TokenKind.KeywordAs:
            return Ast.KeywordConstantKind.As;
        case TokenKind.KeywordIs:
            return Ast.KeywordConstantKind.Is;
        case TokenKind.KeywordMeta:
            return Ast.KeywordConstantKind.Meta;

        default:
            return undefined;
    }
}

export function binOpExpressionOperatorPrecedence(operator: Ast.TBinOpExpressionOperator): number {
    switch (operator) {
        case Ast.KeywordConstantKind.Meta:
            return 110;

        case Ast.ArithmeticOperatorKind.Multiplication:
        case Ast.ArithmeticOperatorKind.Division:
            return 100;

        case Ast.ArithmeticOperatorKind.Addition:
        case Ast.ArithmeticOperatorKind.Subtraction:
        case Ast.ArithmeticOperatorKind.And:
            return 90;

        case Ast.RelationalOperatorKind.GreaterThan:
        case Ast.RelationalOperatorKind.GreaterThanEqualTo:
        case Ast.RelationalOperatorKind.LessThan:
        case Ast.RelationalOperatorKind.LessThanEqualTo:
            return 80;

        case Ast.EqualityOperatorKind.EqualTo:
        case Ast.EqualityOperatorKind.NotEqualTo:
            return 70;

        case Ast.KeywordConstantKind.As:
            return 60;

        case Ast.KeywordConstantKind.Is:
            return 50;

        case Ast.LogicalOperatorKind.And:
            return 40;

        case Ast.LogicalOperatorKind.Or:
            return 30;

        default:
            throw isNever(operator);
    }
}

export function maybeLiteralKindFrom(maybeTokenKind: TokenKind | undefined): Ast.LiteralKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.HexLiteral:
        case TokenKind.KeywordHashNan:
        case TokenKind.KeywordHashInfinity:
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

export function primitiveTypeConstantKindFrom(
    node: Ast.AsNullablePrimitiveType | Ast.NullablePrimitiveType | Ast.PrimitiveType,
): Ast.PrimitiveTypeConstantKind {
    switch (node.kind) {
        case Ast.NodeKind.AsNullablePrimitiveType:
            return primitiveTypeConstantKindFrom(node.paired);

        case Ast.NodeKind.NullablePrimitiveType:
            return node.paired.primitiveType.constantKind;

        case Ast.NodeKind.PrimitiveType:
            return node.primitiveType.constantKind;

        default:
            throw isNever(node);
    }
}

export function isPrimitiveTypeConstantKind(
    maybePrimitiveTypeConstantKind: string,
): maybePrimitiveTypeConstantKind is Ast.PrimitiveTypeConstantKind {
    switch (maybePrimitiveTypeConstantKind) {
        case Ast.IdentifierConstantKind.Nullable:
        case Ast.IdentifierConstantKind.Optional:
        case Ast.PrimitiveTypeConstantKind.Any:
        case Ast.PrimitiveTypeConstantKind.AnyNonNull:
        case Ast.PrimitiveTypeConstantKind.Binary:
        case Ast.PrimitiveTypeConstantKind.Date:
        case Ast.PrimitiveTypeConstantKind.DateTime:
        case Ast.PrimitiveTypeConstantKind.DateTimeZone:
        case Ast.PrimitiveTypeConstantKind.Duration:
        case Ast.PrimitiveTypeConstantKind.Function:
        case Ast.PrimitiveTypeConstantKind.List:
        case Ast.PrimitiveTypeConstantKind.Logical:
        case Ast.PrimitiveTypeConstantKind.None:
        case Ast.PrimitiveTypeConstantKind.Number:
        case Ast.PrimitiveTypeConstantKind.Record:
        case Ast.PrimitiveTypeConstantKind.Table:
        case Ast.PrimitiveTypeConstantKind.Text:
        case Ast.PrimitiveTypeConstantKind.Time:
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

export function isTBinOpExpressionKind(nodeKind: Ast.NodeKind): nodeKind is Ast.TBinOpExpressionNodeKind {
    switch (nodeKind) {
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

export function isPairedWrapperConstantKinds(x: Ast.TConstantKind, y: Ast.TConstantKind): boolean {
    if (x.length !== 1 || y.length !== 1) {
        return false;
    }

    // If given x === ')' and y === '(', then swap positions.
    const low: Ast.TConstantKind = x < y ? x : y;
    const high: Ast.TConstantKind = low === x ? y : x;

    return (
        (low === Ast.WrapperConstantKind.LeftBrace && high === Ast.WrapperConstantKind.RightBrace) ||
        (low === Ast.WrapperConstantKind.LeftBracket && high === Ast.WrapperConstantKind.RightBracket) ||
        (low === Ast.WrapperConstantKind.LeftParenthesis && high === Ast.WrapperConstantKind.RightParenthesis)
    );
}

export function testAnyNodeKind(
    value: Ast.NodeKind,
    allowedNodeKinds: ReadonlyArray<Ast.NodeKind>,
    details: {} | undefined = undefined,
): CommonError.InvariantError | undefined {
    return allowedNodeKinds.indexOf(value) === -1
        ? new CommonError.InvariantError(`NodeKind value is not an allowed NodeKind value`, details)
        : undefined;
}
