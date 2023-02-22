// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CommonError, StringUtils } from "../common";
import { Localization, LocalizationUtils } from "../localization";
import { Lexer } from "..";

export type TLexError = CommonError.CommonError | LexError;

export type TInnerLexError =
    | BadLineNumberError
    | BadRangeError
    | BadStateError
    | EndOfStreamError
    | ErrorLineMapError
    | ExpectedError
    | UnexpectedEofError
    | UnexpectedReadError
    | UnterminatedMultilineTokenError;

export const enum BadLineNumberKind {
    LessThanZero = "LessThanZero",
    GreaterThanNumLines = "GreaterThanNumLines",
}

// do not these sort variants,
// they are in order that logical checks are made, which in turn help create logical variants
export const enum BadRangeKind {
    SameLine_LineCodeUnitStart_Higher = "SameLine_LineCodeUnitStart_Higher",
    LineNumberStart_GreaterThan_LineNumberEnd = "LineNumberStart_GreaterThan_LineNumberEnd",
    LineNumberStart_LessThan_Zero = "LineNumberStart_LessThan_Zero",
    LineNumberStart_GreaterThan_NumLines = "LineNumberStart_GreaterThan_NumLines",
    LineNumberEnd_GreaterThan_NumLines = "LineNumberEnd_GreaterThan_NumLines",
    LineCodeUnitStart_GreaterThan_LineLength = "LineCodeUnitStart_GreaterThan_LineLength",
    LineCodeUnitEnd_GreaterThan_LineLength = "LineCodeUnitEnd_GreaterThan_LineLength",
}

export const enum ExpectedKind {
    HexLiteral = "HexLiteral",
    KeywordOrIdentifier = "KeywordOrIdentifier",
    Numeric = "Numeric",
}

export const enum UnterminatedMultilineTokenKind {
    MultilineComment = "MultilineComment",
    QuotedIdentifier = "QuotedIdentifier",
    Text = "Text",
}

export class LexError extends Error {
    constructor(readonly innerError: TInnerLexError) {
        super(innerError.message);
        Object.setPrototypeOf(this, LexError);
    }
}

export class BadLineNumberError extends Error {
    constructor(
        readonly kind: BadLineNumberKind,
        readonly lineNumber: number,
        readonly numLines: number,
        locale: string,
    ) {
        super(Localization.error_lex_badLineNumber(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, BadLineNumberError.prototype);
    }
}

export class BadRangeError extends Error {
    constructor(readonly range: Lexer.Range, readonly kind: BadRangeKind, locale: string) {
        super(Localization.error_lex_badRange(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, BadRangeError.prototype);
    }
}

export class BadStateError extends Error {
    constructor(readonly innerError: TLexError, locale: string) {
        super(Localization.error_lex_badState(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, BadStateError.prototype);
    }
}

export class ErrorLineMapError extends Error {
    constructor(readonly errorLineMap: Lexer.ErrorLineMap, locale: string) {
        super(Localization.error_lex_lineMap(LocalizationUtils.getLocalizationTemplates(locale), errorLineMap));
        Object.setPrototypeOf(this, ErrorLineMapError.prototype);
    }
}

export class EndOfStreamError extends Error {
    constructor(locale: string) {
        super(Localization.error_lex_endOfStream(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, EndOfStreamError.prototype);
    }
}

export class ExpectedError extends Error {
    constructor(readonly graphemePosition: StringUtils.GraphemePosition, readonly kind: ExpectedKind, locale: string) {
        super(Localization.error_lex_expectedKind(LocalizationUtils.getLocalizationTemplates(locale), kind));
        Object.setPrototypeOf(this, ExpectedError.prototype);
    }
}

export class UnexpectedEofError extends Error {
    constructor(readonly graphemePosition: StringUtils.GraphemePosition, locale: string) {
        super(Localization.error_lex_endOfStreamPartwayRead(LocalizationUtils.getLocalizationTemplates(locale)));
        Object.setPrototypeOf(this, UnexpectedEofError.prototype);
    }
}

export class UnexpectedReadError extends Error {
    constructor(readonly graphemePosition: StringUtils.GraphemePosition, locale: string) {
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
        error instanceof BadLineNumberError ||
        error instanceof BadRangeError ||
        error instanceof BadStateError ||
        error instanceof EndOfStreamError ||
        error instanceof ErrorLineMapError ||
        error instanceof ExpectedError ||
        error instanceof UnexpectedEofError ||
        error instanceof UnexpectedReadError ||
        error instanceof UnterminatedMultilineTokenError
    );
}
