// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, StringUtils } from "../common";
import { Token, TokenKind } from "../lexer/token";
import { ILocalizationTemplates, Localization } from "../localization";
import { IParserState } from "./IParserState";

export type TParseError<T> = CommonError.CommonError | ParseError<T>;

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

export const enum UnterminatedKind {
    Bracket = "Bracket",
    Parenthesis = "Parenthesis",
}

export class ParseError<T> extends Error {
    constructor(readonly innerError: TInnerParseError, readonly state: T & IParserState) {
        super(innerError.message);
    }
}

export class ExpectedCsvContinuationError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly kind: CsvContinuationKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_csvContinuation(templates, kind));
    }
}

export class ExpectedAnyTokenKindError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly expectedAnyTokenKinds: ReadonlyArray<TokenKind>,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_expectAnyTokenKind(templates, expectedAnyTokenKinds, maybeFoundToken));
    }
}

export class ExpectedTokenKindError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly expectedTokenKind: TokenKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_expectTokenKind(templates, expectedTokenKind, maybeFoundToken));
    }
}

export class ExpectedGeneralizedIdentifierError extends Error {
    constructor(templates: ILocalizationTemplates, readonly maybeFoundToken: TokenWithColumnNumber | undefined) {
        super(Localization.error_parse_expectGeneralizedIdentifier(templates, maybeFoundToken));
    }
}

export class InvalidPrimitiveTypeError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly token: Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_invalidPrimitiveType(templates, token));
    }
}

export class RequiredParameterAfterOptionalParameterError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly missingOptionalToken: Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_requiredParameterAfterOptional(templates));
    }
}

export class UnterminatedBracketError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly openBracketToken: Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unterminated_bracket(templates));
    }
}

export class UnterminatedParenthesesError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly openParenthesesToken: Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unterminated_parenthesis(templates));
    }
}

export class UnusedTokensRemainError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly firstUnusedToken: Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unusedTokens(templates));
    }
}

export interface TokenWithColumnNumber {
    readonly token: Token;
    readonly columnNumber: number;
}

export function isTParseError<T>(x: any): x is TParseError<T> {
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

export function maybeTokenFrom(err: TInnerParseError): Token | undefined {
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
