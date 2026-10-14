// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, StringUtils } from "../common";
import { Localization, LocalizationUtils } from "../localization";

export type TLexError = CommonError.CommonError | LexError;

export type TInnerLexError = ExpectedError | UnexpectedEofError | UnexpectedReadError | UnterminatedMultilineTokenError;

export enum ExpectedKind {
    HexLiteral = "HexLiteral",
    KeywordOrIdentifier = "KeywordOrIdentifier",
    Numeric = "Numeric",
}

export enum UnterminatedMultilineTokenKind {
    MultilineComment = "MultilineComment",
    QuotedIdentifier = "QuotedIdentifier",
    Text = "Text",
}

export class LexError extends Error {
    readonly innerError: TInnerLexError;

    constructor(innerError: TInnerLexError) {
        super(innerError.message);
        this.innerError = innerError;
        Object.setPrototypeOf(this, LexError.prototype);
    }
}

export class ExpectedError extends Error {
    constructor(
        readonly graphemePosition: StringUtils.GraphemePosition,
        readonly kind: ExpectedKind,
        locale: string,
    ) {
        super(Localization.error_lex_expectedKind(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, ExpectedError.prototype);
    }
}

export class UnexpectedEofError extends Error {
    constructor(
        readonly graphemePosition: StringUtils.GraphemePosition,
        locale: string,
    ) {
        super(Localization.error_lex_endOfStreamPartwayRead(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, UnexpectedEofError.prototype);
    }
}

export class UnexpectedReadError extends Error {
    constructor(
        readonly graphemePosition: StringUtils.GraphemePosition,
        locale: string,
    ) {
        super(Localization.error_lex_unexpectedRead(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, UnexpectedReadError.prototype);
    }
}

export class UnterminatedMultilineTokenError extends Error {
    constructor(
        locale: string,
        readonly graphemePosition: StringUtils.GraphemePosition,
        readonly kind: UnterminatedMultilineTokenKind,
    ) {
        super(
            Localization.error_lex_unterminatedMultilineToken(LocalizationUtils.getLocalizationTemplates(locale), kind),
        );

        Object.setPrototypeOf(this, UnterminatedMultilineTokenError.prototype);
    }
}

export function isLexError(error: unknown): error is LexError {
    return error instanceof LexError;
}

export function isTLexError(error: unknown): error is TLexError {
    return error instanceof LexError || error instanceof CommonError.CommonError;
}

export function isTInnerLexError(error: unknown): error is TInnerLexError {
    return (
        error instanceof ExpectedError ||
        error instanceof UnexpectedEofError ||
        error instanceof UnexpectedReadError ||
        error instanceof UnterminatedMultilineTokenError
    );
}
