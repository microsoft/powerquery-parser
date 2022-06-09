// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, StringUtils } from "../common";
import { Localization, LocalizationUtils } from "../localization";
import { ParseState } from "./parseState";
import { Token } from "../language";

export type TParseError = CommonError.CommonError | ParseError;

export type TInnerParseError =
    | ExpectedAnyTokenKindError
    | ExpectedCsvContinuationError
    | ExpectedGeneralizedIdentifierError
    | ExpectedTokenKindError
    | InvalidCatchFunction
    | InvalidPrimitiveTypeError
    | RequiredParameterAfterOptionalParameterError
    | UnterminatedSequence
    | UnusedTokensRemainError;

export const enum CsvContinuationKind {
    DanglingComma = "DanglingComma",
    LetExpression = "LetExpression",
}

export const enum SequenceKind {
    Bracket = "Bracket",
    Parenthesis = "Parenthesis",
}

export class ParseError extends Error {
    constructor(readonly innerError: TInnerParseError, readonly state: ParseState) {
        super(innerError.message);
        Object.setPrototypeOf(this, ParseError.prototype);
    }
}

export class ExpectedCsvContinuationError extends Error {
    constructor(
        readonly kind: CsvContinuationKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
        locale: string,
    ) {
        super(Localization.error_parse_csvContinuation(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, ExpectedCsvContinuationError.prototype);
    }
}

export class ExpectedAnyTokenKindError extends Error {
    constructor(
        readonly expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
        locale: string,
    ) {
        super(
            Localization.error_parse_expectAnyTokenKind(
                LocalizationUtils.getLocalizationTemplates(locale),
                expectedAnyTokenKinds,
                maybeFoundToken,
            ),
        );

        Object.setPrototypeOf(this, ExpectedAnyTokenKindError.prototype);
    }
}

export class ExpectedTokenKindError extends Error {
    constructor(
        readonly expectedTokenKind: Token.TokenKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
        locale: string,
    ) {
        super(
            Localization.error_parse_expectTokenKind(
                LocalizationUtils.getLocalizationTemplates(locale),
                expectedTokenKind,
                maybeFoundToken,
            ),
        );

        Object.setPrototypeOf(this, ExpectedTokenKindError.prototype);
    }
}

export class ExpectedGeneralizedIdentifierError extends Error {
    constructor(readonly maybeFoundToken: TokenWithColumnNumber | undefined, locale: string) {
        super(
            Localization.error_parse_expectGeneralizedIdentifier(
                LocalizationUtils.getLocalizationTemplates(locale),
                maybeFoundToken,
            ),
        );

        Object.setPrototypeOf(this, ExpectedGeneralizedIdentifierError.prototype);
    }
}

export class InvalidCatchFunction extends Error {
    constructor(
        readonly startToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
        locale: string,
    ) {
        super(Localization.error_parse_invalidCatchFunction(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, InvalidCatchFunction.prototype);
    }
}

export class InvalidPrimitiveTypeError extends Error {
    constructor(readonly token: Token.Token, readonly positionStart: StringUtils.GraphemePosition, locale: string) {
        super(Localization.error_parse_invalidPrimitiveType(LocalizationUtils.getLocalizationTemplates(locale), token));
        Object.setPrototypeOf(this, InvalidPrimitiveTypeError.prototype);
    }
}

export class RequiredParameterAfterOptionalParameterError extends Error {
    constructor(
        readonly missingOptionalToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
        locale: string,
    ) {
        super(
            Localization.error_parse_requiredParameterAfterOptional(LocalizationUtils.getLocalizationTemplates(locale)),
        );

        Object.setPrototypeOf(this, RequiredParameterAfterOptionalParameterError.prototype);
    }
}

export class UnterminatedSequence extends Error {
    constructor(
        readonly kind: SequenceKind,
        readonly startToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
        locale: string,
    ) {
        super(Localization.error_parse_unterminated_sequence(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, UnterminatedSequence.prototype);
    }
}

export class UnusedTokensRemainError extends Error {
    constructor(
        readonly firstUnusedToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
        locale: string,
    ) {
        super(Localization.error_parse_unusedTokens(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, UnusedTokensRemainError.prototype);
    }
}

export interface TokenWithColumnNumber {
    readonly token: Token.Token;
    readonly columnNumber: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertIsParseError(error: any): error is ParseError {
    Assert.isTrue(isParseError(error), "isParseError(error)");

    return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isParseError(error: any): error is ParseError {
    return error instanceof ParseError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTParseError(error: any): error is TParseError {
    return isParseError(error) || CommonError.isCommonError(error);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTInnerParseError(x: any): x is TInnerParseError {
    return (
        x instanceof ExpectedAnyTokenKindError ||
        x instanceof ExpectedCsvContinuationError ||
        x instanceof ExpectedGeneralizedIdentifierError ||
        x instanceof ExpectedTokenKindError ||
        x instanceof InvalidCatchFunction ||
        x instanceof InvalidPrimitiveTypeError ||
        x instanceof RequiredParameterAfterOptionalParameterError ||
        x instanceof UnterminatedSequence ||
        x instanceof UnusedTokensRemainError
    );
}

export function maybeTokenFrom(error: TInnerParseError): Token.Token | undefined {
    if (
        (error instanceof ExpectedAnyTokenKindError ||
            error instanceof ExpectedCsvContinuationError ||
            error instanceof ExpectedGeneralizedIdentifierError ||
            error instanceof ExpectedTokenKindError) &&
        error.maybeFoundToken
    ) {
        return error.maybeFoundToken.token;
    } else if (error instanceof InvalidPrimitiveTypeError) {
        return error.token;
    } else if (error instanceof RequiredParameterAfterOptionalParameterError) {
        return error.missingOptionalToken;
    } else if (error instanceof UnterminatedSequence) {
        return error.startToken;
    } else if (error instanceof UnusedTokensRemainError) {
        return error.firstUnusedToken;
    } else {
        return undefined;
    }
}
