import { StringUtils, Option, isNever } from "../common";
import { Lexer, LexError } from "../lexer";
import * as templates from "./templates.json";

export interface ILocalizationTemplates {
    readonly error_common_invariantError_1_details: string;
    readonly error_common_invariantError_2_noDetails: string;
    readonly error_common_unknown: string;
    readonly error_lex_badLineNumber_1_greaterThanNumLines: string;
    readonly error_lex_badLineNumber_2_lessThanZero: string;
    readonly error_lex_badRange_1_lineNumberEnd_greaterThanLineLength: string;
    readonly error_lex_badRange_2_lineNumberEnd_greaterThanLineNumbers: string;
    readonly error_lex_badRange_3_lineNumberStart_greaterThanLineLength: string;
    readonly error_lex_badRange_4_lineNumberStart_greaterThanLineNumberEnd: string;
    readonly error_lex_badRange_5_lineNumberStart_greaterThanNumLines: string;
    readonly error_lex_badRange_6_lineNumberStart_lessThanZero: string;
    readonly error_lex_badRange_7_sameLine_codeUnitStartGreaterThanCodeUnitEnd: string;
    readonly error_lex_badState: string;
    readonly error_lex_endOfStream: string;
    readonly error_lex_endOfStreamPartwayRead: string;
    readonly error_lex_expectedKind_1_hex: string;
    readonly error_lex_expectedKind_2_keywordOrIdentifier: string;
    readonly error_lex_expectedKind_3_numeric: string;
    readonly error_lex_lineMap: string;
    readonly error_lex_unexpectedRead: string;
    readonly error_lex_unterminatedMultilineToken_1_comment: string;
    readonly error_lex_unterminatedMultilineToken_2_quotedIdentifier: string;
    readonly error_lex_unterminatedMultilineToken_3_string: string;
    readonly error_parse_csvContinuation_danglingComma: string;
    readonly error_parse_csvContinuation_letExpression: string;
    readonly error_parse_expectAnyTokenKind: string;
    readonly error_parse_expectAnyTokenKind_endOfStream: string;
    readonly error_parse_expectGeneralizedIdentifier: string;
    readonly error_parse_expectGeneralizedIdentifier_endOfStream: string;
    readonly error_parse_expectTokenKind: string;
    readonly error_parse_expectTokenKind_endOfStream: string;
    readonly error_parse_invalidLiteral: string;
    readonly error_parse_invalidPrimitiveType: string;
    readonly error_parse_requiredParameterAfterOptional: string;
    readonly error_parse_unexpected: string;
    readonly error_parse_unterminated_bracket: string;
    readonly error_parse_unterminated_parenthesis: string;
    readonly error_parse_unusedTokens: string;
}

export const Templates: ILocalizationTemplates = templates;

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
    readonly error_parse_csvContinuation_danglingComma: () => string;
    readonly error_parse_csvContinuation_letExpression: () => string;
    readonly error_parse_expectAnyTokenKind: () => string;
    readonly error_parse_expectAnyTokenKind_endOfStream: () => string;
    readonly error_parse_expectGeneralizedIdentifier: () => string;
    readonly error_parse_expectGeneralizedIdentifier_endOfStream: () => string;
    readonly error_parse_expectTokenKind: () => string;
    readonly error_parse_expectTokenKind_endOfStream: () => string;
    readonly error_parse_invalidLiteral: () => string;
    readonly error_parse_invalidPrimitiveType: () => string;
    readonly error_parse_requiredParameterAfterOptional: () => string;
    readonly error_parse_unexpected: () => string;
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
};
