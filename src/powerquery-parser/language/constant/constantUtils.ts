import { Constant } from ".";
import { Assert } from "../../common";
import { TokenKind } from "../token";

export function maybeUnaryOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Constant.UnaryOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Plus:
            return Constant.UnaryOperatorKind.Positive;
        case TokenKind.Minus:
            return Constant.UnaryOperatorKind.Negative;
        case TokenKind.KeywordNot:
            return Constant.UnaryOperatorKind.Not;
        default:
            return undefined;
    }
}

export function maybeArithmeticOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Constant.ArithmeticOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Asterisk:
            return Constant.ArithmeticOperatorKind.Multiplication;
        case TokenKind.Division:
            return Constant.ArithmeticOperatorKind.Division;
        case TokenKind.Plus:
            return Constant.ArithmeticOperatorKind.Addition;
        case TokenKind.Minus:
            return Constant.ArithmeticOperatorKind.Subtraction;
        case TokenKind.Ampersand:
            return Constant.ArithmeticOperatorKind.And;
        default:
            return undefined;
    }
}

export function maybeEqualityOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Constant.EqualityOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Equal:
            return Constant.EqualityOperatorKind.EqualTo;
        case TokenKind.NotEqual:
            return Constant.EqualityOperatorKind.NotEqualTo;
        default:
            return undefined;
    }
}

export function maybeLogicalOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Constant.LogicalOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.KeywordAnd:
            return Constant.LogicalOperatorKind.And;
        case TokenKind.KeywordOr:
            return Constant.LogicalOperatorKind.Or;
        default:
            return undefined;
    }
}

export function maybeRelationalOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Constant.RelationalOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.LessThan:
            return Constant.RelationalOperatorKind.LessThan;
        case TokenKind.LessThanEqualTo:
            return Constant.RelationalOperatorKind.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Constant.RelationalOperatorKind.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Constant.RelationalOperatorKind.GreaterThanEqualTo;
        default:
            return undefined;
    }
}

export function maybeBinOpExpressionOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): Constant.TBinOpExpressionOperator | undefined {
    switch (maybeTokenKind) {
        // ArithmeticOperator
        case TokenKind.Asterisk:
            return Constant.ArithmeticOperatorKind.Multiplication;
        case TokenKind.Division:
            return Constant.ArithmeticOperatorKind.Division;
        case TokenKind.Plus:
            return Constant.ArithmeticOperatorKind.Addition;
        case TokenKind.Minus:
            return Constant.ArithmeticOperatorKind.Subtraction;
        case TokenKind.Ampersand:
            return Constant.ArithmeticOperatorKind.And;

        // EqualityOperator
        case TokenKind.Equal:
            return Constant.EqualityOperatorKind.EqualTo;
        case TokenKind.NotEqual:
            return Constant.EqualityOperatorKind.NotEqualTo;

        // LogicalOperator
        case TokenKind.KeywordAnd:
            return Constant.LogicalOperatorKind.And;
        case TokenKind.KeywordOr:
            return Constant.LogicalOperatorKind.Or;

        // RelationalOperator
        case TokenKind.LessThan:
            return Constant.RelationalOperatorKind.LessThan;
        case TokenKind.LessThanEqualTo:
            return Constant.RelationalOperatorKind.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Constant.RelationalOperatorKind.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Constant.RelationalOperatorKind.GreaterThanEqualTo;

        // Keyword operator
        case TokenKind.KeywordAs:
            return Constant.KeywordConstantKind.As;
        case TokenKind.KeywordIs:
            return Constant.KeywordConstantKind.Is;
        case TokenKind.KeywordMeta:
            return Constant.KeywordConstantKind.Meta;

        case TokenKind.NullCoalescingOperator:
            return Constant.MiscConstantKind.NullCoalescingOperator;

        default:
            return undefined;
    }
}

export function binOpExpressionOperatorPrecedence(operator: Constant.TBinOpExpressionOperator): number {
    switch (operator) {
        case Constant.KeywordConstantKind.Meta:
            return 110;

        case Constant.ArithmeticOperatorKind.Multiplication:
        case Constant.ArithmeticOperatorKind.Division:
            return 100;

        case Constant.ArithmeticOperatorKind.Addition:
        case Constant.ArithmeticOperatorKind.Subtraction:
        case Constant.ArithmeticOperatorKind.And:
            return 90;

        case Constant.RelationalOperatorKind.GreaterThan:
        case Constant.RelationalOperatorKind.GreaterThanEqualTo:
        case Constant.RelationalOperatorKind.LessThan:
        case Constant.RelationalOperatorKind.LessThanEqualTo:
            return 80;

        case Constant.EqualityOperatorKind.EqualTo:
        case Constant.EqualityOperatorKind.NotEqualTo:
            return 70;

        case Constant.KeywordConstantKind.As:
            return 60;

        case Constant.KeywordConstantKind.Is:
            return 50;

        case Constant.LogicalOperatorKind.And:
            return 40;

        case Constant.LogicalOperatorKind.Or:
            return 30;

        case Constant.MiscConstantKind.NullCoalescingOperator:
            return 20;

        default:
            throw Assert.isNever(operator);
    }
}

export function isPrimitiveTypeConstantKind(
    maybePrimitiveTypeConstantKind: string,
): maybePrimitiveTypeConstantKind is Constant.PrimitiveTypeConstantKind {
    switch (maybePrimitiveTypeConstantKind) {
        case Constant.PrimitiveTypeConstantKind.Action:
        case Constant.PrimitiveTypeConstantKind.Any:
        case Constant.PrimitiveTypeConstantKind.AnyNonNull:
        case Constant.PrimitiveTypeConstantKind.Binary:
        case Constant.PrimitiveTypeConstantKind.Date:
        case Constant.PrimitiveTypeConstantKind.DateTime:
        case Constant.PrimitiveTypeConstantKind.DateTimeZone:
        case Constant.PrimitiveTypeConstantKind.Duration:
        case Constant.PrimitiveTypeConstantKind.Function:
        case Constant.PrimitiveTypeConstantKind.List:
        case Constant.PrimitiveTypeConstantKind.Logical:
        case Constant.PrimitiveTypeConstantKind.None:
        case Constant.PrimitiveTypeConstantKind.Null:
        case Constant.PrimitiveTypeConstantKind.Number:
        case Constant.PrimitiveTypeConstantKind.Record:
        case Constant.PrimitiveTypeConstantKind.Table:
        case Constant.PrimitiveTypeConstantKind.Text:
        case Constant.PrimitiveTypeConstantKind.Time:
        case Constant.PrimitiveTypeConstantKind.Type:
            return true;
        default:
            return false;
    }
}

export function isPairedWrapperConstantKinds(left: Constant.TConstantKind, right: Constant.TConstantKind): boolean {
    return (
        (left === Constant.WrapperConstantKind.LeftBrace && right === Constant.WrapperConstantKind.RightBrace) ||
        (left === Constant.WrapperConstantKind.LeftBracket && right === Constant.WrapperConstantKind.RightBracket) ||
        (left === Constant.WrapperConstantKind.LeftParenthesis &&
            right === Constant.WrapperConstantKind.RightParenthesis)
    );
}
