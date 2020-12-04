// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, StringUtils } from "../powerquery-parser/common";
import { Token } from "../language";
import { Localization, LocalizationUtils } from "../localization";
import { IParseState } from "./IParseState";

export type TParseError<S extends IParseState = IParseState> = CommonError.CommonError | ParseError<S>;

export type TInnerParseError =
    | ExpectedAnyTokenKindError
    | ExpectedCsvContinuationError
    | ExpectedGeneralizedIdentifierError
    | ExpectedTokenKindError
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

export class ParseError<S extends IParseState = IParseState> extends Error {
    constructor(readonly innerError: TInnerParseError, readonly state: S) {
        super(innerError.message);
        Object.setPrototypeOf(this, ParseError.prototype);
    }
}

export class ExpectedCsvContinuationError extends Error {
    constructor(
        locale: string,
        readonly kind: CsvContinuationKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_csvContinuation(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, ExpectedCsvContinuationError.prototype);
    }
}

export class ExpectedAnyTokenKindError extends Error {
    constructor(
        locale: string,
        readonly expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
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
        locale: string,
        readonly expectedTokenKind: Token.TokenKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
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
    constructor(locale: string, readonly maybeFoundToken: TokenWithColumnNumber | undefined) {
        super(
            Localization.error_parse_expectGeneralizedIdentifier(
                LocalizationUtils.getLocalizationTemplates(locale),
                maybeFoundToken,
            ),
        );
        Object.setPrototypeOf(this, ExpectedGeneralizedIdentifierError.prototype);
    }
}

export class InvalidPrimitiveTypeError extends Error {
    constructor(locale: string, readonly token: Token.Token, readonly positionStart: StringUtils.GraphemePosition) {
        super(Localization.error_parse_invalidPrimitiveType(LocalizationUtils.getLocalizationTemplates(locale), token));
        Object.setPrototypeOf(this, InvalidPrimitiveTypeError.prototype);
    }
}

export class RequiredParameterAfterOptionalParameterError extends Error {
    constructor(
        locale: string,
        readonly missingOptionalToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(
            Localization.error_parse_requiredParameterAfterOptional(LocalizationUtils.getLocalizationTemplates(locale)),
        );
        Object.setPrototypeOf(this, RequiredParameterAfterOptionalParameterError.prototype);
    }
}

export class UnterminatedSequence extends Error {
    constructor(
        locale: string,
        readonly kind: SequenceKind,
        readonly startToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unterminated_sequence(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, UnterminatedSequence.prototype);
    }
}

export class UnusedTokensRemainError extends Error {
    constructor(
        locale: string,
        readonly firstUnusedToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unusedTokens(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, UnusedTokensRemainError.prototype);
    }
}

export interface TokenWithColumnNumber {
    readonly token: Token.Token;
    readonly columnNumber: number;
}

export function assertIsParseError<S extends IParseState = IParseState>(error: any): error is ParseError<S> {
    Assert.isTrue(isParseError(error), "isParseError(error)");
    return true;
}

export function isParseError<S extends IParseState = IParseState>(error: any): error is ParseError<S> {
    return error instanceof ParseError;
}

export function isTParseError<S extends IParseState = IParseState>(error: any): error is TParseError<S> {
    return isParseError(error) || CommonError.isCommonError(error);
}

export function isTInnerParseError(x: any): x is TInnerParseError {
    return (
        x instanceof ExpectedAnyTokenKindError ||
        x instanceof ExpectedCsvContinuationError ||
        x instanceof ExpectedGeneralizedIdentifierError ||
        x instanceof ExpectedTokenKindError ||
        x instanceof InvalidPrimitiveTypeError ||
        x instanceof RequiredParameterAfterOptionalParameterError ||
        x instanceof UnterminatedSequence ||
        x instanceof UnusedTokensRemainError
    );
}

export function maybeTokenFrom(err: TInnerParseError): Token.Token | undefined {
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
    } else if (err instanceof UnterminatedSequence) {
        return err.startToken;
    } else if (err instanceof UnusedTokensRemainError) {
        return err.firstUnusedToken;
    } else {
        return undefined;
    }
}
