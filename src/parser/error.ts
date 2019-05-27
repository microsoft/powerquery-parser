// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, StringHelpers } from "../common";
import { Option } from "../common/option";
import { Token, TokenKind } from "../lexer/token";
import * as Localization from "../localization/error";
import * as Ast from "./ast";
import * as Context from "./context";

export type TParserError = CommonError.CommonError | ParserError;

export type TInnerParserError =
    | ExpectedAnyTokenKindError
    | ExpectedTokenKindError
    | InvalidPrimitiveTypeError
    | RequiredParameterAfterOptionalParameterError
    | UnexpectedEndOfTokensError
    | UnterminatedBracketError
    | UnterminatedParenthesesError
    | UnusedTokensRemainError;

export class ParserError extends Error {
    constructor(readonly innerError: TInnerParserError, readonly context: Context.State) {
        super(innerError.message);
    }
}

export class ExpectedAnyTokenKindError extends Error {
    constructor(
        readonly expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        readonly maybeFoundToken: Option<Token>,
        readonly maybePositionStart: Option<StringHelpers.GraphemePosition>,
    ) {
        super(Localization.parserExpectedAnyTokenKind(expectedAnyTokenKind, maybeFoundToken, maybePositionStart));
    }
}

export class ExpectedTokenKindError extends Error {
    constructor(
        readonly expectedTokenKind: TokenKind,
        readonly maybeFoundToken: Option<Token>,
        readonly maybePositionStart: Option<StringHelpers.GraphemePosition>,
    ) {
        super(Localization.parserExpectedTokenKind(expectedTokenKind, maybeFoundToken, maybePositionStart));
    }
}

export class InvalidPrimitiveTypeError extends Error {
    constructor(readonly token: Token, readonly positionStart: StringHelpers.GraphemePosition) {
        super(Localization.parserInvalidPrimitiveType(token, positionStart));
    }
}

export class RequiredParameterAfterOptionalParameterError extends Error {
    constructor(readonly missingOptionalToken: Token, readonly positionStart: StringHelpers.GraphemePosition) {
        super(Localization.parserRequiredParameterAfterOptionalParameter(positionStart));
    }
}

export class UnexpectedEndOfTokensError extends Error {
    constructor(readonly topOfTokenRangeStack: Ast.NodeKind) {
        super(Localization.parserUnexpectedEndOfTokens(topOfTokenRangeStack));
    }
}

export class UnterminatedBracketError extends Error {
    constructor(readonly openBracketToken: Token, readonly positionStart: StringHelpers.GraphemePosition) {
        super(Localization.parserUnterminatedBracket(positionStart));
    }
}

export class UnterminatedParenthesesError extends Error {
    constructor(readonly openParenthesesToken: Token, readonly positionStart: StringHelpers.GraphemePosition) {
        super(Localization.parserUnterminatedParentheses(positionStart));
    }
}

export class UnusedTokensRemainError extends Error {
    constructor(readonly firstUnusedToken: Token, readonly positionStart: StringHelpers.GraphemePosition) {
        super(Localization.parserUnusedTokensRemain(positionStart));
    }
}

export function isTParserError(x: any): x is TParserError {
    return x instanceof ParserError || x instanceof CommonError.CommonError;
}

export function isTInnerParserError(x: any): x is TInnerParserError {
    return (
        x instanceof ExpectedAnyTokenKindError ||
        x instanceof ExpectedTokenKindError ||
        x instanceof InvalidPrimitiveTypeError ||
        x instanceof RequiredParameterAfterOptionalParameterError ||
        x instanceof UnexpectedEndOfTokensError ||
        x instanceof UnterminatedBracketError ||
        x instanceof UnterminatedParenthesesError ||
        x instanceof UnusedTokensRemainError
    );
}
