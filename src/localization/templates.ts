import * as enUs from "./templates/en-US.json";

export interface ILocalizationTemplates {
    readonly error_common_invariantError_details: string;
    readonly error_common_invariantError_noDetails: string;
    readonly error_common_unknown: string;
    readonly error_lex_badLineNumber_greaterThanNumLines: string;
    readonly error_lex_badLineNumber_lessThanZero: string;
    readonly error_lex_badRange_lineNumberEnd_greaterThanLineLength: string;
    readonly error_lex_badRange_lineNumberEnd_greaterThanLineNumbers: string;
    readonly error_lex_badRange_lineNumberStart_greaterThanLineLength: string;
    readonly error_lex_badRange_lineNumberStart_greaterThanLineNumberEnd: string;
    readonly error_lex_badRange_lineNumberStart_greaterThanNumLines: string;
    readonly error_lex_badRange_lineNumberStart_lessThanZero: string;
    readonly error_lex_badRange_sameLine_codeUnitStartGreaterThanCodeUnitEnd: string;
    readonly error_lex_badState: string;
    readonly error_lex_endOfStream: string;
    readonly error_lex_endOfStreamPartway: string;
    readonly error_lex_expectedKind_hex: string;
    readonly error_lex_expectedKind_keywordOrIdentifier: string;
    readonly error_lex_expectedKind_numeric: string;
    readonly error_lex_lineMap: string;
    readonly error_lex_unexpectedRead: string;
    readonly error_lex_unterminatedMultilineToken_comment: string;
    readonly error_lex_unterminatedMultilineToken_quotedIdentifier: string;
    readonly error_lex_unterminatedMultilineToken_string: string;
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

export const LocalizationTemplateByLocale: Map<string, ILocalizationTemplates> = new Map<
    string,
    ILocalizationTemplates
>([["en-US", enUs]]);
