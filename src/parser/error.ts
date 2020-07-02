// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Language } from "..";
import { CommonError, StringUtils } from "../common";
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

export class ParseError<S extends IParserState = IParserState> extends Error {
    constructor(readonly innerError: TInnerParseError, readonly state: S) {
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
        readonly expectedAnyTokenKinds: ReadonlyArray<Language.TokenKind>,
        readonly maybeFoundToken: TokenWithColumnNumber | undefined,
    ) {
        super(Localization.error_parse_expectAnyTokenKind(templates, expectedAnyTokenKinds, maybeFoundToken));
    }
}

export class ExpectedTokenKindError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly expectedTokenKind: Language.TokenKind,
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
        readonly token: Language.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_invalidPrimitiveType(templates, token));
    }
}

export class RequiredParameterAfterOptionalParameterError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly missingOptionalToken: Language.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_requiredParameterAfterOptional(templates));
    }
}

export class UnterminatedBracketError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly openBracketToken: Language.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unterminated_bracket(templates));
    }
}

export class UnterminatedParenthesesError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly openParenthesesToken: Language.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unterminated_parenthesis(templates));
    }
}

export class UnusedTokensRemainError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly firstUnusedToken: Language.Token,
        readonly positionStart: StringUtils.GraphemePosition,
    ) {
        super(Localization.error_parse_unusedTokens(templates));
    }
}

export interface TokenWithColumnNumber {
    readonly token: Language.Token;
    readonly columnNumber: number;
}

export function isParseError<S extends IParserState = IParserState>(error: any): error is ParseError<S> {
    return error instanceof ParseError;
}

export function isTParseError<S extends IParserState = IParserState>(error: any): error is TParseError<S> {
    return error instanceof ParseError || error instanceof CommonError.CommonError;
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

export function maybeTokenFrom(err: TInnerParseError): Language.Token | undefined {
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
