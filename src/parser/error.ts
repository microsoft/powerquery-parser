// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError } from "../common";
import { Option } from "../common/option";
import { Token, TokenKind } from "../lexer/token";
import { Localization } from "../localization/error";
import { Ast } from "./ast";
import { ParserContext } from "./context";

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
            readonly context: ParserContext.State,
        ) {
            super(innerError.message);
        }
    }

    export class ExpectedAnyTokenKindError extends Error {
        constructor(
            readonly expectedAnyTokenKind: ReadonlyArray<TokenKind>,
            readonly maybeFoundToken: Option<Token>,
        ) {
            super(Localization.Error.parserExpectedAnyTokenKind(expectedAnyTokenKind, maybeFoundToken));
        }
    }

    export class ExpectedTokenKindError extends Error {
        constructor(
            readonly expectedTokenKind: TokenKind,
            readonly maybeFoundToken: Option<Token>,
        ) {
            super(Localization.Error.parserExpectedTokenKind(expectedTokenKind, maybeFoundToken));
        }
    }

    export class InvalidPrimitiveTypeError extends Error {
        constructor(
            readonly token: Token,
        ) {
            super(Localization.Error.parserInvalidPrimitiveType(token));
        }
    }

    export class RequiredParameterAfterOptionalParameterError extends Error {
        constructor(
            readonly missingOptionalToken: Token,
        ) {
            super(Localization.Error.parserRequiredParameterAfterOptionalParameter(missingOptionalToken));
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
            readonly openBracketToken: Token,
        ) {
            super(Localization.Error.parserUnterminatedBracket(openBracketToken));
        }
    }

    export class UnterminatedParenthesesError extends Error {
        constructor(
            readonly openParenthesesToken: Token,
        ) {
            super(Localization.Error.parserUnterminatedParentheses(openParenthesesToken));
        }
    }

    export class UnusedTokensRemainError extends Error {
        constructor(
            readonly firstUnusedToken: Token,
        ) {
            super(Localization.Error.parserUnusedTokensRemain(firstUnusedToken));
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

