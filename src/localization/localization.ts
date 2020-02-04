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
        expectedAnyTokenKinds: ReadonlyArray<TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectGeneralizedIdentifier: (
        templates: ILocalizationTemplates,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_expectTokenKind: (
        templates: ILocalizationTemplates,
        expectedTokenKind: TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => string;
    readonly error_parse_invalidPrimitiveType: (templates: ILocalizationTemplates, token: Token) => string;
    readonly error_parse_requiredParameterAfterOptional: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unterminated_bracket: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unterminated_parenthesis: (templates: ILocalizationTemplates) => string;
    readonly error_parse_unusedTokens: (templates: ILocalizationTemplates) => string;
}

export function localizeTokenKind(tokenKind: TokenKind, localizationTemplates: ILocalizationTemplates): string {
    switch (tokenKind) {
        case TokenKind.Ampersand:
            return localizationTemplates.tokenKind_ampersand;
        case TokenKind.Asterisk:
            return localizationTemplates.tokenKind_asterisk;
        case TokenKind.AtSign:
            return localizationTemplates.tokenKind_atSign;
        case TokenKind.Bang:
            return localizationTemplates.tokenKind_bang;
        case TokenKind.Comma:
            return localizationTemplates.tokenKind_comma;
        case TokenKind.Division:
            return localizationTemplates.tokenKind_division;
        case TokenKind.DotDot:
            return localizationTemplates.tokenKind_dotDot;
        case TokenKind.Ellipsis:
            return localizationTemplates.tokenKind_ellipsis;
        case TokenKind.Equal:
            return localizationTemplates.tokenKind_equal;
        case TokenKind.FatArrow:
            return localizationTemplates.tokenKind_fatArrow;
        case TokenKind.GreaterThan:
            return localizationTemplates.tokenKind_greaterThan;
        case TokenKind.GreaterThanEqualTo:
            return localizationTemplates.tokenKind_greaterThanEqualTo;
        case TokenKind.HexLiteral:
            return localizationTemplates.tokenKind_hexLiteral;
        case TokenKind.Identifier:
            return localizationTemplates.tokenKind_identifier;
        case TokenKind.KeywordAnd:
            return localizationTemplates.tokenKind_keywordAnd;
        case TokenKind.KeywordAs:
            return localizationTemplates.tokenKind_keywordAs;
        case TokenKind.KeywordEach:
            return localizationTemplates.tokenKind_keywordEach;
        case TokenKind.KeywordElse:
            return localizationTemplates.tokenKind_keywordElse;
        case TokenKind.KeywordError:
            return localizationTemplates.tokenKind_keywordError;
        case TokenKind.KeywordFalse:
            return localizationTemplates.tokenKind_keywordFalse;
        case TokenKind.KeywordHashBinary:
            return localizationTemplates.tokenKind_keywordHashBinary;
        case TokenKind.KeywordHashDate:
            return localizationTemplates.tokenKind_keywordHashDate;
        case TokenKind.KeywordHashDateTime:
            return localizationTemplates.tokenKind_keywordHashDateTime;
        case TokenKind.KeywordHashDateTimeZone:
            return localizationTemplates.tokenKind_keywordHashDateTimeZone;
        case TokenKind.KeywordHashDuration:
            return localizationTemplates.tokenKind_keywordHashDuration;
        case TokenKind.KeywordHashInfinity:
            return localizationTemplates.tokenKind_keywordHashInfinity;
        case TokenKind.KeywordHashNan:
            return localizationTemplates.tokenKind_keywordHashNan;
        case TokenKind.KeywordHashSections:
            return localizationTemplates.tokenKind_keywordHashSections;
        case TokenKind.KeywordHashShared:
            return localizationTemplates.tokenKind_keywordShared;
        case TokenKind.KeywordHashTable:
            return localizationTemplates.tokenKind_keywordHashTable;
        case TokenKind.KeywordHashTime:
            return localizationTemplates.tokenKind_keywordHashTime;
        case TokenKind.KeywordIf:
            return localizationTemplates.tokenKind_keywordIf;
        case TokenKind.KeywordIn:
            return localizationTemplates.tokenKind_keywordIn;
        case TokenKind.KeywordIs:
            return localizationTemplates.tokenKind_keywordIs;
        case TokenKind.KeywordLet:
            return localizationTemplates.tokenKind_keywordLet;
        case TokenKind.KeywordMeta:
            return localizationTemplates.tokenKind_keywordMeta;
        case TokenKind.KeywordNot:
            return localizationTemplates.tokenKind_notEqual;
        case TokenKind.KeywordOr:
            return localizationTemplates.tokenKind_keywordOr;
        case TokenKind.KeywordOtherwise:
            return localizationTemplates.tokenKind_keywordOtherwise;
        case TokenKind.KeywordSection:
            return localizationTemplates.tokenKind_keywordSection;
        case TokenKind.KeywordShared:
            return localizationTemplates.tokenKind_keywordShared;
        case TokenKind.KeywordThen:
            return localizationTemplates.tokenKind_keywordThen;
        case TokenKind.KeywordTrue:
            return localizationTemplates.tokenKind_keywordTrue;
        case TokenKind.KeywordTry:
            return localizationTemplates.tokenKind_keywordTry;
        case TokenKind.KeywordType:
            return localizationTemplates.tokenKind_keywordType;
        case TokenKind.LeftBrace:
            return localizationTemplates.tokenKind_leftBrace;
        case TokenKind.LeftBracket:
            return localizationTemplates.tokenKind_leftBracket;
        case TokenKind.LeftParenthesis:
            return localizationTemplates.tokenKind_leftParenthesis;
        case TokenKind.LessThan:
            return localizationTemplates.tokenKind_lessThan;
        case TokenKind.LessThanEqualTo:
            return localizationTemplates.tokenKind_lessThanEqualTo;
        case TokenKind.Minus:
            return localizationTemplates.tokenKind_minus;
        case TokenKind.NotEqual:
            return localizationTemplates.tokenKind_notEqual;
        case TokenKind.NullLiteral:
            return localizationTemplates.tokenKind_nullLiteral;
        case TokenKind.NumericLiteral:
            return localizationTemplates.tokenKind_numericLiteral;
        case TokenKind.Plus:
            return localizationTemplates.tokenKind_plus;
        case TokenKind.QuestionMark:
            return localizationTemplates.tokenKind_questionMark;
        case TokenKind.RightBrace:
            return localizationTemplates.tokenKind_rightBrace;
        case TokenKind.RightBracket:
            return localizationTemplates.tokenKind_rightBracket;
        case TokenKind.RightParenthesis:
            return localizationTemplates.tokenKind_rightParenthesis;
        case TokenKind.Semicolon:
            return localizationTemplates.tokenKind_semicolon;
        case TokenKind.StringLiteral:
            return localizationTemplates.tokenKind_stringLiteral;

        default:
            throw isNever(tokenKind);
    }
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
        expectedAnyTokenKinds: ReadonlyArray<TokenKind>,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        const localizedExpectedAnyTokenKinds: ReadonlyArray<string> = expectedAnyTokenKinds.map(
            (tokenKind: TokenKind) => localizeTokenKind(tokenKind, templates),
        );
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                templates.error_parse_expectAnyTokenKind_1_other,
                localizedExpectedAnyTokenKinds.join(", "),
                localizeTokenKind(maybeFoundToken.token.kind, templates),
            );
        } else {
            return StringUtils.expectFormat(
                templates.error_parse_expectAnyTokenKind_2_endOfStream,
                localizedExpectedAnyTokenKinds,
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
                localizeTokenKind(maybeFoundToken.token.kind, templates),
            );
        } else {
            return templates.error_parse_expectGeneralizedIdentifier_2_endOfStream;
        }
    },

    error_parse_expectTokenKind: (
        templates: ILocalizationTemplates,
        expectedTokenKind: TokenKind,
        maybeFoundToken: TokenWithColumnNumber | undefined,
    ) => {
        if (maybeFoundToken !== undefined) {
            return StringUtils.expectFormat(
                templates.error_parse_expectTokenKind_1_other,
                localizeTokenKind(expectedTokenKind, templates),
                localizeTokenKind(maybeFoundToken.token.kind, templates),
            );
        } else {
            return StringUtils.expectFormat(
                templates.error_parse_expectTokenKind_2_endOfStream,
                localizeTokenKind(expectedTokenKind, templates),
            );
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
