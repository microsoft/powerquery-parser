import { CommonError, StringHelpers } from "../common";
import { Localization } from "../localization/error";

export namespace LexerError {

    export type TLexerError = (
        | CommonError.CommonError
        | LexerError
    )

    export type TInnerLexerError = (
        | BadStateError
        | EndOfStreamError
        | ExpectedHexLiteralError
        | ExpectedKeywordOrIdentifierError
        | ExpectedNumericLiteralError
        | UnexpectedEofError
        | UnexpectedReadError
        | UnterminatedMultilineCommentError
        | UnterminatedStringError
    )

    export class LexerError extends Error {
        constructor(
            readonly innerError: TInnerLexerError,
        ) {
            super(innerError.message);
        }
    }

    export class BadStateError extends Error {
        constructor(
            readonly lastError: TLexerError,
            readonly message = Localization.Error.lexerBadState(),
        ) {
            super(message);
        }
    }

    export class EndOfStreamError extends Error {
        constructor(
            readonly message = Localization.Error.lexerEndOfStream(),
        ) {
            super(message);
        }
    }

    export class ExpectedHexLiteralError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
            readonly message = Localization.Error.lexerExpectedHexLiteral(graphemePosition),
        ) {
            super(message);
        }
    }

    export class ExpectedKeywordOrIdentifierError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
            readonly message = Localization.Error.lexerExpectedKeywordOrIdentifier(graphemePosition),
        ) {
            super(message);
        }
    }

    export class ExpectedNumericLiteralError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
            readonly message = Localization.Error.lexerExpectedNumericLiteral(graphemePosition),
        ) {
            super(message);
        }
    }

    export class UnexpectedEofError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
            readonly message = Localization.Error.lexerUnexpectedEof(graphemePosition),
        ) {
            super(message);
        }
    }

    export class UnexpectedReadError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
            readonly message = Localization.Error.lexerUnexpectedRead(graphemePosition),
        ) {
            super(message);
        }
    }

    export class UnterminatedMultilineCommentError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
            readonly message = Localization.Error.lexerUnterminatedString(graphemePosition),
        ) {
            super(message);
        }
    }

    export class UnterminatedStringError extends Error {
        constructor(
            readonly graphemePosition: StringHelpers.GraphemePosition,
            readonly message = Localization.Error.lexerUnterminatedString(graphemePosition),
        ) {
            super(message);
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
            x instanceof BadStateError
            || x instanceof EndOfStreamError
            || x instanceof ExpectedHexLiteralError
            || x instanceof ExpectedKeywordOrIdentifierError
            || x instanceof ExpectedNumericLiteralError
            || x instanceof UnexpectedEofError
            || x instanceof UnexpectedReadError
            || x instanceof UnterminatedMultilineCommentError
            || x instanceof UnterminatedStringError
        );
    }
}
