import { Assert } from "../../common";
import { Constant } from ".";
import { TokenKind } from "../token";

export function unaryOperatorKindFrom(tokenKind: TokenKind | undefined): Constant.UnaryOperator | undefined {
    switch (tokenKind) {
        case TokenKind.Plus:
            return Constant.UnaryOperator.Positive;
        case TokenKind.Minus:
            return Constant.UnaryOperator.Negative;
        case TokenKind.KeywordNot:
            return Constant.UnaryOperator.Not;
        default:
            return undefined;
    }
}

export function arithmeticOperatorKindFrom(tokenKind: TokenKind | undefined): Constant.ArithmeticOperator | undefined {
    switch (tokenKind) {
        case TokenKind.Asterisk:
            return Constant.ArithmeticOperator.Multiplication;
        case TokenKind.Division:
            return Constant.ArithmeticOperator.Division;
        case TokenKind.Plus:
            return Constant.ArithmeticOperator.Addition;
        case TokenKind.Minus:
            return Constant.ArithmeticOperator.Subtraction;
        case TokenKind.Ampersand:
            return Constant.ArithmeticOperator.And;
        default:
            return undefined;
    }
}

export function equalityOperatorKindFrom(tokenKind: TokenKind | undefined): Constant.EqualityOperator | undefined {
    switch (tokenKind) {
        case TokenKind.Equal:
            return Constant.EqualityOperator.EqualTo;
        case TokenKind.NotEqual:
            return Constant.EqualityOperator.NotEqualTo;
        default:
            return undefined;
    }
}

export function logicalOperatorKindFrom(tokenKind: TokenKind | undefined): Constant.LogicalOperator | undefined {
    switch (tokenKind) {
        case TokenKind.KeywordAnd:
            return Constant.LogicalOperator.And;
        case TokenKind.KeywordOr:
            return Constant.LogicalOperator.Or;
        default:
            return undefined;
    }
}

export function relationalOperatorKindFrom(tokenKind: TokenKind | undefined): Constant.RelationalOperator | undefined {
    switch (tokenKind) {
        case TokenKind.LessThan:
            return Constant.RelationalOperator.LessThan;
        case TokenKind.LessThanEqualTo:
            return Constant.RelationalOperator.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Constant.RelationalOperator.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Constant.RelationalOperator.GreaterThanEqualTo;
        default:
            return undefined;
    }
}

export function binOpExpressionOperatorKindFrom(
    tokenKind: TokenKind | undefined,
): Constant.TBinOpExpressionOperator | undefined {
    switch (tokenKind) {
        // ArithmeticOperator
        case TokenKind.Asterisk:
            return Constant.ArithmeticOperator.Multiplication;
        case TokenKind.Division:
            return Constant.ArithmeticOperator.Division;
        case TokenKind.Plus:
            return Constant.ArithmeticOperator.Addition;
        case TokenKind.Minus:
            return Constant.ArithmeticOperator.Subtraction;
        case TokenKind.Ampersand:
            return Constant.ArithmeticOperator.And;

        // EqualityOperator
        case TokenKind.Equal:
            return Constant.EqualityOperator.EqualTo;
        case TokenKind.NotEqual:
            return Constant.EqualityOperator.NotEqualTo;

        // LogicalOperator
        case TokenKind.KeywordAnd:
            return Constant.LogicalOperator.And;
        case TokenKind.KeywordOr:
            return Constant.LogicalOperator.Or;

        // RelationalOperator
        case TokenKind.LessThan:
            return Constant.RelationalOperator.LessThan;
        case TokenKind.LessThanEqualTo:
            return Constant.RelationalOperator.LessThanEqualTo;
        case TokenKind.GreaterThan:
            return Constant.RelationalOperator.GreaterThan;
        case TokenKind.GreaterThanEqualTo:
            return Constant.RelationalOperator.GreaterThanEqualTo;

        // Keyword operator
        case TokenKind.KeywordAs:
            return Constant.KeywordConstant.As;
        case TokenKind.KeywordIs:
            return Constant.KeywordConstant.Is;
        case TokenKind.KeywordMeta:
            return Constant.KeywordConstant.Meta;

        case TokenKind.NullCoalescingOperator:
            return Constant.MiscConstant.NullCoalescingOperator;

        default:
            return undefined;
    }
}

export function binOpExpressionOperatorPrecedence(operator: Constant.TBinOpExpressionOperator): number {
    switch (operator) {
        case Constant.KeywordConstant.Meta:
            return 110;

        case Constant.ArithmeticOperator.Multiplication:
        case Constant.ArithmeticOperator.Division:
            return 100;

        case Constant.ArithmeticOperator.Addition:
        case Constant.ArithmeticOperator.Subtraction:
        case Constant.ArithmeticOperator.And:
            return 90;

        case Constant.RelationalOperator.GreaterThan:
        case Constant.RelationalOperator.GreaterThanEqualTo:
        case Constant.RelationalOperator.LessThan:
        case Constant.RelationalOperator.LessThanEqualTo:
            return 80;

        case Constant.EqualityOperator.EqualTo:
        case Constant.EqualityOperator.NotEqualTo:
            return 70;

        case Constant.KeywordConstant.As:
            return 60;

        case Constant.KeywordConstant.Is:
            return 50;

        case Constant.LogicalOperator.And:
            return 40;

        case Constant.LogicalOperator.Or:
            return 30;

        case Constant.MiscConstant.NullCoalescingOperator:
            return 20;

        default:
            throw Assert.isNever(operator);
    }
}

export function isBinOpExpressionOperator(text: string): text is Constant.TBinOpExpressionOperator {
    return (
        isArithmeticOperator(text) ||
        isEqualityOperator(text) ||
        isLogicalOperator(text) ||
        isRelationalOperator(text) ||
        text === Constant.MiscConstant.NullCoalescingOperator ||
        text === Constant.KeywordConstant.As ||
        text === Constant.KeywordConstant.Is ||
        text === Constant.KeywordConstant.Meta
    );
}

export function isTConstant(text: string): text is Constant.TConstant {
    return (
        isArithmeticOperator(text) ||
        isEqualityOperator(text) ||
        isKeywordConstant(text) ||
        isLanguageConstant(text) ||
        isLogicalOperator(text) ||
        isMiscConstant(text) ||
        isPrimitiveTypeConstant(text) ||
        isRelationalOperator(text) ||
        isUnaryOperator(text) ||
        isWrapperConstant(text)
    );
}

export function isArithmeticOperator(text: string): text is Constant.ArithmeticOperator {
    return Constant.ArithmeticOperators.includes(text as Constant.ArithmeticOperator);
}

export function isEqualityOperator(text: string): text is Constant.EqualityOperator {
    return Constant.EqualityOperators.includes(text as Constant.EqualityOperator);
}

export function isKeywordConstant(text: string): text is Constant.KeywordConstant {
    return Constant.KeywordConstants.includes(text as Constant.KeywordConstant);
}

export function isLanguageConstant(text: string): text is Constant.LanguageConstant {
    return Constant.LanguageConstants.includes(text as Constant.LanguageConstant);
}

export function isLogicalOperator(text: string): text is Constant.LogicalOperator {
    return Constant.LogicalOperators.includes(text as Constant.LogicalOperator);
}

export function isMiscConstant(text: string): text is Constant.MiscConstant {
    return Constant.MiscConstants.includes(text as Constant.MiscConstant);
}

export function isPrimitiveTypeConstant(text: string): text is Constant.PrimitiveTypeConstant {
    return Constant.PrimitiveTypeConstants.includes(text as Constant.PrimitiveTypeConstant);
}

export function isRelationalOperator(text: string): text is Constant.RelationalOperator {
    return Constant.RelationalOperators.includes(text as Constant.RelationalOperator);
}

export function isUnaryOperator(text: string): text is Constant.UnaryOperator {
    return Constant.UnaryOperators.includes(text as Constant.UnaryOperator);
}

export function isWrapperConstant(text: string): text is Constant.WrapperConstant {
    return Constant.WrapperConstants.includes(text as Constant.WrapperConstant);
}

export function isPairedWrapperConstantKinds(left: Constant.TConstant, right: Constant.TConstant): boolean {
    return (
        (left === Constant.WrapperConstant.LeftBrace && right === Constant.WrapperConstant.RightBrace) ||
        (left === Constant.WrapperConstant.LeftBracket && right === Constant.WrapperConstant.RightBracket) ||
        (left === Constant.WrapperConstant.LeftParenthesis && right === Constant.WrapperConstant.RightParenthesis)
    );
}
