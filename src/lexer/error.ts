// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, StringHelpers } from "../common";
import * as Localization from "../localization/error";
import * as Lexer from "./lexer";

export type TLexerError = CommonError.CommonError | LexerError;

export type TInnerLexerError =
    | BadLineNumberError
    | BadRangeError
    | BadStateError
    | EndOfStreamError
    | ErrorLineError
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
    String = "String",
}

export class LexerError extends Error {
    constructor(readonly innerError: TInnerLexerError) {
        super(innerError.message);
    }
}

export class BadLineNumberError extends Error {
    constructor(readonly kind: BadLineNumberKind, readonly lineNumber: number, readonly numLines: number) {
        super(Localization.lexerBadLineNumber(kind, lineNumber, numLines));
    }
}

export class BadRangeError extends Error {
    constructor(readonly range: Lexer.Range, readonly kind: BadRangeKind) {
        super(Localization.lexerBadRange(kind));
    }
}

export class BadStateError extends Error {
    constructor(readonly innerError: TLexerError) {
        super(Localization.lexerBadState());
    }
}

export class ErrorLineError extends Error {
    constructor(readonly errors: Lexer.TErrorLines) {
        super(Localization.lexerLineError(errors));
    }
}

export class EndOfStreamError extends Error {
    constructor() {
        super(Localization.lexerEndOfStream());
    }
}

export class ExpectedError extends Error {
    constructor(readonly graphemePosition: StringHelpers.GraphemePosition, readonly kind: ExpectedKind) {
        super(Localization.lexerExpected(graphemePosition, kind));
    }
}

export class UnexpectedEofError extends Error {
    constructor(readonly graphemePosition: StringHelpers.GraphemePosition) {
        super(Localization.lexerUnexpectedEof(graphemePosition));
    }
}

export class UnexpectedReadError extends Error {
    constructor(readonly graphemePosition: StringHelpers.GraphemePosition) {
        super(Localization.lexerUnexpectedRead(graphemePosition));
    }
}

export class UnterminatedMultilineTokenError extends Error {
    constructor(
        readonly graphemePosition: StringHelpers.GraphemePosition,
        readonly kind: UnterminatedMultilineTokenKind,
    ) {
        super(Localization.lexerUnterminatedMultilineToken(graphemePosition, kind));
    }
}

export function isTLexerError(x: any): x is TLexerError {
    return x instanceof LexerError || x instanceof CommonError.CommonError;
}

export function isTInnerLexerError(x: any): x is TInnerLexerError {
    return (
        x instanceof BadLineNumberError ||
        x instanceof BadRangeError ||
        x instanceof BadStateError ||
        x instanceof EndOfStreamError ||
        x instanceof ErrorLineError ||
        x instanceof ExpectedError ||
        x instanceof UnexpectedEofError ||
        x instanceof UnexpectedReadError ||
        x instanceof UnterminatedMultilineTokenError
    );
}
