import { Assert } from "../../common";
import { TokenKind } from "../token";
import {
    ArithmeticOperatorKind,
    EqualityOperatorKind,
    IdentifierConstantKind,
    KeywordConstantKind,
    LiteralKind,
    LogicalOperatorKind,
    MiscConstantKind,
    PrimitiveTypeConstantKind,
    RelationalOperatorKind,
    TBinOpExpressionOperator,
    TConstantKind,
    UnaryOperatorKind,
    WrapperConstantKind,
} from "./constant";

export function maybeUnaryOperatorKindFrom(maybeTokenKind: TokenKind | undefined): UnaryOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Plus:
            return UnaryOperatorKind.Positive;
        case TokenKind.Minus:
            return UnaryOperatorKind.Negative;
        case TokenKind.KeywordNot:
            return UnaryOperatorKind.Not;
        default:
            return undefined;
    }
}

export function maybeArithmeticOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): ArithmeticOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Asterisk:
            return ArithmeticOperatorKind.Multiplication;
        case TokenKind.Division:
            return ArithmeticOperatorKind.Division;
        case TokenKind.Plus:
            return ArithmeticOperatorKind.Addition;
        case TokenKind.Minus:
            return ArithmeticOperatorKind.Subtraction;
        case TokenKind.Ampersand:
            return ArithmeticOperatorKind.And;
        default:
            return undefined;
    }
}

export function maybeEqualityOperatorKindFrom(maybeTokenKind: TokenKind | undefined): EqualityOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.Equal:
            return EqualityOperatorKind.EqualTo;
        case TokenKind.NotEqual:
            return EqualityOperatorKind.NotEqualTo;
        default:
            return undefined;
    }
}

export function maybeLogicalOperatorKindFrom(maybeTokenKind: TokenKind | undefined): LogicalOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.KeywordAnd:
            return LogicalOperatorKind.And;
        case TokenKind.KeywordOr:
            return LogicalOperatorKind.Or;
        default:
            return undefined;
    }
}

export function maybeRelationalOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): RelationalOperatorKind | undefined {
    switch (maybeTokenKind) {
        case TokenKind.LessThan:
            return RelationalOperatorKind.LessThan;
        case TokenKind.LessThanEqualTo:
            return RelationalOperatorKind.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return RelationalOperatorKind.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return RelationalOperatorKind.GreaterThanEqualTo;
        default:
            return undefined;
    }
}

export function maybeBinOpExpressionOperatorKindFrom(
    maybeTokenKind: TokenKind | undefined,
): TBinOpExpressionOperator | undefined {
    switch (maybeTokenKind) {
        // ArithmeticOperator
        case TokenKind.Asterisk:
            return ArithmeticOperatorKind.Multiplication;
        case TokenKind.Division:
            return ArithmeticOperatorKind.Division;
        case TokenKind.Plus:
            return ArithmeticOperatorKind.Addition;
        case TokenKind.Minus:
            return ArithmeticOperatorKind.Subtraction;
        case TokenKind.Ampersand:
            return ArithmeticOperatorKind.And;

        // EqualityOperator
        case TokenKind.Equal:
            return EqualityOperatorKind.EqualTo;
        case TokenKind.NotEqual:
            return EqualityOperatorKind.NotEqualTo;

        // LogicalOperator
        case TokenKind.KeywordAnd:
            return LogicalOperatorKind.And;
        case TokenKind.KeywordOr:
            return LogicalOperatorKind.Or;

        // RelationalOperator
        case TokenKind.LessThan:
            return RelationalOperatorKind.LessThan;
        case TokenKind.LessThanEqualTo:
            return RelationalOperatorKind.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return RelationalOperatorKind.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return RelationalOperatorKind.GreaterThanEqualTo;

        // Keyword operator
        case TokenKind.KeywordAs:
            return KeywordConstantKind.As;
        case TokenKind.KeywordIs:
            return KeywordConstantKind.Is;
        case TokenKind.KeywordMeta:
            return KeywordConstantKind.Meta;

        case TokenKind.NullCoalescingOperator:
            return MiscConstantKind.NullCoalescingOperator;

        default:
            return undefined;
    }
}

export function binOpExpressionOperatorPrecedence(operator: TBinOpExpressionOperator): number {
    switch (operator) {
        case KeywordConstantKind.Meta:
            return 110;

        case ArithmeticOperatorKind.Multiplication:
        case ArithmeticOperatorKind.Division:
            return 100;

        case ArithmeticOperatorKind.Addition:
        case ArithmeticOperatorKind.Subtraction:
        case ArithmeticOperatorKind.And:
            return 90;

        case RelationalOperatorKind.GreaterThan:
        case RelationalOperatorKind.GreaterThanEqualTo:
        case RelationalOperatorKind.LessThan:
        case RelationalOperatorKind.LessThanEqualTo:
            return 80;

        case EqualityOperatorKind.EqualTo:
        case EqualityOperatorKind.NotEqualTo:
            return 70;

        case KeywordConstantKind.As:
            return 60;

        case KeywordConstantKind.Is:
            return 50;

        case LogicalOperatorKind.And:
            return 40;

        case LogicalOperatorKind.Or:
            return 30;

        case MiscConstantKind.NullCoalescingOperator:
            return 20;

        default:
            throw Assert.isNever(operator);
    }
}

export function maybeLiteralKindFrom(
    maybeTokenKind: TokenKind | undefined,
): LiteralKind.Numeric | LiteralKind.Logical | LiteralKind.Null | LiteralKind.Text | undefined {
    switch (maybeTokenKind) {
        case TokenKind.HexLiteral:
        case TokenKind.KeywordHashNan:
        case TokenKind.KeywordHashInfinity:
        case TokenKind.NumericLiteral:
            return LiteralKind.Numeric;

        case TokenKind.KeywordFalse:
        case TokenKind.KeywordTrue:
            return LiteralKind.Logical;

        case TokenKind.NullLiteral:
            return LiteralKind.Null;

        case TokenKind.TextLiteral:
            return LiteralKind.Text;

        default:
            return undefined;
    }
}

export function isPrimitiveTypeConstantKind(
    maybePrimitiveTypeConstantKind: string,
): maybePrimitiveTypeConstantKind is PrimitiveTypeConstantKind {
    switch (maybePrimitiveTypeConstantKind) {
        case IdentifierConstantKind.Nullable:
        case IdentifierConstantKind.Optional:
        case PrimitiveTypeConstantKind.Any:
        case PrimitiveTypeConstantKind.AnyNonNull:
        case PrimitiveTypeConstantKind.Binary:
        case PrimitiveTypeConstantKind.Date:
        case PrimitiveTypeConstantKind.DateTime:
        case PrimitiveTypeConstantKind.DateTimeZone:
        case PrimitiveTypeConstantKind.Duration:
        case PrimitiveTypeConstantKind.Function:
        case PrimitiveTypeConstantKind.List:
        case PrimitiveTypeConstantKind.Logical:
        case PrimitiveTypeConstantKind.None:
        case PrimitiveTypeConstantKind.Number:
        case PrimitiveTypeConstantKind.Record:
        case PrimitiveTypeConstantKind.Table:
        case PrimitiveTypeConstantKind.Text:
        case PrimitiveTypeConstantKind.Time:
            return true;
        default:
            return false;
    }
}

export function isPairedWrapperConstantKinds(left: TConstantKind, right: TConstantKind): boolean {
    Assert.isTrue(left < right, `the first argument should be 'less than' the second, eg. '[' < ']`);

    return (
        (left === WrapperConstantKind.LeftBrace && right === WrapperConstantKind.RightBrace) ||
        (left === WrapperConstantKind.LeftBracket && right === WrapperConstantKind.RightBracket) ||
        (left === WrapperConstantKind.LeftParenthesis && right === WrapperConstantKind.RightParenthesis)
    );
}
