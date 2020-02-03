// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ParserContext } from ".";
import { CommonError, Option, StringUtils } from "../common";
import { Token, TokenKind } from "../lexer/token";
import { Localization } from "../localization/templates";

export type TParseError = CommonError.CommonError | ParseError;

export type TInnerParseError =
    | ExpectedAnyTokenKindError
    | ExpectedCsvContinuationError
    | ExpectedGeneralizedIdentifierError
    | ExpectedTokenKindError
    | InvalidPrimitiveTypeError
    | RequiredParameterAfterOptionalParameterError
    | UnterminatedBracketError
    | UnterminatedParenthesesError
    | UnusedTokensRemainError;

export const enum CsvContinuationKind {
    DanglingComma = "DanglingComma",
    LetExpression = "LetExpression",
}

export class ParseError extends Error {
    constructor(readonly innerError: TInnerParseError, readonly context: ParserContext.State) {
        super(innerError.message);
    }
}

export class ExpectedCsvContinuationError extends Error {
    constructor(readonly kind: CsvContinuationKind, readonly maybeFoundToken: Option<TokenWithColumnNumber>) {
        super(Localization.error_parse_csvContinuation(kind));
    }
}

export class ExpectedAnyTokenKindError extends Error {
    constructor(
        readonly expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        readonly maybeFoundToken: Option<TokenWithColumnNumber>,
    ) {
        super(Localization.error_parse_expectAnyTokenKind(expectedAnyTokenKind, maybeFoundToken));
    }
}

export class ExpectedTokenKindError extends Error {
    constructor(readonly expectedTokenKind: TokenKind, readonly maybeFoundToken: Option<TokenWithColumnNumber>) {
        super(Localization.error_parse_expectTokenKind(expectedTokenKind, maybeFoundToken));
    }
}

export class ExpectedGeneralizedIdentifierError extends Error {
    constructor(readonly maybeFoundToken: Option<TokenWithColumnNumber>) {
        super(Localization.error_parse_expectGeneralizedIdentifier(maybeFoundToken));
    }
}

export class InvalidPrimitiveTypeError extends Error {
    constructor(readonly token: Token, readonly positionStart: StringUtils.GraphemePosition) {
        super(Localization.parserInvalidPrimitiveType(token, positionStart));
    }
}

export class RequiredParameterAfterOptionalParameterError extends Error {
    constructor(readonly missingOptionalToken: Token, readonly positionStart: StringUtils.GraphemePosition) {
        super(Localization.parserRequiredParameterAfterOptionalParameter(positionStart));
    }
}

export class UnterminatedBracketError extends Error {
    constructor(readonly openBracketToken: Token, readonly positionStart: StringUtils.GraphemePosition) {
        super(Localization.parserUnterminatedBracket(positionStart));
    }
}

export class UnterminatedParenthesesError extends Error {
    constructor(readonly openParenthesesToken: Token, readonly positionStart: StringUtils.GraphemePosition) {
        super(Localization.parserUnterminatedParentheses(positionStart));
    }
}

export class UnusedTokensRemainError extends Error {
    constructor(readonly firstUnusedToken: Token, readonly positionStart: StringUtils.GraphemePosition) {
        super(Localization.parserUnusedTokensRemain(positionStart));
    }
}

export interface TokenWithColumnNumber {
    readonly token: Token;
    readonly columnNumber: number;
}

export function isTParseError(x: any): x is TParseError {
    return x instanceof ParseError || x instanceof CommonError.CommonError;
}

export function isTInnerParseError(x: any): x is TInnerParseError {
    return (
        x instanceof ExpectedAnyTokenKindError ||
        x instanceof ExpectedCsvContinuationError ||
        x instanceof ExpectedGeneralizedIdentifierError ||
        x instanceof ExpectedTokenKindError ||
        x instanceof InvalidPrimitiveTypeError ||
        x instanceof RequiredParameterAfterOptionalParameterError ||
        x instanceof UnterminatedBracketError ||
        x instanceof UnterminatedParenthesesError ||
        x instanceof UnusedTokensRemainError
    );
}

export function maybeTokenFrom(err: TInnerParseError): Option<Token> {
    if (
        (err instanceof ExpectedAnyTokenKindError ||
            err instanceof ExpectedCsvContinuationError ||
            err instanceof ExpectedGeneralizedIdentifierError ||
            err instanceof ExpectedTokenKindError) &&
        err.maybeFoundToken
    ) {
        return err.maybeFoundToken.token;
    } else if (err instanceof InvalidPrimitiveTypeError) {
        return err.token;
    } else if (err instanceof RequiredParameterAfterOptionalParameterError) {
        return err.missingOptionalToken;
    } else if (err instanceof UnterminatedBracketError) {
        return err.openBracketToken;
    } else if (err instanceof UnterminatedParenthesesError) {
        return err.openParenthesesToken;
    } else if (err instanceof UnusedTokensRemainError) {
        return err.firstUnusedToken;
    } else {
        return undefined;
    }
}
