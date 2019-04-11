import { CommonError } from "../common";
import { Option } from "../common/option";
import { TokenPosition } from "../lexer/lexerSnapshot";
import { TokenKind } from "../lexer/token";
import { Localization } from "../localization/error";
import { Ast } from "./ast";

export namespace ParserError {

    export type TParserError = (
        | CommonError.CommonError
        | ParserError
    );

    export type TInnerParserError = (
        | ExpectedAnyTokenKindError
        | ExpectedTokenKindError
        | InvalidPrimitiveTypeError
        | RequiredParameterAfterOptionalParameterError
        | UnexpectedEndOfTokensError
        | UnterminatedBracketError
        | UnterminatedParenthesesError
        | UnusedTokensRemainError
    )

    export class ParserError extends Error {
        constructor(
            readonly innerError: TInnerParserError,
        ) {
            super(innerError.message);
        }
    }

    export class ExpectedAnyTokenKindError extends Error {
        constructor(
            readonly expectedAnyTokenKind: ReadonlyArray<TokenKind>,
            readonly maybeFoundTokenPosition: Option<TokenPosition>,
        ) {
            super(Localization.Error.parserExpectedAnyTokenKind(expectedAnyTokenKind, maybeFoundTokenPosition));
        }
    }

    export class ExpectedTokenKindError extends Error {
        constructor(
            readonly expectedTokenKind: TokenKind,
            readonly maybeFoundTokenPosition: Option<TokenPosition>,
        ) {
            super(Localization.Error.parserExpectedTokenKind(expectedTokenKind, maybeFoundTokenPosition));
        }
    }

    export class InvalidPrimitiveTypeError extends Error {
        constructor(
            readonly foundIdentifier: string,
            readonly tokenPosition: TokenPosition,
        ) {
            super(Localization.Error.parserInvalidPrimitiveType(foundIdentifier, tokenPosition));
        }
    }

    export class RequiredParameterAfterOptionalParameterError extends Error {
        constructor(
            readonly missingOptionalTokenPosition: TokenPosition,
        ) {
            super(Localization.Error.parserRequiredParameterAfterOptionalParameter(missingOptionalTokenPosition));
        }
    }

    export class UnexpectedEndOfTokensError extends Error {
        constructor(
            readonly topOfTokenRangeStack: Ast.NodeKind,
        ) {
            super(Localization.Error.parserUnexpectedEndOfTokens(topOfTokenRangeStack));
        }
    }

    export class UnterminatedBracketError extends Error {
        constructor(
            readonly openBracketTokenPosition: TokenPosition,
        ) {
            super(Localization.Error.parserUnterminatedBracket(openBracketTokenPosition));
        }
    }

    export class UnterminatedParenthesesError extends Error {
        constructor(
            readonly openParenthesesTokenPosition: TokenPosition,
        ) {
            super(Localization.Error.parserUnterminatedParentheses(openParenthesesTokenPosition));
        }
    }

    export class UnusedTokensRemainError extends Error {
        constructor(
            readonly firstUnusedTokenPosition: TokenPosition,
        ) {
            super(Localization.Error.parserUnusedTokensRemain(firstUnusedTokenPosition));
        }
    }

    export function isTParserError(x: any): x is TParserError {
        return (
            x instanceof ParserError
            || x instanceof CommonError.CommonError
        )
    }

    export function isTInnerParserError(x: any): x is TInnerParserError {
        return (
            x instanceof ExpectedAnyTokenKindError
            || x instanceof ExpectedTokenKindError
            || x instanceof InvalidPrimitiveTypeError
            || x instanceof RequiredParameterAfterOptionalParameterError
            || x instanceof UnexpectedEndOfTokensError
            || x instanceof UnterminatedBracketError
            || x instanceof UnterminatedParenthesesError
            || x instanceof UnusedTokensRemainError
        );
    }
}

