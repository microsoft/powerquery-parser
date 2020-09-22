// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Assert, CommonError, StringUtils } from "../common";
import { Token } from "../language";
import { ILocalizationTemplates, Localization } from "../localization";
import { IParserState } from "./IParserState";

export type TParseError<S extends IParserState = IParserState> = CommonError.CommonError | ParseError<S>;

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

export class ParseError<S extends IParserState = IParserState> extends Error {
    constructor(readonly innerError: TInnerParseError, readonly state: S) {
        super(innerError.message);
        Object.setPrototypeOf(this, ParseError.prototype);
    }
}

export class ExpectedCsvContinuationError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly kind: CsvContinuationKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_csvContinuation(templates, kind));
        Object.setPrototypeOf(this, ExpectedCsvContinuationError.prototype);
    }
}

export class ExpectedAnyTokenKindError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly expectedAnyTokenKinds: ReadonlyArray<Token.TokenKind>,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_expectAnyTokenKind(templates, expectedAnyTokenKinds, maybeFoundToken));
        Object.setPrototypeOf(this, ExpectedAnyTokenKindError.prototype);
    }
}

export class ExpectedTokenKindError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly expectedTokenKind: Token.TokenKind,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_expectTokenKind(templates, expectedTokenKind, maybeFoundToken));
        Object.setPrototypeOf(this, ExpectedTokenKindError.prototype);
    }
}

export class ExpectedGeneralizedIdentifierError extends Error {
    constructor(templates: ILocalizationTemplates, readonly maybeFoundToken: TokenWithColumnNumber | undefined) {
        super(Localization.error_parse_expectGeneralizedIdentifier(templates, maybeFoundToken));
        Object.setPrototypeOf(this, ExpectedGeneralizedIdentifierError.prototype);
    }
}

export class InvalidPrimitiveTypeError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly token: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_invalidPrimitiveType(templates, token));
        Object.setPrototypeOf(this, InvalidPrimitiveTypeError.prototype);
    }
}

export class RequiredParameterAfterOptionalParameterError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly missingOptionalToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_requiredParameterAfterOptional(templates));
        Object.setPrototypeOf(this, RequiredParameterAfterOptionalParameterError.prototype);
    }
}

export class UnterminatedSequence extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly kind: SequenceKind,
        readonly startToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unterminated_sequence(templates, kind));
        Object.setPrototypeOf(this, UnterminatedSequence.prototype);
    }
}

export class UnusedTokensRemainError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly firstUnusedToken: Token.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unusedTokens(templates));
        Object.setPrototypeOf(this, UnusedTokensRemainError.prototype);
    }
}

export interface TokenWithColumnNumber {
    readonly token: Token.Token;
    readonly columnNumber: number;
}

export function assertIsParseError<S extends IParserState = IParserState>(error: any): error is ParseError<S> {
    Assert.isTrue(isParseError(error), "isParseError(error)");
    return true;
}

export function isParseError<S extends IParserState = IParserState>(error: any): error is ParseError<S> {
    return error instanceof ParseError;
}

export function isTParseError<S extends IParserState = IParserState>(error: any): error is TParseError<S> {
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
