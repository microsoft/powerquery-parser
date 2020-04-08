// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Lexer } from ".";
import { CommonError, StringUtils } from "../common";
import { ILocalizationTemplates, Localization } from "../localization";

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
    }
}

export class BadLineNumberError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly kind: BadLineNumberKind,
        readonly lineNumber: number,
        readonly numLines: number
    ) {
        super(Localization.error_lex_badLineNumber(templates, kind));
    }
}

export class BadRangeError extends Error {
    constructor(templates: ILocalizationTemplates, readonly range: Lexer.Range, readonly kind: BadRangeKind) {
        super(Localization.error_lex_badRange(templates, kind));
    }
}

export class BadStateError extends Error {
    constructor(templates: ILocalizationTemplates, readonly innerError: TLexError) {
        super(Localization.error_lex_badState(templates));
    }
}

export class ErrorLineMapError extends Error {
    constructor(templates: ILocalizationTemplates, readonly errorLineMap: Lexer.ErrorLineMap) {
        super(Localization.error_lex_lineMap(templates, errorLineMap));
    }
}

export class EndOfStreamError extends Error {
    constructor(templates: ILocalizationTemplates) {
        super(Localization.error_lex_endOfStream(templates));
    }
}

export class ExpectedError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly graphemePosition: StringUtils.GraphemePosition,
        readonly kind: ExpectedKind
    ) {
        super(Localization.error_lex_expectedKind(templates, kind));
    }
}

export class UnexpectedEofError extends Error {
    constructor(templates: ILocalizationTemplates, readonly graphemePosition: StringUtils.GraphemePosition) {
        super(Localization.error_lex_endOfStreamPartwayRead(templates));
    }
}

export class UnexpectedReadError extends Error {
    constructor(templates: ILocalizationTemplates, readonly graphemePosition: StringUtils.GraphemePosition) {
        super(Localization.error_lex_unexpectedRead(templates));
    }
}

export class UnterminatedMultilineTokenError extends Error {
    constructor(
        templates: ILocalizationTemplates,
        readonly graphemePosition: StringUtils.GraphemePosition,
        readonly kind: UnterminatedMultilineTokenKind
    ) {
        super(Localization.error_lex_unterminatedMultilineToken(templates, kind));
    }
}

export function isTLexError(x: any): x is TLexError {
    return x instanceof LexError || x instanceof CommonError.CommonError;
}

export function isTInnerLexError(x: any): x is TInnerLexError {
    return (
        x instanceof BadLineNumberError ||
        x instanceof BadRangeError ||
        x instanceof BadStateError ||
        x instanceof EndOfStreamError ||
        x instanceof ErrorLineMapError ||
        x instanceof ExpectedError ||
        x instanceof UnexpectedEofError ||
        x instanceof UnexpectedReadError ||
        x instanceof UnterminatedMultilineTokenError
    );
}
