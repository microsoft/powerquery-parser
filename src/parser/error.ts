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
            readonly expectedAnyTokenKind: TokenKind[],
            readonly maybeFoundTokenPosition: Option<TokenPosition>,
            readonly message = Localization.Error.parserExpectedAnyTokenKind(expectedAnyTokenKind, maybeFoundTokenPosition),
        ) {
            super(message);
        }
    }

    export class ExpectedTokenKindError extends Error {
        constructor(
            readonly expectedTokenKind: TokenKind,
            readonly maybeFoundTokenPosition: Option<TokenPosition>,
            readonly message = Localization.Error.parserExpectedTokenKind(expectedTokenKind, maybeFoundTokenPosition),
        ) {
            super(message);
        }
    }

    export class InvalidPrimitiveTypeError extends Error {
        constructor(
            readonly foundIdentifier: string,
            readonly tokenPosition: TokenPosition,
            readonly message = Localization.Error.parserInvalidPrimitiveType(foundIdentifier, tokenPosition),
        ) {
            super(message);
        }
    }

    export class RequiredParameterAfterOptionalParameterError extends Error {
        constructor(
            readonly missingOptionalTokenPosition: TokenPosition,
            readonly message = Localization.Error.parserRequiredParameterAfterOptionalParameter(missingOptionalTokenPosition),
        ) {
            super(message);
        }
    }

    export class UnexpectedEndOfTokensError extends Error {
        constructor(
            readonly topOfTokenRangeStack: Ast.NodeKind,
            readonly message = Localization.Error.parserUnexpectedEndOfTokens(topOfTokenRangeStack),
        ) {
            super(message);
        }
    }

    export class UnterminatedBracketError extends Error {
        constructor(
            readonly openBracketTokenPosition: TokenPosition,
            readonly message = Localization.Error.parserUnterminatedBracket(openBracketTokenPosition),
        ) {
            super(message);
        }
    }

    export class UnterminatedParenthesesError extends Error {
        constructor(
            readonly openParenthesesTokenPosition: TokenPosition,
            readonly message = Localization.Error.parserUnterminatedParentheses(openParenthesesTokenPosition),
        ) {
            super(message);
        }
    }

    export class UnusedTokensRemainError extends Error {
        constructor(
            readonly firstUnusedTokenPosition: TokenPosition,
            readonly message = Localization.Error.parserUnusedTokensRemain(firstUnusedTokenPosition),
        ) {
            super(message);
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

