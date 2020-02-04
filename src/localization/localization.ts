// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { isNever, StringUtils } from "../common";
import { Lexer, LexError, Token, TokenKind } from "../lexer";
import { ParseError } from "../parser";
import { TokenWithColumnNumber } from "../parser/error";
import { ILocalizationTemplates } from "./templates";

interface ILocalization {
    readonly error_common_invariantError: (
        templates: ILocalizationTemplates,
        reason: string,
        maybeJsonifyableDetails: any | undefined,
    ) => string;
    readonly error_common_unknown: (templates: ILocalizationTemplates, message: any) => string;
    readonly error_lex_badLineNumber: (templates: ILocalizationTemplates, kind: LexError.BadLineNumberKind) => string;
    readonly error_lex_badRange: (templates: ILocalizationTemplates, kind: LexError.BadRangeKind) => string;
    readonly error_lex_badState: (templates: ILocalizationTemplates) => string;
    readonly error_lex_endOfStream: (templates: ILocalizationTemplates) => string;
    readonly error_lex_endOfStreamPartwayRead: (templates: ILocalizationTemplates) => string;
    readonly error_lex_expectedKind: (templates: ILocalizationTemplates, kind: LexError.ExpectedKind) => string;
    readonly error_lex_lineMap: (templates: ILocalizationTemplates, errorLineMap: Lexer.ErrorLineMap) => string;
    readonly error_lex_unexpectedRead: (templates: ILocalizationTemplates) => string;
    readonly error_lex_unterminatedMultilineToken: (
        templates: ILocalizationTemplates,
        kind: LexError.UnterminatedMultilineTokenKind,
    ) => string;
    readonly error_parse_csvContinuation: (
        templates: ILocalizationTemplates,
        kind: ParseError.CsvContinuationKind,
    ) => string;
    readonly error_parse_expectAnyTokenKind: (
        templates: ILocalizationTemplates,
        expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectGeneralizedIdentifier: (
        templates: ILocalizationTemplates,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectTokenKind: (
        templates: ILocalizationTemplates,
        expectedAnyTokenKind: TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_invalidPrimitiveType: (templates: ILocalizationTemplates, token: Token) => string;
    readonly error_parse_requiredParameterAfterOptional: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unterminated_bracket: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unterminated_parenthesis: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unusedTokens: (templates: ILocalizationTemplates) => string;
}

export const Localization: ILocalization = {
    error_common_invariantError: (
        templates: ILocalizationTemplates,
        reason: string,
        maybeJsonifyableDetails: any | undefined,
    ) => {
        if (maybeJsonifyableDetails !== undefined) {
            return StringUtils.expectFormat(
                templates.error_common_invariantError_1_details,
                reason,
                JSON.stringify(maybeJsonifyableDetails, undefined, 4),
            );
        } else {
            return StringUtils.expectFormat(templates.error_common_invariantError_2_noDetails, reason);
        }
    },

    error_common_unknown: (templates: ILocalizationTemplates, message: any) => {
        return StringUtils.expectFormat(templates.error_common_unknown, message);
    },

    error_lex_badLineNumber: (templates: ILocalizationTemplates, kind: LexError.BadLineNumberKind) => {
        switch (kind) {
            case LexError.BadLineNumberKind.GreaterThanNumLines:
                return templates.error_lex_badLineNumber_1_greaterThanNumLines;

            case LexError.BadLineNumberKind.LessThanZero:
                return templates.error_lex_badLineNumber_2_lessThanZero;

            default:
                throw isNever(kind);
        }
    },

    error_lex_badRange: (templates: ILocalizationTemplates, kind: LexError.BadRangeKind) => {
        switch (kind) {
            case LexError.BadRangeKind.SameLine_LineCodeUnitStart_Higher:
                return templates.error_lex_badRange_7_sameLine_codeUnitStartGreaterThanCodeUnitEnd;

            case LexError.BadRangeKind.LineNumberStart_GreaterThan_LineNumberEnd:
                return templates.error_lex_badRange_4_lineNumberStart_greaterThanLineNumberEnd;

            case LexError.BadRangeKind.LineNumberStart_LessThan_Zero:
                return templates.error_lex_badRange_6_lineNumberStart_lessThanZero;

            case LexError.BadRangeKind.LineNumberStart_GreaterThan_NumLines:
                return templates.error_lex_badRange_5_lineNumberStart_greaterThanNumLines;

            case LexError.BadRangeKind.LineNumberEnd_GreaterThan_NumLines:
                return templates.error_lex_badRange_2_lineNumberEnd_greaterThanLineNumbers;

            case LexError.BadRangeKind.LineCodeUnitStart_GreaterThan_LineLength:
                return templates.error_lex_badRange_3_lineNumberStart_greaterThanLineLength;

            case LexError.BadRangeKind.LineCodeUnitEnd_GreaterThan_LineLength:
                return templates.error_lex_badRange_1_lineNumberEnd_greaterThanLineLength;

            default:
                throw isNever(kind);
        }
    },

    error_lex_badState: (templates: ILocalizationTemplates) => templates.error_lex_badState,

    error_lex_endOfStream: (templates: ILocalizationTemplates) => templates.error_lex_endOfStream,

    error_lex_endOfStreamPartwayRead: (templates: ILocalizationTemplates) => templates.error_lex_endOfStreamPartwayRead,

    error_lex_expectedKind: (templates: ILocalizationTemplates, kind: LexError.ExpectedKind) => {
        switch (kind) {
            case LexError.ExpectedKind.HexLiteral:
                return templates.error_lex_expectedKind_1_hex;

            case LexError.ExpectedKind.KeywordOrIdentifier:
                return templates.error_lex_expectedKind_2_keywordOrIdentifier;

            case LexError.ExpectedKind.Numeric:
                return templates.error_lex_expectedKind_3_numeric;

            default:
                throw isNever(kind);
        }
    },

    error_lex_lineMap: (templates: ILocalizationTemplates, errorLineMap: Lexer.ErrorLineMap) => {
        return StringUtils.expectFormat(templates.error_lex_lineMap, [...errorLineMap.keys()]);
    },

    error_lex_unexpectedRead: (templates: ILocalizationTemplates) => templates.error_lex_unexpectedRead,

    error_lex_unterminatedMultilineToken: (
        templates: ILocalizationTemplates,
        kind: LexError.UnterminatedMultilineTokenKind,
    ) => {
        switch (kind) {
            case LexError.UnterminatedMultilineTokenKind.MultilineComment:
                return templates.error_lex_unterminatedMultilineToken_1_comment;

            case LexError.UnterminatedMultilineTokenKind.QuotedIdentifier:
                return templates.error_lex_unterminatedMultilineToken_2_quotedIdentifier;

            case LexError.UnterminatedMultilineTokenKind.String:
                return templates.error_lex_unterminatedMultilineToken_3_string;

            default:
                throw isNever(kind);
        }
    },

    error_parse_csvContinuation: (templates: ILocalizationTemplates, kind: ParseError.CsvContinuationKind) => {
        switch (kind) {
            case ParseError.CsvContinuationKind.DanglingComma:
                return templates.error_parse_csvContinuation_1_danglingComma;

            case ParseError.CsvContinuationKind.LetExpression:
                return templates.error_parse_csvContinuation_2_letExpression;

            default:
                throw isNever(kind);
        }
    },

    error_parse_expectAnyTokenKind: (
        templates: ILocalizationTemplates,
        expectedAnyTokenKind: ReadonlyArray<TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                templates.error_parse_expectAnyTokenKind_1_other,
                expectedAnyTokenKind,
                maybeFoundToken.token.kind,
            );
        } else {
            return StringUtils.expectFormat(
                templates.error_parse_expectAnyTokenKind_2_endOfStream,
                expectedAnyTokenKind,
            );
        }
    },

    error_parse_expectGeneralizedIdentifier: (
        templates: ILocalizationTemplates,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                templates.error_parse_expectGeneralizedIdentifier_1_other,
                maybeFoundToken.token.kind,
            );
        } else {
            return templates.error_parse_expectGeneralizedIdentifier_2_endOfStream;
        }
    },

    error_parse_expectTokenKind: (
        templates: ILocalizationTemplates,
        expectedAnyTokenKind: TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                templates.error_parse_expectTokenKind_1_other,
                expectedAnyTokenKind,
                maybeFoundToken,
            );
        } else {
            return StringUtils.expectFormat(templates.error_parse_expectTokenKind_2_endOfStream, expectedAnyTokenKind);
        }
    },

    error_parse_invalidPrimitiveType: (templates: ILocalizationTemplates, token: Token) => {
        return StringUtils.expectFormat(templates.error_parse_invalidPrimitiveType, token.data);
    },

    error_parse_requiredParameterAfterOptional: (templates: ILocalizationTemplates) =>
        templates.error_parse_requiredParameterAfterOptional,

    error_parse_unterminated_bracket: (templates: ILocalizationTemplates) => templates.error_parse_unterminated_bracket,

    error_parse_unterminated_parenthesis: (templates: ILocalizationTemplates) =>
        templates.error_parse_unterminated_parenthesis,

    error_parse_unusedTokens: (templates: ILocalizationTemplates) => templates.error_parse_unusedTokens,
};
