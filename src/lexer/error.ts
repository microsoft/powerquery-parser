// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { CommonError, StringHelpers } from "../common";
import { Localization } from "../localization/error";
import { Lexer } from "./lexer";

export namespace LexerError {

    export type TLexerError = (
        | CommonError.CommonError
        | LexerError
    )

    export type TInnerLexerError = (
        | BadLineNumber
        | BadRangeError
        | BadStateError
        | EndOfStreamError
        | ErrorLineError
        | ExpectedHexLiteralError
        | ExpectedKeywordOrIdentifierError
        | ExpectedNumericLiteralError
        | UnexpectedEofError
        | UnexpectedReadError
        | UnterminatedMultilineCommentError
        | UnterminatedQuotedIdentierError
        | UnterminatedStringError
    )

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

    export const enum BadLineNumberKind {
        LessThanZero = "LessThanZero",
        GreaterThanNumLines = "GreaterThanNumLines",
    }

    export class LexerError extends Error {
        constructor(
            readonly innerError: TInnerLexerError,
        ) {
            super(innerError.message);
        }
    }

    export class BadLineNumber extends Error {
        constructor(
            readonly kind: BadLineNumberKind,
            readonly lineNumber: number,
            readonly numLines: number,
        ) {
            super(Localization.Error.lexerBadLineNumber(kind, lineNumber, numLines));
        }
    }

    export class BadRangeError extends Error {
        constructor(
            readonly range: Lexer.Range,
            readonly kind: BadRangeKind,
        ) {
            super(Localization.Error.lexerBadRange(kind));
        }
    }

    export class BadStateError extends Error {
        constructor(
            readonly innerError: TLexerError,
        ) {
            super(Localization.Error.lexerBadState());
        }
    }

    export class ErrorLineError extends Error {
        constructor(
            readonly errors: Lexer.TErrorLines,
        ) {
            super(Localization.Error.lexerLineError(errors));
        }
    }

    export class EndOfStreamError extends Error {
        constructor() {
            super(Localization.Error.lexerEndOfStream());
        }
    }

    export class ExpectedHexLiteralError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerExpectedHexLiteral(graphemePosition));
        }
    }

    export class ExpectedKeywordOrIdentifierError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerExpectedKeywordOrIdentifier(graphemePosition));
        }
    }

    export class ExpectedNumericLiteralError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerExpectedNumericLiteral(graphemePosition));
        }
    }

    export class UnexpectedEofError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerUnexpectedEof(graphemePosition));
        }
    }

    export class UnexpectedReadError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerUnexpectedRead(graphemePosition));
        }
    }

    export class UnterminatedMultilineCommentError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerUnterminatedMultilineComment(graphemePosition));
        }
    }

    export class UnterminatedQuotedIdentierError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerUnterminatedQuotedIdentifier(graphemePosition));
        }
    }

    export class UnterminatedStringError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
        ) {
            super(Localization.Error.lexerUnterminatedString(graphemePosition));
        }
    }

    export function isTLexerError(x: any): x is TLexerError {
        return (
            x instanceof LexerError
            || x instanceof CommonError.CommonError
        );
    }

    export function isTInnerLexerError(x: any): x is TInnerLexerError {
        return (
            x instanceof BadLineNumber
            || x instanceof BadRangeError
            || x instanceof BadStateError
            || x instanceof EndOfStreamError
            || x instanceof ErrorLineError
            || x instanceof ExpectedHexLiteralError
            || x instanceof ExpectedKeywordOrIdentifierError
            || x instanceof ExpectedNumericLiteralError
            || x instanceof UnexpectedEofError
            || x instanceof UnexpectedReadError
            || x instanceof UnterminatedMultilineCommentError
            || x instanceof UnterminatedQuotedIdentierError
            || x instanceof UnterminatedStringError
        );
    }
}
