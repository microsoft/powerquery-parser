// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, Option, StringUtils } from "../common";
import { Lexer, LexError, Token, TokenKind } from "../lexer";
import { ParseError } from "../parser";
import { TokenWithColumnNumber } from "../parser/error";
import { Templates } from "./templates";

interface ILocalization {
    readonly error_common_invariantError: (reason: string, maybeJsonifyableDetails: Option<any>) => string;
    readonly error_common_unknown: (message: any) => string;
    readonly error_lex_badLineNumber: (kind: LexError.BadLineNumberKind) => string;
    readonly error_lex_badRange: (kind: LexError.BadRangeKind) => string;
    readonly error_lex_badState: () => string;
    readonly error_lex_endOfStream: () => string;
    readonly error_lex_endOfStreamPartwayRead: () => string;
    readonly error_lex_expectedKind: (kind: LexError.ExpectedKind) => string;
    readonly error_lex_lineMap: (errorLineMap: Lexer.ErrorLineMap) => string;
    readonly error_lex_unexpectedRead: () => string;
    readonly error_lex_unterminatedMultilineToken: (kind: LexError.UnterminatedMultilineTokenKind) => string;
    readonly error_parse_csvContinuation: (kind: ParseError.CsvContinuationKind) => string;
    readonly error_parse_expectAnyTokenKind: (
        expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        maybeFoundToken: Option<TokenWithColumnNumber>,
    ) => string;
    readonly error_parse_expectGeneralizedIdentifier: (maybeFoundToken: Option<TokenWithColumnNumber>) => string;
    readonly error_parse_expectTokenKind: (
        expectedAnyTokenKind: TokenKind,
        maybeFoundToken: Option<TokenWithColumnNumber>,
    ) => string;
    readonly error_parse_invalidPrimitiveType: (token: Token) => string;
    readonly error_parse_requiredParameterAfterOptional: () => string;
    readonly error_parse_unterminated_bracket: () => string;
    readonly error_parse_unterminated_parenthesis: () => string;
    readonly error_parse_unusedTokens: () => string;
}

export const Localization: ILocalization = {
    error_common_invariantError: (reason: string, maybeJsonifyableDetails: Option<any>) => {
        if (maybeJsonifyableDetails !== undefined) {
            return StringUtils.expectFormat(
                Templates.error_common_invariantError_1_details,
                reason,
                JSON.stringify(maybeJsonifyableDetails, undefined, 4),
            );
        } else {
            return StringUtils.expectFormat(Templates.error_common_invariantError_2_noDetails, reason);
        }
    },

    error_common_unknown: (message: any) => {
        return StringUtils.expectFormat(Templates.error_common_unknown, message);
    },

    error_lex_badLineNumber: (kind: LexError.BadLineNumberKind) => {
        switch (kind) {
            case LexError.BadLineNumberKind.GreaterThanNumLines:
                return Templates.error_lex_badLineNumber_1_greaterThanNumLines;

            case LexError.BadLineNumberKind.LessThanZero:
                return Templates.error_lex_badLineNumber_2_lessThanZero;

            default:
                throw isNever(kind);
        }
    },

    error_lex_badRange: (kind: LexError.BadRangeKind) => {
        switch (kind) {
            case LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher:
                return Templates.error_lex_badRange_7_sameLine_codeUnitStartGreaterThanCodeUnitEnd;

            case LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd:
                return Templates.error_lex_badRange_4_lineNumberStart_greaterThanLineNumberEnd;

            case LexError.BadRangeKind.LineNumberStart_LessThan_Zero:
                return Templates.error_lex_badRange_6_lineNumberStart_lessThanZero;

            case LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines:
                return Templates.error_lex_badRange_5_lineNumberStart_greaterThanNumLines;

            case LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines:
                return Templates.error_lex_badRange_2_lineNumberEnd_greaterThanLineNumbers;

            case LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength:
                return Templates.error_lex_badRange_3_lineNumberStart_greaterThanLineLength;

            case LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength:
                return Templates.error_lex_badRange_1_lineNumberEnd_greaterThanLineLength;

            default:
                throw isNever(kind);
        }
    },

    error_lex_badState: () => Templates.error_lex_badState,

    error_lex_endOfStream: () => Templates.error_lex_endOfStream,

    error_lex_endOfStreamPartwayRead: () => Templates.error_lex_endOfStreamPartwayRead,

    error_lex_expectedKind: (kind: LexError.ExpectedKind) => {
        switch (kind) {
            case LexError.ExpectedKind.HexLiteral:
                return Templates.error_lex_expectedKind_1_hex;

            case LexError.ExpectedKind.KeywordOrIdentifier:
                return Templates.error_lex_expectedKind_2_keywordOrIdentifier;

            case LexError.ExpectedKind.Numeric:
                return Templates.error_lex_expectedKind_3_numeric;

            default:
                throw isNever(kind);
        }
    },

    error_lex_lineMap: (errorLineMap: Lexer.ErrorLineMap) => {
        return StringUtils.expectFormat(Templates.error_lex_lineMap, [...errorLineMap.keys()]);
    },

    error_lex_unexpectedRead: () => Templates.error_lex_unexpectedRead,

    error_lex_unterminatedMultilineToken: (kind: LexError.UnterminatedMultilineTokenKind) => {
        switch (kind) {
            case LexError.UnterminatedMultilineTokenKind.MultilineComment:
                return Templates.error_lex_unterminatedMultilineToken_1_comment;

            case LexError.UnterminatedMultilineTokenKind.QuotedIdentifier:
                return Templates.error_lex_unterminatedMultilineToken_2_quotedIdentifier;

            case LexError.UnterminatedMultilineTokenKind.String:
                return Templates.error_lex_unterminatedMultilineToken_3_string;

            default:
                throw isNever(kind);
        }
    },

    error_parse_csvContinuation: (kind: ParseError.CsvContinuationKind) => {
        switch (kind) {
            case ParseError.CsvContinuationKind.DanglingComma:
                return Templates.error_parse_csvContinuation_1_danglingComma;

            case ParseError.CsvContinuationKind.LetExpression:
                return Templates.error_parse_csvContinuation_2_letExpression;

            default:
                throw isNever(kind);
        }
    },

    error_parse_expectAnyTokenKind: (
        expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        maybeFoundToken: Option<TokenWithColumnNumber>,
    ) => {
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                Templates.error_parse_expectAnyTokenKind_1_other,
                expectedAnyTokenKind,
                maybeFoundToken.token.kind,
            );
        } else {
            return StringUtils.expectFormat(
                Templates.error_parse_expectAnyTokenKind_2_endOfStream,
                expectedAnyTokenKind,
            );
        }
    },

    error_parse_expectGeneralizedIdentifier: (maybeFoundToken: Option<TokenWithColumnNumber>) => {
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                Templates.error_parse_expectGeneralizedIdentifier_1_other,
                maybeFoundToken.token.kind,
            );
        } else {
            return Templates.error_parse_expectGeneralizedIdentifier_2_endOfStream;
        }
    },

    error_parse_expectTokenKind: (expectedAnyTokenKind: TokenKind, maybeFoundToken: Option<TokenWithColumnNumber>) => {
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                Templates.error_parse_expectTokenKind_1_other,
                expectedAnyTokenKind,
                maybeFoundToken,
            );
        } else {
            return StringUtils.expectFormat(Templates.error_parse_expectTokenKind_2_endOfStream, expectedAnyTokenKind);
        }
    },

    error_parse_invalidPrimitiveType: (token: Token) => {
        return StringUtils.expectFormat(Templates.error_parse_invalidPrimitiveType, token.data);
    },

    error_parse_requiredParameterAfterOptional: () => {
        return Templates.error_parse_requiredParameterAfterOptional;
    },

    error_parse_unterminated_bracket: () => {
        return Templates.error_parse_unterminated_bracket;
    },

    error_parse_unterminated_parenthesis: () => {
        return Templates.error_parse_unterminated_parenthesis;
    },

    error_parse_unusedTokens: () => {
        return Templates.error_parse_unusedTokens;
    },
};
