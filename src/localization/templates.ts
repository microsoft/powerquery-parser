// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as enUs from "./templates/en-US.json";

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
    readonly error_parse_csvContinuation_1_danglingComma: string;
    readonly error_parse_csvContinuation_2_letExpression: string;
    readonly error_parse_expectAnyTokenKind_1_other: string;
    readonly error_parse_expectAnyTokenKind_2_endOfStream: string;
    readonly error_parse_expectGeneralizedIdentifier_1_other: string;
    readonly error_parse_expectGeneralizedIdentifier_2_endOfStream: string;
    readonly error_parse_expectTokenKind_1_other: string;
    readonly error_parse_expectTokenKind_2_endOfStream: string;
    readonly error_parse_invalidPrimitiveType: string;
    readonly error_parse_requiredParameterAfterOptional: string;
    readonly error_parse_unterminated_bracket: string;
    readonly error_parse_unterminated_parenthesis: string;
    readonly error_parse_unusedTokens: string;
}

export const TemplatesByLocale: Map<string, ILocalizationTemplates> = new Map([["en-us", enUs]]);

export const DefaultTemplates: ILocalizationTemplates = enUs;
